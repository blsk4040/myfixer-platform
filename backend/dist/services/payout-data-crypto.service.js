"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPhoneNumber = exports.maskAccountNumber = exports.decryptPayoutValue = exports.encryptPayoutValue = void 0;
const crypto_1 = __importDefault(require("crypto"));
const deriveKey = () => {
    const configured = process.env.PAYOUT_DATA_ENCRYPTION_KEY?.trim();
    if (configured) {
        const raw = Buffer.from(configured, configured.length === 64 ? 'hex' : 'utf8');
        return raw.length === 32 ? raw : crypto_1.default.createHash('sha256').update(raw).digest();
    }
    if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
        throw new Error('PAYOUT_DATA_ENCRYPTION_KEY is required in production.');
    }
    return crypto_1.default.createHash('sha256').update('myfixer-development-payout-key').digest();
};
const encryptPayoutValue = (value) => {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', deriveKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
};
exports.encryptPayoutValue = encryptPayoutValue;
const decryptPayoutValue = (payload) => {
    const [ivHex, tagHex, encryptedHex] = payload.split(':');
    if (!ivHex || !tagHex || !encryptedHex)
        throw new Error('Invalid encrypted payout payload.');
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};
exports.decryptPayoutValue = decryptPayoutValue;
const maskAccountNumber = (value) => {
    const digits = value.replace(/\s+/g, '');
    return digits.length <= 4 ? '****' : `****${digits.slice(-4)}`;
};
exports.maskAccountNumber = maskAccountNumber;
const maskPhoneNumber = (value) => {
    const compact = value.replace(/\s+/g, '');
    return compact.length <= 4 ? '****' : `${compact.slice(0, 3)}****${compact.slice(-2)}`;
};
exports.maskPhoneNumber = maskPhoneNumber;
//# sourceMappingURL=payout-data-crypto.service.js.map