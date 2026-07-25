"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCollectionNotificationHtml = void 0;
const padiWordmarkHtml = `
  <span style="display:inline-block;color:#F7F7F5;font-size:30px;line-height:1;font-weight:900;letter-spacing:0;">
    Pad<span style="position:relative;display:inline-block;color:#F7F7F5;vertical-align:baseline;top:-0.05em;">i<span style="position:absolute;left:50%;top:-0.12em;display:block;width:0.18em;height:0.18em;margin-left:-0.09em;border-radius:999px;background:#B8FF3D;font-size:1em;line-height:1;">&nbsp;</span></span>
  </span>
`;
const generateCollectionNotificationHtml = (args) => `
  <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; background:#F8FAFC; padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:18px;overflow:hidden;">
      <div style="background:#0B0B0D;padding:26px 28px;text-align:center;">${padiWordmarkHtml}</div>
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