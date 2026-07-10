import crypto from 'crypto';

const deriveKey = (): Buffer => {
  const configured = process.env.PAYOUT_DATA_ENCRYPTION_KEY?.trim();
  if (configured) {
    const raw = Buffer.from(configured, configured.length === 64 ? 'hex' : 'utf8');
    return raw.length === 32 ? raw : crypto.createHash('sha256').update(raw).digest();
  }
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    throw new Error('PAYOUT_DATA_ENCRYPTION_KEY is required in production.');
  }
  return crypto.createHash('sha256').update('myfixer-development-payout-key').digest();
};

export const encryptPayoutValue = (value: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
};

export const decryptPayoutValue = (payload: string): string => {
  const [ivHex, tagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted payout payload.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};

export const maskAccountNumber = (value: string): string => {
  const digits = value.replace(/\s+/g, '');
  return digits.length <= 4 ? '****' : `****${digits.slice(-4)}`;
};

export const maskPhoneNumber = (value: string): string => {
  const compact = value.replace(/\s+/g, '');
  return compact.length <= 4 ? '****' : `${compact.slice(0, 3)}****${compact.slice(-2)}`;
};
