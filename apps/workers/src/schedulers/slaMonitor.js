import { Ticket, Notification } from '../models/index.js';

export async function runSlaCheckCycle() {
  const now = new Date();
  const warningHorizon = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins remaining

  // 1. Mark breached tickets
  const breachedTickets = await Ticket.find({
    status: { $nin: ['Resolved', 'Closed', 'Waiting for Customer'] },
    'sla.status': { $in: ['On Track', 'Warning'] },
    $or: [
      { 'sla.firstRespondedAt': null, 'sla.firstResponseDueAt': { $lt: now } },
      { 'sla.resolutionDueAt': { $lt: now } }
    ]
  });

  for (const t of breachedTickets) {
    t.sla.status = 'Breached';
    await t.save();
    if (t.assigneeId) {
      await Notification.create({
        userId: t.assigneeId,
        type: 'SLA Breach',
        title: `SLA Breached on ${t.ticketNumber}`,
        message: `"${t.subject}" has exceeded its SLA target window.`,
        ticketNumber: t.ticketNumber
      });
    }
  }

  // 2. Mark approaching warning threshold
  const warningTickets = await Ticket.find({
    status: { $nin: ['Resolved', 'Closed', 'Waiting for Customer'] },
    'sla.status': 'On Track',
    $or: [
      { 'sla.firstRespondedAt': null, 'sla.firstResponseDueAt': { $lt: warningHorizon } },
      { 'sla.resolutionDueAt': { $lt: warningHorizon } }
    ]
  });

  for (const t of warningTickets) {
    t.sla.status = 'Warning';
    await t.save();
    if (t.assigneeId) {
      await Notification.create({
        userId: t.assigneeId,
        type: 'SLA Warning',
        title: `SLA Warning on ${t.ticketNumber}`,
        message: `"${t.subject}" is within 30 minutes of SLA breach.`,
        ticketNumber: t.ticketNumber
      });
    }
  }
}
