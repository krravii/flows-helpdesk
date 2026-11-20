import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { QUEUES } from '@flows-helpdesk/shared';
import { Ticket } from '../../models/Ticket.js';
import { TicketMessage } from '../../models/TicketMessage.js';
import { Organisation } from '../../models/Organisation.js';
import { User } from '../../models/User.js';
import { Role } from '../../models/Role.js';
import { SlaPolicy } from '../../models/AdminModels.js';
import { getNextTicketNumber } from '../../models/Counter.js';
import { authenticate, requirePermission, buildTenantTicketFilter } from '../../middleware/auth.js';
import { getRabbitChannel } from '../../infra/rabbitmq.js';
import { logAudit } from '../../utils/audit.js';
import argon2 from 'argon2';

export const ticketsRouter = Router();
ticketsRouter.use(authenticate);

const createTicketSchema = z.object({
    subject: z.string().min(3),
    description: z.string().min(1),
    orgId: z.string().nullable().optional(),
    requesterId: z.string().nullable().optional(),
    requesterName: z.string().optional(),
    requesterEmail: z.string().email().optional(),
    assigneeId: z.string().nullable().optional(),
    priority: z.enum(['Urgent', 'High', 'Normal', 'Low']).default('Normal'),
    category: z.string().default('General Support'),
    source: z.enum(['Email', 'Web Portal', 'Manual', 'System Integration']).default('Web Portal'),
    tags: z.array(z.string()).default([])
});

const replySchema = z.object({
    type: z.enum(['public', 'internal_note']).default('public'),
    bodyText: z.string().min(1),
    bodyHtml: z.string().optional(),
    cc: z.string().optional(),
    attachments: z
        .array(
            z.object({
                fileName: z.string(),
                mimeType: z.string(),
                sizeBytes: z.number(),
                s3Key: z.string()
            })
        )
        .default([])
});

