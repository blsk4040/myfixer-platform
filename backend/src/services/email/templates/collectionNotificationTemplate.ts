interface CollectionNotificationTemplateArgs {
  title: string;
  message: string;
  customerName?: string;
  collectionDate?: string;
  address?: string;
}

export const generateCollectionNotificationHtml = (args: CollectionNotificationTemplateArgs): string => `
  <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <h2 style="margin-bottom: 8px;">${args.title}</h2>
    <p>Hello ${args.customerName || 'there'},</p>
    <p>${args.message}</p>
    ${args.collectionDate ? `<p><strong>Collection date:</strong> ${args.collectionDate}</p>` : ''}
    ${args.address ? `<p><strong>Address:</strong> ${args.address}</p>` : ''}
    <p style="margin-top: 24px;">Thank you for using MyFixer Managed Collection Services.</p>
  </div>
`;
