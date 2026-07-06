// src/services/paystack.service.ts
import axios from 'axios';
import { CurrencyCode } from '../config/market.config';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystackClient = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

const assertPaystackConfigured = () => {
  if (!PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }
};

export class PaystackService {
  /**
   * Validates reference transaction state on Paystack's nodes
   */
  static async verifyTransaction(reference: string) {
    assertPaystackConfigured();
    const response = await paystackClient.get(`/transaction/verify/${reference}`);
    return response.data;
  }

  /**
   * Executes a headless recurring debit charge on an authorized token string
   */
  static async chargeToken(
    email: string,
    amountMinor: number,
    authCode: string,
    reference: string,
    currency: CurrencyCode
  ) {
    assertPaystackConfigured();
    const response = await paystackClient.post('/transaction/charge_authorization', {
      email,
      amount: amountMinor,
      currency,
      authorization_code: authCode,
      reference,
    });
    return response.data;
  }
}
