"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseImageDataUri = void 0;
const DEFAULT_ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const parseImageDataUri = (value, options) => {
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
exports.parseImageDataUri = parseImageDataUri;
//# sourceMappingURL=image-data-uri.js.map