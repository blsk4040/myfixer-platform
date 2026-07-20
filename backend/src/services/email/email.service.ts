// src/services/email/email.service.ts
import { Resend } from 'resend';
import { generateInvoiceHtml } from './templates/invoiceTemplate';
import { generateCollectionNotificationHtml } from './templates/collectionNotificationTemplate';
import { IsoCurrencyCode } from '../../config/market.config';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface SendInvoiceEmailArgs {
  recipientEmail: string;
  customerName: string;
  bookingId: string;
  baseAmount: number;
  additionalLabor: number;
  partsAmount: number;
  discountAmount?: number;
  promoCode?: string;
  promotionLabel?: string;
  clientServiceFee?: number;
  taxAmount?: number;
  subtotalAmount?: number;
  totalAmount: number;
  currency: IsoCurrencyCode;
}

interface SendPasswordResetEmailArgs {
  recipientEmail: string;
  name: string;
  resetUrl: string;
}

interface SendStaffOnboardingEmailArgs {
  recipientEmail: string;
  name: string;
  portalUrl: string;
  username: string;
  temporaryPassword: string;
}

interface SendEmailVerificationArgs {
  recipientEmail: string;
  name: string;
  verificationUrl: string;
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
  currency: IsoCurrencyCode;
  lineItems: Array<{ label: string; quantity: number; totalAmountMinor: number }>;
}

interface SendTechnicianReviewEmailArgs {
  recipientEmail: string;
  technicianName: string;
  status: string;
  rejectionReason?: string;
}

const padiWordmarkHtml = `
  <span style="display:inline-flex;align-items:flex-end;color:#111827;font-size:28px;line-height:1;font-weight:900;letter-spacing:0;">
    <span>Pad</span><span style="display:inline-flex;width:13px;height:29px;margin-left:1px;padding-bottom:2px;align-items:center;justify-content:flex-end;flex-direction:column;">
      <span style="display:block;width:6px;height:6px;margin-bottom:4px;border-radius:999px;background:#B8FF3D;"></span>
      <span style="display:block;width:5px;height:15px;border-radius:999px;background:#111827;"></span>
    </span>
  </span>
`;

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

  static async sendStaffOnboardingEmail(args: SendStaffOnboardingEmailArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        return false;
      }

      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject: 'Your MyFixer internal portal access',
        html: `
          <p>Hello ${args.name || 'there'},</p>
          <p>Your MyFixer internal staff account has been created.</p>
          <p><strong>Portal:</strong> <a href="${args.portalUrl}">${args.portalUrl}</a></p>
          <p><strong>Username:</strong> ${args.username}</p>
          <p><strong>Temporary password:</strong> ${args.temporaryPassword}</p>
          <p>You will be asked to change this temporary password the first time you sign in.</p>
          <p>If you were not expecting this account, contact MyFixer support immediately.</p>
        `,
      });

      if (error) {
        console.error('Staff onboarding email dispatch failed:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Staff onboarding email worker failed:', err);
      return false;
    }
  }

  static async sendEmailVerificationEmail(args: SendEmailVerificationArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        console.warn('Email verification dispatch skipped: Resend is not fully configured.', {
          hasResendApiKey: Boolean(resend),
          hasFromEmail: Boolean(process.env.RESEND_FROM_EMAIL),
        });
        return false;
      }

      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject: 'Verify your Padi email',
        html: `
          <p>${padiWordmarkHtml}</p>
          <p>Hello ${args.name || 'there'},</p>
          <p>Please verify your email address to finish setting up your Padi account.</p>
          <p><a href="${args.verificationUrl}">Verify email</a></p>
          <p>If you did not create this account, you can ignore this email.</p>
        `,
      });

      if (error) {
        console.error('Email verification dispatch failed:', {
          recipientEmail: args.recipientEmail,
          fromEmail: process.env.RESEND_FROM_EMAIL,
          error,
        });
        return false;
      }

      console.info('Email verification dispatched via Resend:', {
        recipientEmail: args.recipientEmail,
        fromEmail: process.env.RESEND_FROM_EMAIL,
        messageId: data?.id,
      });

      return true;
    } catch (err) {
      console.error('Email verification worker failed:', {
        recipientEmail: args.recipientEmail,
        fromEmail: process.env.RESEND_FROM_EMAIL,
        error: err,
      });
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
        discountAmount: args.discountAmount,
        promoCode: args.promoCode,
        promotionLabel: args.promotionLabel,
        clientServiceFee: args.clientServiceFee,
        taxAmount: args.taxAmount,
        subtotalAmount: args.subtotalAmount,
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

  static async sendTechnicianReviewEmail(args: SendTechnicianReviewEmailArgs): Promise<boolean> {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) {
        console.warn('Technician review email skipped: Resend is not fully configured.', {
          hasResendApiKey: Boolean(resend),
          hasFromEmail: Boolean(process.env.RESEND_FROM_EMAIL),
        });
        return false;
      }

      const normalizedStatus = args.status.toUpperCase();
      const isApproved = normalizedStatus === 'APPROVED';
      const isRejected = normalizedStatus === 'REJECTED';
      const readableStatus = normalizedStatus.toLowerCase().replace(/_/g, ' ');
      const subject = isApproved
        ? 'Your MyFixer Pro application has been approved'
        : `Your MyFixer Pro application is ${readableStatus}`;
      const nextStep = isApproved
        ? '<p>You can now sign in to the MyFixer Technician app and go live when you are ready to receive jobs.</p>'
        : '<p>Please contact MyFixer support if you need help with your application.</p>';
      const reason = isRejected && args.rejectionReason
        ? `<p><strong>Reason:</strong> ${args.rejectionReason}</p>`
        : '';

      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.recipientEmail,
        subject,
        html: `
          <p>Hello ${args.technicianName || 'there'},</p>
          <p>Your MyFixer Pro application status is now <strong>${readableStatus}</strong>.</p>
          ${reason}
          ${nextStep}
          <p>Thank you,<br/>The MyFixer Team</p>
        `,
      });

      if (error) {
        console.error('Technician review email dispatch failed:', {
          recipientEmail: args.recipientEmail,
          status: args.status,
          error,
        });
        return false;
      }

      console.info('Technician review email dispatched via Resend:', {
        recipientEmail: args.recipientEmail,
        status: args.status,
        messageId: data?.id,
      });

      return true;
    } catch (err) {
      console.error('Technician review email worker failed:', {
        recipientEmail: args.recipientEmail,
        status: args.status,
        error: err,
      });
      return false;
    }
  }
}
