"use strict";
// src/services/email/templates/invoiceTemplate.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoiceHtml = generateInvoiceHtml;
const formatMoney = (amount, currency) => new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
}).format(amount);
function generateInvoiceHtml({ customerName, bookingId, baseAmount, additionalLabor, partsAmount, discountAmount = 0, promoCode = '', promotionLabel = '', clientServiceFee = 0, taxAmount = 0, subtotalAmount, totalAmount, currency, }) {
    const displayPromotion = promotionLabel || promoCode || 'Promotion';
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tax Invoice - MyFixer</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; margin: 0; padding: 0; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 40px 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background-color: #090D14; padding: 32px; text-align: center; }
        .logo { color: #00FF87; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .content { padding: 32px; }
        h1 { font-size: 20px; font-weight: 700; margin-top: 0; color: #0F172A; }
        .meta-box { background-color: #F1F5F9; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 14px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .table th { text-align: left; padding-bottom: 8px; border-bottom: 2px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 700; text-transform: uppercase; }
        .table td { padding: 12px 0; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
        .total-row td { border-top: 2px solid #0F172A; border-bottom: none; font-weight: 700; font-size: 16px; padding-top: 16px; }
        .footer { text-align: center; padding: 24px; font-size: 12px; color: #94A3B8; background-color: #F8FAFC; border-top: 1px solid #E2E8F0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <div class="logo">MyFixer</div>
          </div>
          <div class="content">
            <h1>Tax Invoice</h1>
            <p>Hi ${customerName},</p>
            <p>Thank you for using MyFixer. Your appliance repair job is complete. Please find your official breakdown summary listed below.</p>
            
            <div class="meta-box">
              <strong>Invoice ID:</strong> #INV-${bookingId}<br />
              <strong>Date:</strong> ${new Date().toLocaleDateString('en-ZA')}<br />
              <strong>Status:</strong> PAID / SETTLED
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Base Diagnostic & Call-Out Fee</td>
                  <td style="text-align: right;">${formatMoney(baseAmount, currency)}</td>
                </tr>
                ${additionalLabor > 0 ? `
                <tr>
                  <td>Extended Repair Labor Charges</td>
                  <td style="text-align: right;">${formatMoney(additionalLabor, currency)}</td>
                </tr>` : ''}
                ${partsAmount > 0 ? `
                <tr>
                  <td>Acquired Materials & Component Parts</td>
                  <td style="text-align: right;">${formatMoney(partsAmount, currency)}</td>
                </tr>` : ''}
                ${discountAmount > 0 ? `
                <tr>
                  <td>${displayPromotion}</td>
                  <td style="text-align: right; color: #DC2626;">-${formatMoney(discountAmount, currency)}</td>
                </tr>` : ''}
                ${typeof subtotalAmount === 'number' ? `
                <tr>
                  <td>Subtotal</td>
                  <td style="text-align: right;">${formatMoney(subtotalAmount, currency)}</td>
                </tr>` : ''}
                ${clientServiceFee > 0 ? `
                <tr>
                  <td>Client Service Fee</td>
                  <td style="text-align: right;">${formatMoney(clientServiceFee, currency)}</td>
                </tr>` : ''}
                ${taxAmount > 0 ? `
                <tr>
                  <td>Tax</td>
                  <td style="text-align: right;">${formatMoney(taxAmount, currency)}</td>
                </tr>` : ''}
                <tr class="total-row">
                  <td>Total Settled Balance</td>
                  <td style="text-align: right; color: #00B961;">${formatMoney(totalAmount, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="footer">
            MyFixer Appliance Repairs &bull; Support: support@myfixer.co.za
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
//# sourceMappingURL=invoiceTemplate.js.map