function escapeRegex(str) {
    return String(str).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

async function computeSlaWindow(priority) {
    const policy = await SlaPolicy.findOne({ priority, enabled: true }).lean();
    const now = Date.now();
    if (!policy) {
        return {
            policyId: null,
            status: 'On Track',
            firstResponseDueAt: new Date(now + 120 * 60 * 1000),
            resolutionDueAt: new Date(now + 24 * 3600 * 1000)
        };
    }
    return {
        policyId: policy._id,
        status: 'On Track',
        firstResponseDueAt: new Date(now + policy.firstResponseMins * 60 * 1000),
        resolutionDueAt: new Date(now + policy.resolutionHours * 3600 * 1000)
    };
}

// GET /api/tickets — Filtered, sorted, paginated & tenant-scoped
ticketsRouter.get('/', requirePermission('tickets.view'), async (req, res, next) => {
    try {
        const {
            search = '',
            status = '',
            priority = '',
            orgId = '',
            assigneeId = '',
            category = '',
            sla = '',
            source = '',
            queue = '',
            sortBy = 'updatedAt',
            sortDir = 'desc',
            page = '1',
            pageSize = '15'
        } = req.query;

        const query = buildTenantTicketFilter(req.user, {});

        if (queue === 'my') {
            if (req.user.isCustomer) query.requesterId = req.user.id;
            else query.assigneeId = req.user.id;
        } else if (queue === 'unassigned' && !req.user.isCustomer) {
            query.assigneeId = null;
            query.status = { $nin: ['Resolved', 'Closed'] };
        } else if (queue === 'unknown_org' && !req.user.isCustomer) {
            query.orgId = null;
        }

        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (orgId && !req.user.isCustomer) query.orgId = orgId === 'unknown' ? null : orgId;
        if (assigneeId && !req.user.isCustomer) query.assigneeId = assigneeId;
        if (category) query.category = category;
        if (sla && !req.user.isCustomer) query['sla.status'] = sla;
        if (source && !req.user.isCustomer) query.source = source;

        if (search) {
            const rx = new RegExp(escapeRegex(search), 'i');
            query.$or = [
                { ticketNumber: rx },
                { subject: rx },
                { requesterName: rx },
                { requesterEmail: rx }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 15));
        const sortField = ['ticketNumber', 'subject', 'priority', 'status', 'createdAt', 'updatedAt'].includes(sortBy)
            ? sortBy
            : 'updatedAt';
        const sortOrder = sortDir === 'asc' ? 1 : -1;

        const [items, total] = await Promise.all([
            Ticket.find(query)
                .populate('orgId', 'name code primaryDomain')
                .populate('assigneeId', 'fullName email team availability')
                .sort({ [sortField]: sortOrder })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Ticket.countDocuments(query)
        ]);

        res.json({
            items,
            pagination: {
                page: pageNum,
                pageSize: limitNum,
                total,
                totalPages: Math.max(1, Math.ceil(total / limitNum))
            }
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/tickets — Atomic ACID creation of Ticket + Initial Message
ticketsRouter.post('/', requirePermission('tickets.create'), async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
        const data = createTicketSchema.parse(req.body);
        let createdTicket = null;

        await session.withTransaction(async () => {
            const ticketNumber = await getNextTicketNumber('FLW-', session);
            let orgId = req.user.isCustomer ? req.user.orgId : (data.orgId || null);
            let requesterId = req.user.isCustomer ? req.user.id : (data.requesterId || null);
            let requesterName = req.user.isCustomer ? req.user.fullName : (data.requesterName || '');
            let requesterEmail = req.user.isCustomer ? req.user.email : (data.requesterEmail || '');

            if (!req.user.isCustomer && requesterId) {
                const cust = await User.findById(requesterId).session(session).lean();
                if (cust) {
                    requesterName = cust.fullName;
                    requesterEmail = cust.email;
                    if (!orgId && cust.orgId) orgId = cust.orgId;
                }
            }

            const assigneeId = req.user.isCustomer ? null : (data.assigneeId || null);
            const sla = await computeSlaWindow(data.priority);
            const threadId = `<thread-${ticketNumber.replace('FLW-', '')}@sinchflows.io>`;

            const [ticket] = await Ticket.create(
                [
                    {
                        ticketNumber,
                        subject: data.subject,
                        orgId,
                        requesterId,
                        requesterName: requesterName || 'External Requester',
                        requesterEmail: requesterEmail || 'unknown@client.io',
                        assigneeId,
                        priority: data.priority,
                        status: assigneeId ? 'Open' : 'New',
                        category: data.category,
                        source: req.user.isCustomer ? 'Web Portal' : data.source,
                        tags: data.tags,
                        emailThreadRootId: threadId,
                        sla
                    }
                ],
                { session }
            );

            await TicketMessage.create(
                [
                    {
                        ticketId: ticket._id,
                        type: 'customer',
                        authorId: requesterId,
                        authorName: ticket.requesterName,
                        authorEmail: ticket.requesterEmail,
                        bodyText: data.description,
                        emailMeta: {
                            from: `${ticket.requesterName} <${ticket.requesterEmail}>`,
                            to: 'support@sinchflows.io',
                            subject: `[${ticketNumber}] ${ticket.subject}`,
                            messageId: `<root-${ticketNumber}@sinchflows.io>`,
                            inReplyTo: 'None',
                            references: [threadId]
                        }
                    }
                ],
                { session }
            );

            createdTicket = ticket;
        });

        await logAudit({
            req,
            action: 'Ticket Created',
            module: 'Tickets',
            target: createdTicket.ticketNumber,
            details: `Created ticket "${createdTicket.subject}"`
        });

        res.status(201).json({ ticket: createdTicket });
    } catch (err) {
        next(err);
    } finally {
        await session.endSession();
    }
});

// GET /api/tickets/:ticketNumber — Full ticket + filtered conversation stream
ticketsRouter.get('/:ticketNumber', requirePermission('tickets.view'), async (req, res, next) => {
    try {
        const query = buildTenantTicketFilter(req.user, { ticketNumber: req.params.ticketNumber });
        const ticket = await Ticket.findOne(query)
            .populate('orgId', 'name code primaryDomain additionalDomains')
            .populate('assigneeId', 'fullName email team availability')
            .lean();

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found or access denied' });
        }

        const msgQuery = { ticketId: ticket._id };
        if (req.user.isCustomer) {
            msgQuery.type = { $in: ['customer', 'engineer'] };
        } else if (!req.user.permissions.includes('tickets.note_view')) {
            msgQuery.type = { $ne: 'internal_note' };
        }

        const messages = await TicketMessage.find(msgQuery).sort({ createdAt: 1 }).lean();

        const sanitizedMessages = req.user.isCustomer
            ? messages.map(({ emailMeta, ...rest }) => rest)
            : messages;

        res.json({ ticket, messages: sanitizedMessages });
    } catch (err) {
        next(err);
    }
});

// POST /api/tickets/:ticketNumber/messages — Public Reply (SMTP Queue) or Internal Note
ticketsRouter.post('/:ticketNumber/messages', async (req, res, next) => {
    try {
        const data = replySchema.parse(req.body);
        const isInternal = data.type === 'internal_note';

        if (isInternal && (req.user.isCustomer || !req.user.permissions.includes('tickets.note_add'))) {
            return res.status(403).json({ message: 'Not permitted to add internal notes' });
        }
        if (!isInternal && !req.user.permissions.includes('tickets.reply_public')) {
            return res.status(403).json({ message: 'Not permitted to post public replies' });
        }

        const query = buildTenantTicketFilter(req.user, { ticketNumber: req.params.ticketNumber });
        const ticket = await Ticket.findOne(query);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const msgType = isInternal ? 'internal_note' : req.user.isCustomer ? 'customer' : 'engineer';
        const messageId = `<msg-${Date.now()}@sinchflows.io>`;

        const msg = await TicketMessage.create({
            ticketId: ticket._id,
            type: msgType,
            authorId: req.user.id,
            authorName: req.user.fullName,
            authorEmail: req.user.email,
            bodyText: data.bodyText,
            bodyHtml: data.bodyHtml || '',
            attachments: data.attachments,
            emailMeta: isInternal
                ? null
                : {
                    from: req.user.isCustomer
                        ? `${req.user.fullName} <${req.user.email}>`
                        : 'Sinch Flows Support <support@sinchflows.io>',
                    to: req.user.isCustomer ? 'support@sinchflows.io' : ticket.requesterEmail,
                    cc: data.cc || '',
                    subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
                    messageId,
                    inReplyTo: ticket.emailThreadRootId,
                    references: [ticket.emailThreadRootId]
                }
        });

        if (!isInternal) {
            if (!req.user.isCustomer && !ticket.sla.firstRespondedAt) {
                ticket.sla.firstRespondedAt = new Date();
            }
            ticket.status = req.user.isCustomer ? 'Open' : 'Waiting for Customer';

            if (!req.user.isCustomer) {
                try {
                    const ch = getRabbitChannel();
                    ch.sendToQueue(
                        QUEUES.EMAIL_OUTBOUND_SEND,
                        Buffer.from(
                            JSON.stringify({
                                ticketId: ticket._id.toString(),
                                ticketNumber: ticket.ticketNumber,
                                to: ticket.requesterEmail,
                                cc: data.cc || '',
                                subject: `Re: [${ticket.ticketNumber}] ${ticket.subject}`,
                                bodyText: data.bodyText,
                                bodyHtml: data.bodyHtml || `<p>${data.bodyText.split('\n').join('<br/>')}</p>`,
                                messageId,
                                inReplyTo: ticket.emailThreadRootId
                            })
                        ),
                        { persistent: true }
                    );
                } catch (mqErr) {
                    console.warn('[RabbitMQ] Failed to enqueue outbound email:', mqErr.message);
                }
            }
        }

        await ticket.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`ticket:${ticket.ticketNumber}`).emit('ticket:message', {
                ticketNumber: ticket.ticketNumber,
                message: msg
            });
        }

        await logAudit({
            req,
            action: isInternal ? 'Internal Note Added' : 'Public Reply Sent',
            module: 'Tickets',
            target: ticket.ticketNumber,
            details: `${req.user.fullName} added ${isInternal ? 'an internal note' : 'a public reply'}`
        });

        res.status(201).json({ message: msg, ticket });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/tickets/:ticketNumber — Update status, priority, assignee, category, tags
ticketsRouter.patch('/:ticketNumber', async (req, res, next) => {
    try {
        if (req.user.isCustomer) {
            if (req.body.status === 'Open' && req.user.permissions.includes('tickets.reopen')) {
                const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber, orgId: req.user.orgId });
                if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
                ticket.status = 'Open';
                await ticket.save();
                await TicketMessage.create({
                    ticketId: ticket._id,
                    type: 'system',
                    authorName: req.user.fullName,
                    bodyText: `Ticket reopened by customer ${req.user.fullName}`
                });
                return res.json({ ticket });
            }
            return res.status(403).json({ message: 'Customers cannot modify internal ticket properties' });
        }

        const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        const changes = [];
        if (req.body.status !== undefined && req.body.status !== ticket.status) {
            changes.push(`Status changed from "${ticket.status}" to "${req.body.status}"`);
            ticket.status = req.body.status;
            if (req.body.status === 'Resolved') ticket.sla.resolvedAt = new Date();
        }
        if (req.body.priority !== undefined && req.body.priority !== ticket.priority) {
            changes.push(`Priority changed from "${ticket.priority}" to "${req.body.priority}"`);
            ticket.priority = req.body.priority;
        }
        if (req.body.assigneeId !== undefined) {
            const eng = req.body.assigneeId ? await User.findById(req.body.assigneeId).lean() : null;
            changes.push(eng ? `Assigned to ${eng.fullName}` : 'Ticket unassigned');
            ticket.assigneeId = eng ? eng._id : null;
            if (eng && ticket.status === 'New') ticket.status = 'Open';
        }
        if (req.body.category !== undefined) ticket.category = req.body.category;
        if (req.body.tags !== undefined) ticket.tags = req.body.tags;

        await ticket.save();

        if (changes.length) {
            await TicketMessage.create({
                ticketId: ticket._id,
                type: 'system',
                authorId: req.user.id,
                authorName: req.user.fullName,
                bodyText: changes.join(' · ')
            });
            await logAudit({
                req,
                action: 'Ticket Updated',
                module: 'Tickets',
                target: ticket.ticketNumber,
                details: changes.join('; ')
            });
        }

        const updated = await Ticket.findById(ticket._id)
            .populate('orgId', 'name code primaryDomain')
            .populate('assigneeId', 'fullName email team availability')
            .lean();

        res.json({ ticket: updated });
    } catch (err) {
        next(err);
    }
});

// POST /api/tickets/:ticketNumber/map-organisation — Unknown Organisation Triage Workflow
ticketsRouter.post(
    '/:ticketNumber/map-organisation',
    requirePermission('orgs.edit'),
    async (req, res, next) => {
        try {
            const { orgId, registerCustomerUser = true } = req.body;
            const ticket = await Ticket.findOne({ ticketNumber: req.params.ticketNumber });
            if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

            const org = await Organisation.findById(orgId);
            if (!org) return res.status(404).json({ message: 'Target organisation not found' });

            ticket.orgId = org._id;

            if (registerCustomerUser && ticket.requesterEmail) {
                let custUser = await User.findOne({ email: ticket.requesterEmail.toLowerCase() });
                if (!custUser) {
                    const customerRole = await Role.findOne({ name: 'Customer' });
                    const tempHash = await argon2.hash('TempPass@2026!');
                    custUser = await User.create({
                        fullName: ticket.requesterName.replace(' (External)', ''),
                        email: ticket.requesterEmail.toLowerCase(),
                        passwordHash: tempHash,
                        userType: 'customer',
                        roleId: customerRole._id,
                        orgId: org._id,
                        status: 'Active'
                    });
                }
                ticket.requesterId = custUser._id;
            }

            await ticket.save();
            await TicketMessage.create({
                ticketId: ticket._id,
                type: 'system',
                authorId: req.user.id,
                authorName: req.user.fullName,
                bodyText: `Mapped Unknown Organisation ticket to "${org.name}"`
            });

            await logAudit({
                req,
                action: 'Unknown Organisation Mapped',
                module: 'Tickets',
                target: ticket.ticketNumber,
                details: `Associated ${ticket.requesterEmail} with organisation ${org.name}`
            });

            res.json({ ticket });
        } catch (err) {
            next(err);
        }
    }
);