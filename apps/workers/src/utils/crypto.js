import crypto from 'node:crypto';
import { env } from '../config/env.js';

const KEY = Buffer.from(env.CREDENTIALS_ENCRYPTION_KEY, 'hex');

export function decryptSecret(cipherText) {
  if (!cipherText || !cipherText.includes(':')) return cipherText || '';
  const [ivHex, tagHex, encHex] = cipherText.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
