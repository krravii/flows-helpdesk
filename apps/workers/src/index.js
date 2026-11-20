import mongoose from 'mongoose';
import amqplib from 'amqplib';
import { QUEUES } from '@flows-helpdesk/shared';
import { env } from './config/env.js';
import { AuditLog } from './models/index.js';
import { processInboundEmail } from './consumers/inboundEmail.consumer.js';
import { processOutboundEmail } from './consumers/outboundEmail.consumer.js';
import { runSlaCheckCycle } from './schedulers/slaMonitor.js';

async function startWorkers() {
  await mongoose.connect(env.MONGO_URI);
  console.log('[Workers] Connected to MongoDB rs0');

  const conn = await amqplib.connect(env.RABBITMQ_URI);
  const channel = await conn.createChannel();
  await channel.prefetch(5);

  // 1. Audit Log Consumer
  await channel.assertQueue(QUEUES.AUDIT_LOG_WRITE, { durable: true });
  channel.consume(QUEUES.AUDIT_LOG_WRITE, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      await AuditLog.create(data);
      channel.ack(msg);
    } catch (err) {
      console.error('[Workers:Audit] Failed:', err.message);
      channel.nack(msg, false, false);
    }
  });

  // 2. Inbound Email 4-Stage Router Consumer
  channel.consume(QUEUES.EMAIL_INBOUND_RAW, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      const res = await processInboundEmail(payload);
      console.log('[Workers:InboundEmail]', res);
      channel.ack(msg);
    } catch (err) {
      console.error('[Workers:InboundEmail] Failed:', err.message);
      channel.nack(msg, false, false);
    }
  });

  // 3. Outbound SMTP Consumer
  channel.consume(QUEUES.EMAIL_OUTBOUND_SEND, async (msg) => {
    if (!msg) return;
    try {
      const job = JSON.parse(msg.content.toString());
      await processOutboundEmail(job);
      channel.ack(msg);
    } catch (err) {
      console.error('[Workers:OutboundEmail] Failed:', err.message);
      channel.nack(msg, false, false);
    }
  });

  // 4. SLA Escalation Monitor (runs every 60 seconds)
  setInterval(() => {
    runSlaCheckCycle().catch((err) => console.error('[Workers:SLA] Error:', err.message));
  }, 60_000);

  console.log('[Flows Helpdesk Workers] Active & listening on RabbitMQ queues + 60s SLA monitor.');
}

startWorkers().catch((err) => {
  console.error('[Workers] Fatal error:', err);
  process.exit(1);
});
