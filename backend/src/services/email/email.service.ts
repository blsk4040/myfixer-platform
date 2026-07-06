// src/services/email/email.service.ts
import { Resend } from 'resend';
import { generateInvoiceHtml } from './templates/invoiceTemplate';
import { generateCollectionNotificationHtml } from './templates/collectionNotificationTemplate';
import { CurrencyCode } from '../../config/market.config';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface SendInvoiceEmailArgs {
  recipientEmail: string;
  customerName: string;
  bookingId: string;
  baseAmount: number;
  additionalLabor: number;
  partsAmount: number;
  totalAmount: number;
  currency: CurrencyCode;
}

interface SendPasswordResetEmailArgs {
  recipientEmail: string;
  name: string;
  resetUrl: string;
}

interface SendNotificationEmailArgs {
  recipientEmail: string;
  title: string;
  message: string;
  customerName?: string;
  collectionDate?: string;
  address?: string;
}

interface SendQuoteEmailArgs {
  recipientEmail: string;
  customerName: string;
  bookingId: string;
  totalAmount: number;
  currency: CurrencyCode;
  lineItems: Array<{ label: string; quantity: number; totalAmountMinor: number }>;
}

export class EmailService {
  static async sendNotificationEmail(args: SendNotificationEmailArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        return false;
      }

      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject: args.title,
        html: generateCollectionNotificationHtml(args),
      });

      if (error) {
        console.error('Notification email dispatch failed:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Notification email worker failed:', err);
      return false;
    }
  }

  static async sendPasswordResetEmail(args: SendPasswordResetEmailArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        return false;
      }

      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject: 'Reset your MyFixer admin password',
        html: `
          <p>Hello ${args.name || 'there'},</p>
          <p>We received a request to reset your MyFixer admin password.</p>
          <p><a href="${args.resetUrl}">Reset your password</a></p>
          <p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
        `,
      });

      if (error) {
        console.error('Password reset email dispatch failed:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Password reset email worker failed:', err);
      return false;
    }
  }

  static async sendJobInvoiceEmail(args: SendInvoiceEmailArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        return false;
      }

      const htmlContent = generateInvoiceHtml({
        customerName: args.customerName,
        bookingId: args.bookingId,
        baseAmount: args.baseAmount,
        additionalLabor: args.additionalLabor,
        partsAmount: args.partsAmount,
        totalAmount: args.totalAmount,
        currency: args.currency,
      });

      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject: `🔒 Tax Invoice Summary for Job #${args.bookingId}`,
        html: htmlContent,
      });

      if (error) {
        console.error('❌ Resend API Dispatch Error Matrix:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Failed to execute background email worker:', err);
      return false;
    }
  }

  static async sendQuoteEmail(args: SendQuoteEmailArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        return false;
      }

      const rows = args.lineItems.map((item) => `
        <tr>
          <td>${item.label}</td>
          <td>${item.quantity}</td>
          <td>${args.currency} ${(item.totalAmountMinor / 100).toFixed(2)}</td>
        </tr>
      `).join('');

      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject: `MyFixer quote for booking #${args.bookingId}`,
        html: `
          <p>Hello ${args.customerName || 'Client'},</p>
          <p>Your technician sent a quote for approval.</p>
          <table cellpadding="8" cellspacing="0" border="1">
            <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p><strong>Total: ${args.currency} ${args.totalAmount.toFixed(2)}</strong></p>
          <p>Please open MyFixer to approve or reject this quote.</p>
        `,
      });

      if (error) {
        console.error('Quote email dispatch failed:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Quote email worker failed:', err);
      return false;
    }
  }
}
