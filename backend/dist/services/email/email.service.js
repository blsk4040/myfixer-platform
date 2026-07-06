"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
// src/services/email/email.service.ts
const resend_1 = require("resend");
const invoiceTemplate_1 = require("./templates/invoiceTemplate");
const collectionNotificationTemplate_1 = require("./templates/collectionNotificationTemplate");
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new resend_1.Resend(resendApiKey) : null;
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
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map