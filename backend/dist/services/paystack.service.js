"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = exports.verifyPaystackSignature = exports.calculatePaystackSignature = exports.validatePaystackStartupConfiguration = void 0;
// src/services/paystack.service.ts
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const getPaystackSecretKey = () => (process.env.PAYSTACK_SECRET_KEY || '').trim();
const getPaystackWebhookSecret = () => (process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '').trim();
const getPaystackBaseUrl = () => (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').trim().replace(/\/+$/, '');
const getPaystackTimeoutMs = () => Number(process.env.PAYSTACK_REQUEST_TIMEOUT_MS || 10000);
const getPaystackTransferSource = () => (process.env.PAYSTACK_TRANSFER_SOURCE || 'balance').trim();
const createPaystackClient = () => {
    const secret = getPaystackSecretKey();
    return axios_1.default.create({
        baseURL: getPaystackBaseUrl(),
        timeout: getPaystackTimeoutMs(),
        headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
        },
    });
};
const assertPaystackConfigured = () => {
    if (!getPaystackSecretKey()) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured.');
    }
};
const validatePaystackStartupConfiguration = () => {
    const enabled = (process.env.PAYSTACK_ENABLED || 'true').trim().toLowerCase() !== 'false';
    if (!enabled)
        return;
    if (!getPaystackSecretKey()) {
        throw new Error('PAYSTACK_SECRET_KEY must be configured when PAYSTACK_ENABLED=true.');
    }
    if (!getPaystackWebhookSecret()) {
        throw new Error('PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY must be configured when PAYSTACK_ENABLED=true.');
    }
};
exports.validatePaystackStartupConfiguration = validatePaystackStartupConfiguration;
const calculatePaystackSignature = (rawBody, secret = getPaystackWebhookSecret()) => crypto_1.default.createHmac('sha512', secret).update(rawBody).digest('hex');
exports.calculatePaystackSignature = calculatePaystackSignature;
const verifyPaystackSignature = (rawBody, signature) => {
    const secret = getPaystackWebhookSecret();
    if (!secret || !signature)
        return false;
    const expected = (0, exports.calculatePaystackSignature)(rawBody, secret);
    const provided = signature.trim();
    if (expected.length !== provided.length)
        return false;
    return crypto_1.default.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
};
exports.verifyPaystackSignature = verifyPaystackSignature;
class PaystackService {
    static async initializeTransaction(input) {
        assertPaystackConfigured();
        const response = await createPaystackClient().post('/transaction/initialize', {
            email: input.email,
            amount: input.amountMinor,
            currency: input.currency,
            reference: input.reference,
            callback_url: input.callbackUrl,
            metadata: input.metadata,
        });
        return response.data;
    }
    static async verifyTransaction(reference) {
        assertPaystackConfigured();
        const response = await createPaystackClient().get(`/transaction/verify/${encodeURIComponent(reference)}`);
        return response.data;
    }
    static async chargeToken(email, amountMinor, authCode, reference, currency) {
        assertPaystackConfigured();
        const response = await createPaystackClient().post('/transaction/charge_authorization', {
            email,
            amount: amountMinor,
            currency,
            authorization_code: authCode,
            reference,
        });
        return response.data;
    }
    static async listBanks(country) {
        assertPaystackConfigured();
        const response = await createPaystackClient().get('/bank', {
            params: country ? { country } : undefined,
        });
        return response.data;
    }
    static async resolveBankAccount(accountNumber, bankCode) {
        assertPaystackConfigured();
        const response = await createPaystackClient().get('/bank/resolve', {
            params: { account_number: accountNumber, bank_code: bankCode },
        });
        return response.data;
    }
    static async createTransferRecipient(input) {
        assertPaystackConfigured();
        const payload = {
            type: input.type,
            name: input.name,
            currency: input.currency,
            metadata: input.metadata,
        };
        if (input.accountNumber)
            payload.account_number = input.accountNumber;
        if (input.bankCode)
            payload.bank_code = input.bankCode;
        if (input.mobileNumber)
            payload.phone = input.mobileNumber;
        if (input.operatorCode)
            payload.operator = input.operatorCode;
        const response = await createPaystackClient().post('/transferrecipient', payload);
        return response.data;
    }
    static async initiateTransfer(input) {
        assertPaystackConfigured();
        const response = await createPaystackClient().post('/transfer', {
            source: getPaystackTransferSource(),
            amount: input.amountMinor,
            currency: input.currency,
            recipient: input.recipientCode,
            reason: input.reason,
            reference: input.reference,
        });
        return response.data;
    }
    static async verifyTransfer(referenceOrCode) {
        assertPaystackConfigured();
        const response = await createPaystackClient().get(`/transfer/verify/${encodeURIComponent(referenceOrCode)}`);
        return response.data;
    }
}
exports.PaystackService = PaystackService;
//# sourceMappingURL=paystack.service.js.map