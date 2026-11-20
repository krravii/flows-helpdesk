import mongoose from 'mongoose';
import {
  Ticket,
  TicketMessage,
  User,
  Organisation,
  EmailRoutingRule,
  EmailLog,
  SlaPolicy,
  Notification,
  getNextTicketNumber
} from '../models/index.js';

/**
 * 4-Stage Automated Email-to-Ticket Routing Pipeline:
 * 1. Existing Thread Match (In-Reply-To / References / [FLW-XXXX] token)
 * 2. Registered Customer User Match (exact email match)
 * 3. Organisation Domain Match (primaryDomain / additionalDomains)
 * 4. Unknown Organisation Queue Fallback
 */
export async function processInboundEmail(payload) {
  const {
    fromEmail,
    fromName,
    toEmail = 'support@sinchflows.io',
    cc = '',
    subject = '(No Subject)',
    bodyText = '',
    bodyHtml = '',
    messageId = `<in-${Date.now()}@external.io>`,
    inReplyTo = '',
    references = [],
    attachments = []
  } = payload;

  const senderEmail = fromEmail.toLowerCase().trim();
  const senderDomain = senderEmail.split('@')[1] || '';

  // Deduplicate by RFC Message-ID
  if (messageId) {
    const duplicate = await TicketMessage.findOne({ 'emailMeta.messageId': messageId }).lean();
    if (duplicate) {
      return { action: 'duplicate_skipped', messageId };
    }
  }

  // STAGE 1: Match existing conversation thread
  let existingTicket = null;
  const ticketTokenMatch = subject.match(/\[(FLW-\d+)\]/i);
  if (ticketTokenMatch) {
    existingTicket = await Ticket.findOne({ ticketNumber: ticketTokenMatch[1].toUpperCase() });
  }
  if (!existingTicket && (inReplyTo || references.length)) {
    const refIds = [inReplyTo, ...references].filter(Boolean);
    existingTicket = await Ticket.findOne({ emailThreadRootId: { $in: refIds } });
  }

  if (existingTicket) {
    await TicketMessage.create({
      ticketId: existingTicket._id,
      type: 'customer',
      authorName: fromName || senderEmail,
      authorEmail: senderEmail,
      bodyText,
      bodyHtml,
      attachments,
      emailMeta: {
        from: `${fromName} <${senderEmail}>`,
        to: toEmail,
        cc,
        subject,
        messageId,
        inReplyTo,
        references
      }
    });

    if (['Waiting for Customer', 'Resolved'].includes(existingTicket.status)) {
      existingTicket.status = 'Open';
    }
    await existingTicket.save();

    if (existingTicket.assigneeId) {
      await Notification.create({
        userId: existingTicket.assigneeId,
        type: 'Customer Reply Received',
        title: `New Email Reply on ${existingTicket.ticketNumber}`,
        message: `${fromName || senderEmail} replied via email thread.`,
        ticketNumber: existingTicket.ticketNumber
      });
    }

    await EmailLog.create({
      sender: senderEmail,
      subject,
      result: 'Appended to Thread',
      ticketNumber: existingTicket.ticketNumber,
      orgName: existingTicket.orgId ? 'Mapped Organisation' : 'Unknown Organisation'
    });

    return { action: 'appended', ticketNumber: existingTicket.ticketNumber };
  }

  // STAGE 2: Registered Customer User Match
  let matchedOrg = null;
  let matchedUser = await User.findOne({ email: senderEmail, userType: 'customer', status: 'Active' }).lean();
  if (matchedUser?.orgId) {
    matchedOrg = await Organisation.findById(matchedUser.orgId).lean();
  }

  // STAGE 3: Organisation Domain Match
  if (!matchedOrg && senderDomain) {
    matchedOrg = await Organisation.findOne({
      status: 'Active',
      $or: [
        { primaryDomain: senderDomain },
        { additionalDomains: senderDomain },
        { registeredEmails: senderEmail }
      ]
    }).lean();
  }

  // Apply custom EmailRoutingRule overrides if configured
  let priority = 'Normal';
  let category = 'Email';
  const activeRules = await EmailRoutingRule.find({ status: 'Active' }).sort({ priority: 1 }).lean();
  for (const rule of activeRules) {
    if (rule.matchType === 'Organisation Domain' && rule.matchValue.toLowerCase() === senderDomain) {
      if (rule.orgId && !matchedOrg) matchedOrg = await Organisation.findById(rule.orgId).lean();
      if (rule.assignPriority) priority = rule.assignPriority;
      if (rule.assignCategory) category = rule.assignCategory;
      break;
    }
    if (rule.matchType === 'Email Address' && rule.matchValue.toLowerCase() === senderEmail) {
      if (rule.orgId && !matchedOrg) matchedOrg = await Organisation.findById(rule.orgId).lean();
      if (rule.assignPriority) priority = rule.assignPriority;
      if (rule.assignCategory) category = rule.assignCategory;
      break;
    }
  }

  // STAGE 4: Create Ticket (Mapped Org or Unknown Organisation fallback)
  const session = await mongoose.startSession();
  let createdTicket = null;
  try {
    await session.withTransaction(async () => {
      const ticketNumber = await getNextTicketNumber('FLW-', session);
      const threadRoot = `<thread-${ticketNumber.replace('FLW-', '')}@sinchflows.io>`;
      const policy = await SlaPolicy.findOne({ priority, enabled: true }).lean();
      const now = Date.now();

      const [t] = await Ticket.create(
        [
          {
            ticketNumber,
            subject,
            orgId: matchedOrg ? matchedOrg._id : null,
            requesterId: matchedUser ? matchedUser._id : null,
            requesterName: matchedUser ? matchedUser.fullName : fromName || senderEmail,
            requesterEmail: senderEmail,
            priority,
            status: 'New',
            category,
            source: 'Email',
            tags: matchedOrg ? ['email-intake'] : ['email-intake', 'unknown-org'],
            emailThreadRootId: threadRoot,
            sla: {
              policyId: policy?._id || null,
              status: 'On Track',
              firstResponseDueAt: new Date(now + (policy?.firstResponseMins || 120) * 60000),
              resolutionDueAt: new Date(now + (policy?.resolutionHours || 24) * 3600000)
            }
          }
        ],
        { session }
      );

      await TicketMessage.create(
        [
          {
            ticketId: t._id,
            type: 'customer',
            authorId: matchedUser ? matchedUser._id : null,
            authorName: t.requesterName,
            authorEmail: senderEmail,
            bodyText,
            bodyHtml,
            attachments,
            emailMeta: {
              from: `${t.requesterName} <${senderEmail}>`,
              to: toEmail,
              cc,
              subject: `[${ticketNumber}] ${subject}`,
              messageId,
              inReplyTo: 'None (Thread Root)',
              references: [threadRoot]
            }
          }
        ],
        { session }
      );

      createdTicket = t;
    });
  } finally {
    await session.endSession();
  }

  const resultLabel = matchedOrg ? 'Created Ticket' : 'Routed to Unknown Org';
  await EmailLog.create({
    sender: senderEmail,
    subject,
    result: resultLabel,
    ticketNumber: createdTicket.ticketNumber,
    orgName: matchedOrg ? matchedOrg.name : 'Unknown Organisation'
  });

  return {
    action: matchedOrg ? 'created_mapped' : 'created_unknown_org',
    ticketNumber: createdTicket.ticketNumber,
    organisation: matchedOrg ? matchedOrg.name : 'Unknown Organisation'
  };
}
