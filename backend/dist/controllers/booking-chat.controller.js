"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBookingMessage = exports.getBookingMessages = exports.uploadBookingMedia = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const chat_message_model_1 = __importStar(require("../models/chat-message.model"));
const job_media_model_1 = __importStar(require("../models/job-media.model"));
const notification_model_1 = require("../models/notification.model");
const user_model_1 = require("../models/user.model");
const notification_service_1 = require("../services/notification.service");
const media_storage_service_1 = require("../services/media-storage.service");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const TWO_YEARS_MS = 2 * ONE_YEAR_MS;
const getAuthUser = (req) => req.user;
const getUserId = (req) => {
    const authUser = getAuthUser(req);
    return String(authUser?.id ?? authUser?._id ?? '').trim();
};
const getSenderRole = (req) => {
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    if (role === user_model_1.UserRole.TECHNICIAN)
        return 'TECHNICIAN';
    if (role === user_model_1.UserRole.ADMIN)
        return 'ADMIN';
    return 'CUSTOMER';
};
const getPurpose = (value) => {
    const purpose = typeof value === 'string' ? value.toUpperCase().trim() : '';
    return Object.values(job_media_model_1.JobMediaPurpose).includes(purpose)
        ? purpose
        : job_media_model_1.JobMediaPurpose.CHAT;
};
const getRetentionDate = (purpose) => {
    const retentionMs = purpose === job_media_model_1.JobMediaPurpose.DISPUTE ? TWO_YEARS_MS : ONE_YEAR_MS;
    return new Date(Date.now() + retentionMs);
};
const getMimeTypeFromDataUri = (dataUri) => {
    const match = dataUri.match(/^data:([^;]+);base64,/i);
    return match?.[1] || 'image/jpeg';
};
const assertDataUriImage = (dataUri) => {
    if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/') || !dataUri.includes(';base64,')) {
        throw new Error('A base64 image data URI is required.');
    }
    return dataUri;
};
const serializeMedia = (media) => ({
    id: media._id?.toString?.() ?? media.id,
    bookingId: media.bookingId?.toString?.() ?? media.bookingId,
    uploadedByUserId: media.uploadedByUserId?.toString?.() ?? media.uploadedByUserId,
    uploadedByRole: media.uploadedByRole,
    mediaType: media.mediaType,
    purpose: media.purpose,
    url: media.url,
    thumbnailUrl: media.thumbnailUrl,
    mimeType: media.mimeType,
    fileName: media.fileName,
    fileSize: media.fileSize,
    width: media.width,
    height: media.height,
    retentionExpiresAt: media.retentionExpiresAt,
    createdAt: media.createdAt,
});
const serializeMessage = (message, mediaById) => ({
    id: message._id?.toString?.() ?? message.id,
    bookingId: message.bookingId?.toString?.() ?? message.bookingId,
    senderId: message.senderId?.toString?.() ?? message.senderId,
    senderRole: message.senderRole,
    messageType: message.messageType,
    text: message.text,
    media: (message.mediaIds || [])
        .map((id) => mediaById.get(String(id)))
        .filter(Boolean)
        .map(serializeMedia),
    createdAt: message.createdAt,
});
const loadAuthorizedBooking = async (bookingId, userId, role) => {
    if (!mongoose_1.default.Types.ObjectId.isValid(bookingId) || !mongoose_1.default.Types.ObjectId.isValid(userId))
        return null;
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking)
        return null;
    if (role === user_model_1.UserRole.ADMIN)
        return booking;
    if (String(booking.customerId) === userId)
        return booking;
    if (String(booking.technicianId || '') === userId)
        return booking;
    return null;
};
const uploadBookingMedia = async (req, res) => {
    const userId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const { bookingId } = req.params;
    try {
        const booking = await loadAuthorizedBooking(bookingId, userId, role);
        if (!booking) {
            res.status(404).json({ message: 'Booking not found or access denied.' });
            return;
        }
        const dataUri = assertDataUriImage(req.body?.dataUri);
        const purpose = getPurpose(req.body?.purpose);
        const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : getMimeTypeFromDataUri(dataUri);
        const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
        const publicId = `${booking.id}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
        const uploaded = await (0, media_storage_service_1.uploadImageToCloudinary)({
            dataUri,
            folder: `myfixer/bookings/${booking.id}`,
            publicId,
        });
        const media = await job_media_model_1.default.create({
            bookingId: booking._id,
            customerId: booking.customerId,
            technicianId: booking.technicianId || null,
            uploadedByUserId: new mongoose_1.default.Types.ObjectId(userId),
            uploadedByRole: getSenderRole(req),
            mediaType: 'IMAGE',
            purpose,
            storageProvider: uploaded.storageProvider,
            storageKey: uploaded.storageKey,
            url: uploaded.url,
            thumbnailUrl: uploaded.thumbnailUrl,
            mimeType,
            fileName,
            fileSize: uploaded.fileSize,
            width: uploaded.width,
            height: uploaded.height,
            retentionExpiresAt: getRetentionDate(purpose),
            metadata: {
                format: uploaded.format,
            },
        });
        res.status(201).json({ success: true, media: serializeMedia(media) });
    }
    catch (error) {
        res.status(400).json({ message: error.message || 'Failed to upload image.' });
    }
};
exports.uploadBookingMedia = uploadBookingMedia;
const getBookingMessages = async (req, res) => {
    const userId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const { bookingId } = req.params;
    const booking = await loadAuthorizedBooking(bookingId, userId, role);
    if (!booking) {
        res.status(404).json({ message: 'Booking not found or access denied.' });
        return;
    }
    const messages = await chat_message_model_1.default.find({ bookingId: booking._id }).sort({ createdAt: 1 }).limit(200).lean();
    const mediaIds = messages.flatMap((message) => (message.mediaIds || []).map((id) => new mongoose_1.default.Types.ObjectId(String(id))));
    const media = mediaIds.length ? await job_media_model_1.default.find({ _id: { $in: mediaIds } }).lean() : [];
    const mediaById = new Map(media.map((item) => [String(item._id), item]));
    res.status(200).json({
        success: true,
        messages: messages.map((message) => serializeMessage(message, mediaById)),
    });
};
exports.getBookingMessages = getBookingMessages;
const sendBookingMessage = async (req, res) => {
    const userId = getUserId(req);
    const role = (0, user_model_1.normalizeUserRole)(getAuthUser(req)?.role);
    const { bookingId } = req.params;
    try {
        const booking = await loadAuthorizedBooking(bookingId, userId, role);
        if (!booking) {
            res.status(404).json({ message: 'Booking not found or access denied.' });
            return;
        }
        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        const mediaIds = Array.isArray(req.body?.mediaIds)
            ? req.body.mediaIds.filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id))).map((id) => new mongoose_1.default.Types.ObjectId(String(id)))
            : [];
        if (!text && !mediaIds.length) {
            res.status(400).json({ message: 'Message text or image is required.' });
            return;
        }
        const authorizedMediaCount = mediaIds.length
            ? await job_media_model_1.default.countDocuments({ _id: { $in: mediaIds }, bookingId: booking._id })
            : 0;
        if (authorizedMediaCount !== mediaIds.length) {
            res.status(400).json({ message: 'One or more images do not belong to this booking.' });
            return;
        }
        const message = await chat_message_model_1.default.create({
            bookingId: booking._id,
            senderId: new mongoose_1.default.Types.ObjectId(userId),
            senderRole: getSenderRole(req),
            messageType: mediaIds.length ? chat_message_model_1.ChatMessageType.IMAGE : chat_message_model_1.ChatMessageType.TEXT,
            text,
            mediaIds,
            readBy: [{ userId: new mongoose_1.default.Types.ObjectId(userId), readAt: new Date() }],
        });
        const media = mediaIds.length ? await job_media_model_1.default.find({ _id: { $in: mediaIds } }).lean() : [];
        const mediaById = new Map(media.map((item) => [String(item._id), item]));
        const payload = serializeMessage(message.toObject(), mediaById);
        const io = req.app.get('io');
        io?.to(`chat:${booking.id}`).emit('chat_message_sent', payload);
        io?.to(`chat:${booking.id}`).emit('incoming_chat_msg', {
            id: payload.id,
            senderRole: payload.senderRole === 'CUSTOMER' ? 'client' : 'technician',
            text: payload.text || (payload.media.length ? 'Sent a photo' : ''),
            timestamp: new Date(payload.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            media: payload.media,
        });
        const recipientId = String(booking.customerId) === userId
            ? booking.technicianId
            : booking.customerId;
        if (recipientId && mongoose_1.default.Types.ObjectId.isValid(String(recipientId))) {
            await (0, notification_service_1.createNotifications)({
                userId: recipientId,
                channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.PUSH],
                type: mediaIds.length ? 'CHAT_IMAGE' : 'CHAT_MESSAGE',
                title: mediaIds.length ? 'Photo received' : 'New message',
                message: mediaIds.length ? 'A photo was sent in your job chat.' : text.slice(0, 120),
                metadata: {
                    bookingId: booking.id,
                    messageId: message.id,
                },
            });
        }
        res.status(201).json({ success: true, message: payload });
    }
    catch (error) {
        res.status(400).json({ message: error.message || 'Failed to send message.' });
    }
};
exports.sendBookingMessage = sendBookingMessage;
//# sourceMappingURL=booking-chat.controller.js.map