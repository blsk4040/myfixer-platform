"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCollectionNotificationHtml = void 0;
const generateCollectionNotificationHtml = (args) => `
  <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <h2 style="margin-bottom: 8px;">${args.title}</h2>
    <p>Hello ${args.customerName || 'there'},</p>
    <p>${args.message}</p>
    ${args.collectionDate ? `<p><strong>Collection date:</strong> ${args.collectionDate}</p>` : ''}
    ${args.address ? `<p><strong>Address:</strong> ${args.address}</p>` : ''}
    <p style="margin-top: 24px;">Thank you for using Padi recurring services.</p>
  </div>
`;
exports.generateCollectionNotificationHtml = generateCollectionNotificationHtml;
//# sourceMappingURL=collectionNotificationTemplate.js.map