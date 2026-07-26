export interface ParsedImageDataUri {
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

const DEFAULT_ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const parseImageDataUri = (
  value: unknown,
  options: {
    maxBytes: number;
    allowedMimeTypes?: Set<string>;
    invalidMessage?: string;
    tooLargeMessage?: string;
  }
): ParsedImageDataUri => {
  const dataUri = String(value || '').trim();
  const match = dataUri.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
  const allowedMimeTypes = options.allowedMimeTypes || DEFAULT_ALLOWED_IMAGE_TYPES;

  if (!match) {
    throw new Error(options.invalidMessage || 'Choose a JPG, PNG, or WebP image.');
  }

  const mimeType = match[1].toLowerCase();
  if (!allowedMimeTypes.has(mimeType)) {
    throw new Error(options.invalidMessage || 'Choose a JPG, PNG, or WebP image.');
  }

  const base64 = match[2];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const sizeBytes = Math.floor((base64.length * 3) / 4) - padding;
  if (sizeBytes <= 0 || sizeBytes > options.maxBytes) {
    throw new Error(options.tooLargeMessage || 'Image must be 5 MB or smaller.');
  }

  return { dataUri, mimeType, sizeBytes };
};
