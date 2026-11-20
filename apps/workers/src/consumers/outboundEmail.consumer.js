import nodemailer from 'nodemailer';
import { SystemSetting, EmailLog } from '../models/index.js';
import { decryptSecret } from '../utils/crypto.js';

export async function processOutboundEmail(job) {
  const { ticketNumber, to, cc, subject, bodyText, bodyHtml, messageId, inReplyTo } = job;
  const settings = await SystemSetting.findById('global').lean();

  if (!settings?.smtp?.enabled || !settings?.smtp?.host) {
    console.log(`[SMTP Worker] SMTP disabled — logged simulated outbound reply for ${ticketNumber} -> ${to}`);
    await EmailLog.create({
      sender: 'support@sinchflows.io',
      subject,
      result: 'SMTP Simulated (Relay Disabled)',
      ticketNumber,
      orgName: to
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port || 587,
    secure: settings.smtp.port === 465,
    auth: settings.smtp.username
      ? {
          user: settings.smtp.username,
          pass: decryptSecret(settings.smtp.encryptedPassword)
        }
      : undefined
  });

  await transporter.sendMail({
    from: `"${settings.smtp.senderName || 'Flows Helpdesk'}" <${settings.smtp.senderEmail || 'support@sinchflows.io'}>`,
    to,
    cc: cc || undefined,
    subject,
    text: bodyText,
    html: bodyHtml,
    messageId,
    inReplyTo,
    references: inReplyTo ? [inReplyTo] : undefined
  });

  await EmailLog.create({
    sender: settings.smtp.senderEmail,
    subject,
    result: 'SMTP Dispatched',
    ticketNumber,
    orgName: to
  });
}
