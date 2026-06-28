// src/services/paystack.service.ts
import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystackClient = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

export class PaystackService {
  /**
   * Validates reference transaction state on Paystack's nodes
   */
  static async verifyTransaction(reference: string) {
    const response = await paystackClient.get(`/transaction/verify/${reference}`);
    return response.data;
  }

  /**
   * Executes a headless recurring debit charge on an authorized token string
   */
  static async chargeToken(email: string, amountInCents: number, authCode: string, reference: string) {
    const response = await paystackClient.post('/transaction/charge_authorization', {
      email,
      amount: amountInCents, // Amount must be passed in minor units (cents / kobo)
      authorization_code: authCode,
      reference,
    });
    return response.data;
  }
}