export const EXCHANGES = {
  EVENTS: 'flows.helpdesk.events',
  DLX: 'flows.helpdesk.dlx'
};

export const QUEUES = {
  EMAIL_INBOUND_RAW: 'email.inbound.raw',
  EMAIL_OUTBOUND_SEND: 'email.outbound.send',
  SLA_EVALUATE: 'sla.evaluate',
  AUDIT_LOG_WRITE: 'audit.log.write',
  DEAD_LETTER: 'flows.helpdesk.dlq'
};
