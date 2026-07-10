// src/services/paystack.service.ts
import axios from 'axios';
import crypto from 'crypto';
import { CurrencyCode } from '../config/market.config';

const getPaystackSecretKey = (): string => (process.env.PAYSTACK_SECRET_KEY || '').trim();
const getPaystackWebhookSecret = (): string => (process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '').trim();
const getPaystackBaseUrl = (): string => (process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co').trim().replace(/\/+$/, '');
const getPaystackTimeoutMs = (): number => Number(process.env.PAYSTACK_REQUEST_TIMEOUT_MS || 10000);
const getPaystackTransferSource = (): string => (process.env.PAYSTACK_TRANSFER_SOURCE || 'balance').trim();

const createPaystackClient = () => {
  const secret = getPaystackSecretKey();
  return axios.create({
    baseURL: getPaystackBaseUrl(),
    timeout: getPaystackTimeoutMs(),
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  });
};

export interface PaystackInitializeInput {
  email: string;
  amountMinor: number;
  currency: CurrencyCode;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackVerificationData {
  status: boolean;
  data: {
    id?: number | string;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
    gateway_response?: string;
    customer?: {
      email?: string;
      customer_code?: string;
    };
    metadata?: Record<string, unknown>;
    authorization?: {
      reusable?: boolean;
      authorization_code?: string;
      signature?: string;
      brand?: string;
      bank?: string;
      country_code?: string;
      last4?: string;
      exp_month?: string;
      exp_year?: string;
      card_type?: string;
    };
  };
}

export interface PaystackTransferRecipientInput {
  type: string;
  name: string;
  accountNumber?: string;
  bankCode?: string;
  mobileNumber?: string;
  operatorCode?: string;
  currency: CurrencyCode;
  metadata?: Record<string, unknown>;
}

export interface PaystackTransferInput {
  amountMinor: number;
  currency: CurrencyCode;
  recipientCode: string;
  reference: string;
  reason: string;
}

const assertPaystackConfigured = () => {
  if (!getPaystackSecretKey()) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  }
};

export const validatePaystackStartupConfiguration = (): void => {
  const enabled = (process.env.PAYSTACK_ENABLED || 'true').trim().toLowerCase() !== 'false';
  if (!enabled) return;
  if (!getPaystackSecretKey()) {
    throw new Error('PAYSTACK_SECRET_KEY must be configured when PAYSTACK_ENABLED=true.');
  }
  if (!getPaystackWebhookSecret()) {
    throw new Error('PAYSTACK_WEBHOOK_SECRET or PAYSTACK_SECRET_KEY must be configured when PAYSTACK_ENABLED=true.');
  }
};

export const calculatePaystackSignature = (rawBody: Buffer | string, secret = getPaystackWebhookSecret()): string =>
  crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

export const verifyPaystackSignature = (rawBody: Buffer | string, signature: string | undefined): boolean => {
  const secret = getPaystackWebhookSecret();
  if (!secret || !signature) return false;
  const expected = calculatePaystackSignature(rawBody, secret);
  const provided = signature.trim();
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
};

export class PaystackService {
  static async initializeTransaction(input: PaystackInitializeInput) {
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

  static async verifyTransaction(reference: string): Promise<PaystackVerificationData> {
    assertPaystackConfigured();
    const response = await createPaystackClient().get(`/transaction/verify/${encodeURIComponent(reference)}`);
    return response.data;
  }

  static async chargeToken(
    email: string,
    amountMinor: number,
    authCode: string,
    reference: string,
    currency: CurrencyCode
  ) {
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

  static async listBanks(country?: string) {
    assertPaystackConfigured();
    const response = await createPaystackClient().get('/bank', {
      params: country ? { country } : undefined,
    });
    return response.data;
  }

  static async resolveBankAccount(accountNumber: string, bankCode: string) {
    assertPaystackConfigured();
    const response = await createPaystackClient().get('/bank/resolve', {
      params: { account_number: accountNumber, bank_code: bankCode },
    });
    return response.data;
  }

  static async createTransferRecipient(input: PaystackTransferRecipientInput) {
    assertPaystackConfigured();
    const payload: Record<string, unknown> = {
      type: input.type,
      name: input.name,
      currency: input.currency,
      metadata: input.metadata,
    };
    if (input.accountNumber) payload.account_number = input.accountNumber;
    if (input.bankCode) payload.bank_code = input.bankCode;
    if (input.mobileNumber) payload.phone = input.mobileNumber;
    if (input.operatorCode) payload.operator = input.operatorCode;
    const response = await createPaystackClient().post('/transferrecipient', payload);
    return response.data;
  }

  static async initiateTransfer(input: PaystackTransferInput) {
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

  static async verifyTransfer(referenceOrCode: string) {
    assertPaystackConfigured();
    const response = await createPaystackClient().get(`/transfer/verify/${encodeURIComponent(referenceOrCode)}`);
    return response.data;
  }
}
