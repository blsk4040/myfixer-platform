"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
// src/services/email/email.service.ts
const resend_1 = require("resend");
const invoiceTemplate_1 = require("./templates/invoiceTemplate");
const collectionNotificationTemplate_1 = require("./templates/collectionNotificationTemplate");
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new resend_1.Resend(resendApiKey) : null;
const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
const padiWordmarkHtml = `
  <span style="display:inline-flex;align-items:flex-end;color:#FFFFFF;font-size:34px;line-height:1;font-weight:900;letter-spacing:0;">
    <span>Pad</span><span style="display:inline-flex;width:13px;height:31px;margin-left:1px;padding-bottom:2px;align-items:center;justify-content:flex-start;flex-direction:column;">
      <span style="display:block;width:6px;height:6px;margin-bottom:4px;border-radius:999px;background:#B8FF3D;"></span>
      <span style="display:block;width:5px;height:18px;border-radius:999px;background:#FFFFFF;"></span>
    </span>
  </span>
`;
const renderPadiEmail = (args) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.title)}</title>
  </head>
  <body style="margin:0;background:#0B0B0D;color:#F7F7F5;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;">${escapeHtml(args.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0B0D;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#151518;border:1px solid #2A2A30;border-radius:22px;overflow:hidden;">
            <tr>
              <td style="padding:30px 28px 18px;background:#101013;">
                ${padiWordmarkHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 30px;">
                <h1 style="margin:0 0 14px;color:#F7F7F5;font-size:26px;line-height:1.18;font-weight:900;">${escapeHtml(args.title)}</h1>
                <div style="color:#D7D7D2;font-size:15px;line-height:1.62;">
                  ${args.body}
                </div>
                ${args.ctaLabel && args.ctaUrl ? `
                  <p style="margin:26px 0 0;">
                    <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;background:#B8FF3D;color:#0B0B0D;border-radius:14px;text-decoration:none;font-weight:900;">
                      ${escapeHtml(args.ctaLabel)}
                    </a>
                  </p>
                ` : ''}
                ${args.footerNote ? `<p style="margin:24px 0 0;color:#8E8E95;font-size:13px;line-height:1.5;">${escapeHtml(args.footerNote)}</p>` : ''}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;color:#74747C;font-size:12px;">Padi Support</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
class EmailService {
    static async sendNotificationEmail(args) {
        try {
            if (!resend || !process.env.RESEND_FROM_EMAIL) {
                return false;
            }
            const { error } = await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL,
                to: args.recipientEmail,
                subject: args.title,
                html: (0, collectionNotificationTemplate_1.generateCollectionNotificationHtml)(args),
            });
            if (error) {
                console.error('Notification email dispatch failed:', error);
                return false;
            }
            return true;
        }
        catch (err) {
            console.error('Notification email worker failed:', err);
            return false;
        }
    }
    static async sendPasswordResetEmail(args) {
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
        }
        catch (err) {
            console.error('Password reset email worker failed:', err);
            return false;
        }
    }
    static async sendStaffOnboardingEmail(args) {
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
        }
        catch (err) {
            console.error('Staff onboarding email worker failed:', err);
            return false;
        }
    }
    static async sendEmailVerificationEmail(args) {
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
                subject: 'Verify your Padi email address',
                html: renderPadiEmail({
                    preheader: 'Verify your email address to finish setting up your Padi account.',
                    title: 'Verify your email address',
                    body: `
            <p style="margin:0 0 14px;">Hi ${escapeHtml(args.name || 'there')},</p>
            <p style="margin:0 0 14px;">Welcome to Padi.</p>
            <p style="margin:0;">Please verify your email address so we can finish setting up your account and keep your profile secure.</p>
          `,
                    ctaLabel: 'Verify Email',
                    ctaUrl: args.verificationUrl,
                    footerNote: 'If you did not create a Padi account, you can safely ignore this email.',
                }),
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
        }
        catch (err) {
            console.error('Email verification worker failed:', {
                recipientEmail: args.recipientEmail,
                fromEmail: process.env.RESEND_FROM_EMAIL,
                error: err,
            });
            return false;
        }
    }
    static async sendJobInvoiceEmail(args) {
        try {
            if (!resend || !process.env.RESEND_FROM_EMAIL) {
                return false;
            }
            const htmlContent = (0, invoiceTemplate_1.generateInvoiceHtml)({
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
        }
        catch (err) {
            console.error('❌ Failed to execute background email worker:', err);
            return false;
        }
    }
    static async sendQuoteEmail(args) {
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
        }
        catch (err) {
            console.error('Quote email worker failed:', err);
            return false;
        }
    }
    static async sendTechnicianReviewEmail(args) {
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
                ? 'Your Padi Pro application has been approved'
                : isRejected
                    ? 'Update on your Padi Pro application'
                    : `Your Padi Pro application is ${readableStatus}`;
            const reason = isRejected && args.rejectionReason
                ? `<p style="margin:18px 0;padding:14px 16px;border:1px solid #34343A;border-radius:14px;background:#101013;"><strong style="color:#F7F7F5;">Reason:</strong><br/>${escapeHtml(args.rejectionReason)}</p>`
                : '';
            const body = isApproved
                ? `
          <p style="margin:0 0 14px;">Hi ${escapeHtml(args.technicianName || 'there')},</p>
          <p style="margin:0 0 14px;">Good news. Your Padi Pro application has been approved.</p>
          <p style="margin:0 0 14px;">You can now sign in to the Padi Pro app, complete any remaining profile steps, and go live when you are ready to receive jobs.</p>
          <p style="margin:0;">Before going live, please make sure your profile, service categories and availability are up to date.</p>
        `
                : isRejected
                    ? `
            <p style="margin:0 0 14px;">Hi ${escapeHtml(args.technicianName || 'there')},</p>
            <p style="margin:0 0 14px;">Thank you for applying to join Padi Pro.</p>
            <p style="margin:0;">We are not able to approve your application at this time.</p>
            ${reason}
            <p style="margin:0;">You can update your profile or contact Padi Support if you believe this was a mistake or would like us to review your application again.</p>
          `
                    : `
            <p style="margin:0 0 14px;">Hi ${escapeHtml(args.technicianName || 'there')},</p>
            <p style="margin:0 0 14px;">Your Padi Pro application status is now <strong style="color:#F7F7F5;">${escapeHtml(readableStatus)}</strong>.</p>
            <p style="margin:0;">Please contact Padi Support if you need help with your application.</p>
          `;
            const { data, error } = await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL,
                to: args.recipientEmail,
                subject,
                html: renderPadiEmail({
                    preheader: isApproved
                        ? 'Your Padi Pro application has been approved.'
                        : isRejected
                            ? 'There is an update on your Padi Pro application.'
                            : `Your Padi Pro application is ${readableStatus}.`,
                    title: isApproved
                        ? 'Application approved'
                        : isRejected
                            ? 'Application update'
                            : 'Application status updated',
                    body,
                    ctaLabel: isApproved ? 'Open Padi Pro' : isRejected ? 'Contact Support' : undefined,
                    ctaUrl: isApproved
                        ? (process.env.TECHNICIAN_APP_DEEP_LINK || process.env.CLIENT_APP_URL || '#')
                        : isRejected
                            ? (process.env.CLIENT_APP_URL || '#')
                            : undefined,
                    footerNote: 'Thank you, The Padi Team',
                }),
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
        }
        catch (err) {
            console.error('Technician review email worker failed:', {
                recipientEmail: args.recipientEmail,
                status: args.status,
                error: err,
            });
            return false;
        }
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map