"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCollectionNotificationHtml = void 0;
const padiLogoUrl = 'https://res.cloudinary.com/vyvx5tco/image/upload/v1787588752/email_head.png';
const padiLogoHtml = `
  <img src="${padiLogoUrl}" width="156" alt="Padi" style="display:block;width:156px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
`;
const generateCollectionNotificationHtml = (args) => `
  <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; background:#F8FAFC; padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;overflow:hidden;">
      <div style="background:#0B0B0D;padding:26px 28px;text-align:center;"><div style="display:inline-block;">${padiLogoHtml}</div></div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 8px;color:#111827;">${args.title}</h2>
        <p>Hello ${args.customerName || 'there'},</p>
        <p>${args.message}</p>
        ${args.collectionDate ? `<p><strong>Collection date:</strong> ${args.collectionDate}</p>` : ''}
        ${args.address ? `<p><strong>Address:</strong> ${args.address}</p>` : ''}
        <p style="margin-top: 24px;">Thank you for using Padi recurring services.</p>
      </div>
    </div>
  </div>
`;
exports.generateCollectionNotificationHtml = generateCollectionNotificationHtml;
//# sourceMappingURL=collectionNotificationTemplate.js.map