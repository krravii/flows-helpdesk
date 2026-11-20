import argon2 from 'argon2';
import mongoose from 'mongoose';
import { PERMISSION_KEYS } from '@flows-helpdesk/shared';
import { connectMongo } from '../infra/mongo.js';
import { Role } from '../models/Role.js';
import { Organisation } from '../models/Organisation.js';
import { User } from '../models/User.js';
import { Counter } from '../models/Counter.js';
import { Ticket } from '../models/Ticket.js';
import { TicketMessage } from '../models/TicketMessage.js';
import {
  SlaPolicy,
  EmailTemplate,
  EmailRoutingRule,
  SystemSetting,
  AuditLog
} from '../models/AdminModels.js';

async function seed() {
  await connectMongo();
  console.log('[Seed] Starting Flows Helpdesk database seed...');

  // 1. Roles
  const roleDefs = [
    {
      name: 'Super Admin',
      description: 'Full unrestricted platform access across all tenants, RBAC policies, SMTP/IMAP engines, and system configuration.',
      type: 'System',
      category: 'Administration',
      permissions: [...PERMISSION_KEYS]
    },
    {
      name: 'System Admin',
      description: 'Manages organisations, user onboarding, ticket routing, SLA policies, email configuration, and operational queues.',
      type: 'System',
      category: 'Operations',
      permissions: PERMISSION_KEYS.filter((k) => !k.startsWith('roles.') && k !== 'settings.config')
    },
    {
      name: 'Support Engineer',
      description: 'Handles technical support tickets, customer replies, internal notes, Flow/Node-RED diagnostics, and SLA resolution.',
      type: 'System',
      category: 'Support',
      permissions: [
        'dashboard.view', 'dashboard.personal',
        'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.reassign',
        'tickets.status', 'tickets.priority', 'tickets.reply_public', 'tickets.note_add',
        'tickets.note_view', 'tickets.history', 'tickets.attachments_view', 'tickets.attachments_upload',
        'tickets.close', 'tickets.reopen',
        'orgs.view', 'orgs.users_view', 'orgs.tickets_view',
        'engineers.view', 'engineers.availability', 'engineers.performance',
        'reports.view', 'reports.engineer'
      ]
    },
    {
      name: 'Customer',
      description: 'External client portal user restricted strictly to their own organisation tickets and public conversations.',
      type: 'System',
      category: 'External',
      permissions: [
        'dashboard.view', 'dashboard.organisation',
        'tickets.view', 'tickets.create', 'tickets.reply_public',
        'tickets.attachments_view', 'tickets.attachments_upload', 'tickets.reopen',
        'orgs.tickets_view'
      ]
    }
  ];

  const rolesMap = {};
  for (const r of roleDefs) {
    const doc = await Role.findOneAndUpdate({ name: r.name }, r, { upsert: true, new: true });
    rolesMap[r.name] = doc;
  }

  // 2. Organisations
  const orgDefs = [
    {
      name: 'Al-Dawaa',
      code: 'ALD',
      description: 'Enterprise pharmacy & healthcare retail group utilizing Sinch Flows WhatsApp & Conversation API.',
      primaryDomain: 'al-dawaa.com',
      additionalDomains: ['support.al-dawaa.com', 'aldawaa.sa'],
      domainVerified: true,
      registeredEmails: ['it-ops@al-dawaa.com'],
      contactPerson: 'Tariq Al-Mansoor',
      contactEmail: 'tariq.mansoor@al-dawaa.com',
      contactPhone: '+966 13 882 4410',
      status: 'Active'
    },
    {
      name: 'Najeeb Holding',
      code: 'NJH',
      description: 'Multi-vertical conglomerate running omnichannel customer engagement flows across WhatsApp and Instagram.',
      primaryDomain: 'najeebholding.com',
      additionalDomains: ['najeebgroup.ae'],
      domainVerified: true,
      registeredEmails: ['digital@najeebholding.com'],
      contactPerson: 'Layla Al-Harbi',
      contactEmail: 'layla.harbi@najeebholding.com',
      contactPhone: '+971 4 319 8820',
      status: 'Active'
    },
    {
      name: 'Watani Auto',
      code: 'WAT',
      description: 'Automotive dealership and service booking automation on Sinch Contact Pro & WhatsApp.',
      primaryDomain: 'wataniauto.com',
      additionalDomains: ['service.wataniauto.com'],
      domainVerified: true,
      registeredEmails: ['crm@wataniauto.com'],
      contactPerson: 'Faisal Al-Qahtani',
      contactEmail: 'faisal.q@wataniauto.com',
      contactPhone: '+966 11 490 2211',
      status: 'Active'
    },
    {
      name: 'SIDF',
      code: 'SIDF',
      description: 'Industrial development fund running authenticated WhatsApp & SMS notification flows.',
      primaryDomain: 'sidf.gov.sa',
      additionalDomains: ['alerts.sidf.gov.sa'],
      domainVerified: true,
      registeredEmails: ['messaging@sidf.gov.sa'],
      contactPerson: 'Noura Al-Otaibi',
      contactEmail: 'n.alotaibi@sidf.gov.sa',
      contactPhone: '+966 11 822 5000',
      status: 'Active'
    },
    {
      name: 'Acme Retail',
      code: 'ACM',
      description: 'Regional e-commerce brand leveraging Facebook Messenger, Instagram DM, and order tracking bots.',
      primaryDomain: 'acmeretail.io',
      additionalDomains: ['help.acmeretail.io'],
      domainVerified: true,
      registeredEmails: ['ops@acmeretail.io'],
      contactPerson: 'Elena Rostova',
      contactEmail: 'elena@acmeretail.io',
      contactPhone: '+971 4 551 0934',
      status: 'Active'
    },
    {
      name: 'Global Logistics',
      code: 'GLG',
      description: 'Freight & last-mile delivery fleet using automated WhatsApp delivery status notifications.',
      primaryDomain: 'globallogistics.co',
      additionalDomains: ['dispatch.globallogistics.co'],
      domainVerified: false,
      registeredEmails: ['tech@globallogistics.co'],
      contactPerson: 'Marcus Vance',
      contactEmail: 'm.vance@globallogistics.co',
      contactPhone: '+44 20 7946 0821',
      status: 'Active'
    },
    {
      name: 'Cloud Connect',
      code: 'CLC',
      description: 'B2B telecom reseller integrating Sinch Conversation API via REST webhooks.',
      primaryDomain: 'cloudconnect.net',
      additionalDomains: [],
      domainVerified: true,
      registeredEmails: ['noc@cloudconnect.net'],
      contactPerson: 'Sanjay Mehta',
      contactEmail: 'sanjay.mehta@cloudconnect.net',
      contactPhone: '+91 80 4092 7710',
      status: 'Active'
    }
  ];

  const orgs = [];
  for (const o of orgDefs) {
    const doc = await Organisation.findOneAndUpdate({ name: o.name }, o, { upsert: true, new: true });
    orgs.push(doc);
  }

  // 3. Demo Users (Password for all demo accounts: Flows@2026!)
  const passwordHash = await argon2.hash('Flows@2026!');

  const userDefs = [
    { fullName: 'Ravi Kumar', email: 'ravi.kumar@sinchflows.io', userType: 'internal', roleId: rolesMap['Super Admin']._id, team: 'Platform & Flows Core', availability: 'Available' },
    { fullName: 'Mohammed Abu Obaid', email: 'm.obaid@sinchflows.io', userType: 'internal', roleId: rolesMap['System Admin']._id, team: 'Enterprise CPaaS', availability: 'Available' },
    { fullName: 'Chandan Kumar', email: 'chandan.k@sinchflows.io', userType: 'internal', roleId: rolesMap['Support Engineer']._id, team: 'Node-RED & Integrations', availability: 'Busy' },
    { fullName: 'Aisha Al-Zahrani', email: 'aisha.z@sinchflows.io', userType: 'internal', roleId: rolesMap['Support Engineer']._id, team: 'WhatsApp & Meta Channels', availability: 'Available' },
    { fullName: 'Daniel Lindqvist', email: 'daniel.l@sinchflows.io', userType: 'internal', roleId: rolesMap['Support Engineer']._id, team: 'Conversation API & Webhooks', availability: 'Available' },
    { fullName: 'Tariq Al-Mansoor', email: 'tariq.mansoor@al-dawaa.com', userType: 'customer', roleId: rolesMap['Customer']._id, orgId: orgs[0]._id },
    { fullName: 'Layla Al-Harbi', email: 'layla.harbi@najeebholding.com', userType: 'customer', roleId: rolesMap['Customer']._id, orgId: orgs[1]._id },
    { fullName: 'Faisal Al-Qahtani', email: 'faisal.q@wataniauto.com', userType: 'customer', roleId: rolesMap['Customer']._id, orgId: orgs[2]._id },
    { fullName: 'Noura Al-Otaibi', email: 'n.alotaibi@sidf.gov.sa', userType: 'customer', roleId: rolesMap['Customer']._id, orgId: orgs[3]._id },
    { fullName: 'Elena Rostova', email: 'elena@acmeretail.io', userType: 'customer', roleId: rolesMap['Customer']._id, orgId: orgs[4]._id }
  ];

  const users = [];
  for (const u of userDefs) {
    const doc = await User.findOneAndUpdate(
      { email: u.email },
      { ...u, passwordHash, status: 'Active' },
      { upsert: true, new: true }
    );
    users.push(doc);
  }

  // 4. SLA Policies
  const slaDefs = [
    { name: 'Critical Production SLA', priority: 'Urgent', firstResponseMins: 15, resolutionHours: 4, businessHours: '24x7 Follow-the-Sun' },
    { name: 'Enterprise High Priority', priority: 'High', firstResponseMins: 30, resolutionHours: 8, businessHours: 'Mon–Fri 08:00–20:00 GST' },
    { name: 'Standard Support SLA', priority: 'Normal', firstResponseMins: 120, resolutionHours: 24, businessHours: 'Mon–Fri 09:00–18:00 GST' },
    { name: 'Low / Advisory SLA', priority: 'Low', firstResponseMins: 480, resolutionHours: 72, businessHours: 'Mon–Fri 09:00–18:00 GST' }
  ];
  for (const s of slaDefs) {
    await SlaPolicy.findOneAndUpdate({ priority: s.priority }, s, { upsert: true });
  }

  // 5. System Settings & Categories
  await SystemSetting.findByIdAndUpdate(
    'global',
    {
      _id: 'global',
      categories: [
        { name: 'WhatsApp', description: 'WhatsApp Business API, templates & webhook delivery', active: true },
        { name: 'Flow Deployment', description: 'Node-RED / Sinch Flows publishing & runtime errors', active: true },
        { name: 'Integration', description: 'Sinch Conversation API, Contact Pro & CRM webhooks', active: true },
        { name: 'Node-RED', description: 'Custom nodes, Redis locks & execution loops', active: true },
        { name: 'Email', description: 'SMTP relay, IMAP polling & domain routing', active: true },
        { name: 'Technical Issue', description: 'Infrastructure, Redis, MongoDB & latency incidents', active: true }
      ],
      tags: [
        { name: 'webhook', color: 'info' },
        { name: 'whatsapp-template', color: 'success' },
        { name: 'redis-cluster', color: 'danger' },
        { name: 'node-red', color: 'warning' },
        { name: 'production-p1', color: 'danger' }
      ]
    },
    { upsert: true }
  );

  // 6. Email Templates & Routing Rules
  await EmailTemplate.findOneAndUpdate(
    { type: 'Ticket Created' },
    {
      name: 'Ticket Created Confirmation',
      type: 'Ticket Created',
      subject: '[{{ticket.id}}] We received your request: {{ticket.subject}}',
      htmlBody: '<p>Hello {{ticket.requester.name}},</p><p>Your support ticket <strong>{{ticket.id}}</strong> has been logged for <strong>{{ticket.organisation.name}}</strong>.</p>',
      textBody: 'Hello {{ticket.requester.name}}, Your support ticket {{ticket.id}} has been logged.'
    },
    { upsert: true }
  );

  await EmailRoutingRule.findOneAndUpdate(
    { name: 'Al-Dawaa Enterprise Domain' },
    {
      name: 'Al-Dawaa Enterprise Domain',
      matchType: 'Organisation Domain',
      matchValue: 'al-dawaa.com',
      orgId: orgs[0]._id,
      assignPriority: 'High',
      priority: 1
    },
    { upsert: true }
  );

  // 7. Sample Tickets (if empty)
  const existingTickets = await Ticket.countDocuments();
  if (existingTickets === 0) {
    await Counter.findByIdAndUpdate('ticket_number', { seq: 1003 }, { upsert: true });

    const sampleTickets = [
      {
        ticketNumber: 'FLW-1001',
        subject: 'WhatsApp webhook not receiving messages on production flow',
        orgId: orgs[0]._id,
        requesterId: users[5]._id,
        requesterName: users[5].fullName,
        requesterEmail: users[5].email,
        assigneeId: users[3]._id,
        team: 'WhatsApp & Meta Channels',
        priority: 'Urgent',
        status: 'In Progress',
        category: 'WhatsApp',
        source: 'Email',
        tags: ['webhook', 'production-p1'],
        emailThreadRootId: '<thread-1001@sinchflows.io>',
        sla: { status: 'On Track', firstResponseDueAt: new Date(Date.now() + 3600000), resolutionDueAt: new Date(Date.now() + 14400000) }
      },
      {
        ticketNumber: 'FLW-1002',
        subject: 'Flow deployment failed with validation lock error',
        orgId: orgs[1]._id,
        requesterId: users[6]._id,
        requesterName: users[6].fullName,
        requesterEmail: users[6].email,
        assigneeId: users[2]._id,
        team: 'Node-RED & Integrations',
        priority: 'High',
        status: 'Open',
        category: 'Flow Deployment',
        source: 'Web Portal',
        tags: ['node-red', 'redis-cluster'],
        emailThreadRootId: '<thread-1002@sinchflows.io>',
        sla: { status: 'Warning', firstResponseDueAt: new Date(Date.now() + 1200000), resolutionDueAt: new Date(Date.now() + 21600000) }
      },
      {
        ticketNumber: 'FLW-1003',
        subject: 'Inbound inquiry from unmapped domain regarding Conversation API',
        orgId: null,
        requesterId: null,
        requesterName: 'Khalid Al-Saud (External)',
        requesterEmail: 'khalid.alsaud@newretail-sa.com',
        assigneeId: null,
        priority: 'Normal',
        status: 'New',
        category: 'Integration',
        source: 'Email',
        tags: ['webhook'],
        emailThreadRootId: '<thread-1003@sinchflows.io>',
        sla: { status: 'On Track', firstResponseDueAt: new Date(Date.now() + 7200000), resolutionDueAt: new Date(Date.now() + 86400000) }
      }
    ];

    for (const st of sampleTickets) {
      const created = await Ticket.create(st);
      await TicketMessage.create({
        ticketId: created._id,
        type: 'customer',
        authorId: created.requesterId,
        authorName: created.requesterName,
        authorEmail: created.requesterEmail,
        bodyText: `Hello Sinch Flows Support,

We need assistance with: ${created.subject}. Please inspect our flow execution logs.`,
        emailMeta: {
          from: `${created.requesterName} <${created.requesterEmail}>`,
          to: 'support@sinchflows.io',
          subject: `[${created.ticketNumber}] ${created.subject}`,
          messageId: `<root-${created.ticketNumber}@client.io>`,
          inReplyTo: 'None',
          references: [created.emailThreadRootId]
        }
      });

      if (created.assigneeId) {
        await TicketMessage.create({
          ticketId: created._id,
          type: 'internal_note',
          authorId: users[0]._id,
          authorName: users[0].fullName,
          authorEmail: users[0].email,
          bodyText: 'INTERNAL NOTE: Verified Redis Streams consumer lag is 0ms. Checking upstream Conversation API callback logs.'
        });
      }
    }

    await AuditLog.create({
      userId: users[0]._id,
      userName: users[0].fullName,
      action: 'System Seeded',
      module: 'System Settings',
      target: 'Database',
      details: 'Initialized default RBAC roles, organisations, users, SLA policies, and starter tickets.'
    });
  }

  console.log('[Seed] Completed successfully!');
  console.log('------------------------------------------------------------');
  console.log('Demo Accounts (Password for all: Flows@2026!):');
  console.log('  Super Admin:      ravi.kumar@sinchflows.io');
  console.log('  System Admin:     m.obaid@sinchflows.io');
  console.log('  Support Engineer: aisha.z@sinchflows.io');
  console.log('  Customer (ALD):   tariq.mansoor@al-dawaa.com');
  console.log('------------------------------------------------------------');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
