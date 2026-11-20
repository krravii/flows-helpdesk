import { QUEUES } from '@flows-helpdesk/shared';
import { getRabbitChannel } from '../infra/rabbitmq.js';
import { AuditLog } from '../models/AdminModels.js';

export async function logAudit({ req, action, module, target = '', details = '' }) {
  const payload = {
    userId: req?.user?.id || null,
    userName: req?.user?.fullName || 'System',
    action,
    module,
    target,
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '127.0.0.1',
    details
  };

  try {
    const ch = getRabbitChannel();
    ch.sendToQueue(QUEUES.AUDIT_LOG_WRITE, Buffer.from(JSON.stringify(payload)), { persistent: true });
  } catch {
    await AuditLog.create(payload);
  }
}
