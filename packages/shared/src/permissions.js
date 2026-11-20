export const PERMISSION_KEYS = [
  // Dashboard
  'dashboard.view', 'dashboard.analytics', 'dashboard.personal', 'dashboard.organisation',
  // Tickets
  'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.delete',
  'tickets.assign', 'tickets.reassign', 'tickets.status', 'tickets.priority',
  'tickets.reply_public', 'tickets.note_add', 'tickets.note_view', 'tickets.history',
  'tickets.attachments_view', 'tickets.attachments_upload', 'tickets.attachments_delete',
  'tickets.close', 'tickets.reopen', 'tickets.export', 'tickets.bulk',
  // Organisations
  'orgs.view', 'orgs.create', 'orgs.edit', 'orgs.delete', 'orgs.disable',
  'orgs.users_view', 'orgs.users_manage', 'orgs.domains', 'orgs.emails', 'orgs.tickets_view',
  // Users
  'users.view', 'users.create', 'users.edit', 'users.delete', 'users.disable',
  'users.invite', 'users.reset_password', 'users.assign_roles',
  // Engineers
  'engineers.view', 'engineers.create', 'engineers.edit', 'engineers.availability',
  'engineers.assign', 'engineers.performance',
  // Reports
  'reports.view', 'reports.export', 'reports.org', 'reports.engineer', 'reports.global',
  // Email Configuration
  'email.view', 'email.imap_edit', 'email.smtp_edit', 'email.test', 'email.routing', 'email.logs',
  // Email Templates
  'templates.view', 'templates.create', 'templates.edit', 'templates.delete', 'templates.preview',
  // Roles & Permissions
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete', 'roles.permissions', 'roles.assign',
  // Audit Logs
  'audit.view', 'audit.export',
  // System Settings
  'settings.view', 'settings.edit', 'settings.config'
];
