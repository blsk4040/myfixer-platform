"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = void 0;
// src/services/paystack.service.ts
const axios_1 = __importDefault(require("axios"));
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const paystackClient = axios_1.default.create({
    baseURL: 'https://api.paystack.co',
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
    },
});
class PaystackService {
    /**
     * Validates reference transaction state on Paystack's nodes
     */
    static async verifyTransaction(reference) {
        const response = await paystackClient.get(`/transaction/verify/${reference}`);
        return response.data;
    }
    /**
     * Executes a headless recurring debit charge on an authorized token string
     */
    static async chargeToken(email, amountInCents, authCode, reference) {
        const response = await paystackClient.post('/transaction/charge_authorization', {
            email,
            amount: amountInCents, // Amount must be passed in minor units (cents / kobo)
            authorization_code: authCode,
            reference,
        });
        return response.data;
    }
}
exports.PaystackService = PaystackService;
//# sourceMappingURL=paystack.service.js.map