"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageToCloudinary = void 0;
const crypto_1 = __importDefault(require("crypto"));
const requireCloudinaryConfig = () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    }
    return { cloudName, apiKey, apiSecret };
};
const signCloudinaryParams = (params, apiSecret) => {
    const payload = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');
    return crypto_1.default.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
};
const uploadImageToCloudinary = async (input) => {
    const { cloudName, apiKey, apiSecret } = requireCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
        folder: input.folder,
        public_id: input.publicId,
        timestamp,
    };
    const signature = signCloudinaryParams(params, apiSecret);
    const formData = new FormData();
    formData.append('file', input.dataUri);
    formData.append('api_key', apiKey);
    formData.append('folder', input.folder);
    formData.append('public_id', input.publicId);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
    });
    const body = await response.json();
    if (!response.ok || !body.public_id || !body.secure_url) {
        throw new Error(body.error?.message || `Cloudinary upload failed with status ${response.status}.`);
    }
    const thumbnailUrl = body.secure_url.replace('/upload/', '/upload/c_fill,w_420,h_280,q_auto,f_auto/');
    return {
        storageProvider: 'cloudinary',
        storageKey: body.public_id,
        url: body.secure_url,
        thumbnailUrl,
        fileSize: body.bytes || 0,
        width: body.width || 0,
        height: body.height || 0,
        format: body.format || '',
    };
};
exports.uploadImageToCloudinary = uploadImageToCloudinary;
//# sourceMappingURL=media-storage.service.js.map