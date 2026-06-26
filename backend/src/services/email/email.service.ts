// src/services/email/email.service.ts
import { Resend } from 'resend';
import { generateInvoiceHtml } from './templates/invoiceTemplate';

// Replace with your real RESEND_API_KEY from your .env configuration
const resend = new Resend(process.env.RESEND_API_KEY || 're_your_free_key');

interface SendInvoiceEmailArgs {
  recipientEmail: string;
  customerName: string;
  bookingId: string;
  baseAmount: number;
  additionalLabor: number;
  partsAmount: number;
  totalAmount: number;
}

export class EmailService {
  static async sendJobInvoiceEmail(args: SendInvoiceEmailArgs): Promise<boolean> {
    try {
      const htmlContent = generateInvoiceHtml({
        customerName: args.customerName,
        bookingId: args.bookingId,
        baseAmount: args.baseAmount,
        additionalLabor: args.additionalLabor,
        partsAmount: args.partsAmount,
        totalAmount: args.totalAmount
      });

      const { data, error } = await resend.emails.send({
        // Note: On the free tier domain sandbox, you can only send to your OWN verified register email.
        // Once you verify your custom domain on Resend (free), you can send to any 'args.recipientEmail'!
        from: 'MyFixer Receipts <onboarding@resend.dev>',
        to: process.env.NODE_ENV === 'production' ? args.recipientEmail : 'your-test-email@gmail.com',
        subject: `🔒 Tax Invoice Summary for Job #${args.bookingId}`,
        html: htmlContent,
      });

      if (error) {
        console.error('❌ Resend API Dispatch Error Matrix:', error);
        return false;
      }

      console.log('📬 Transactional Email Dispatched Successfully via Resend:', data?.id);
      return true;
    } catch (err) {
      console.error('❌ Failed to execute background email worker:', err);
      return false;
    }
  }
}