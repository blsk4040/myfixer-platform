import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking, { BookingStatus, InspectionStatus } from '../models/booking.model';
import ChatMessage, { ChatMessageType } from '../models/chat-message.model';
import JobMedia, { JobMediaPurpose } from '../models/job-media.model';
import { NotificationChannel } from '../models/notification.model';
import { normalizeUserRole, UserRole } from '../models/user.model';
import { createNotifications } from '../services/notification.service';
import { uploadImageToCloudinary } from '../services/media-storage.service';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const TWO_YEARS_MS = 2 * ONE_YEAR_MS;

const getAuthUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const getUserId = (req: Request): string => {
  const authUser = getAuthUser(req);
  return String(authUser?.id ?? authUser?._id ?? '').trim();
};

const getSenderRole = (req: Request): 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN' => {
  const role = normalizeUserRole(getAuthUser(req)?.role);
  if (role === UserRole.TECHNICIAN) return 'TECHNICIAN';
  if (role === UserRole.ADMIN) return 'ADMIN';
  return 'CUSTOMER';
};

const getPurpose = (value: unknown): JobMediaPurpose => {
  const purpose = typeof value === 'string' ? value.toUpperCase().trim() : '';
  return Object.values(JobMediaPurpose).includes(purpose as JobMediaPurpose)
    ? purpose as JobMediaPurpose
    : JobMediaPurpose.CHAT;
};

const getRetentionDate = (purpose: JobMediaPurpose): Date => {
  const retentionMs = purpose === JobMediaPurpose.DISPUTE ? TWO_YEARS_MS : ONE_YEAR_MS;
  return new Date(Date.now() + retentionMs);
};

const getMimeTypeFromDataUri = (dataUri: string): string => {
  const match = dataUri.match(/^data:([^;]+);base64,/i);
  return match?.[1] || 'image/jpeg';
};

const assertDataUriImage = (dataUri: unknown): string => {
  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:image/') || !dataUri.includes(';base64,')) {
    throw new Error('A base64 image data URI is required.');
  }
  return dataUri;
};

const serializeMedia = (media: any) => ({
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

const serializeMessage = (message: any, mediaById: Map<string, any>) => ({
  id: message._id?.toString?.() ?? message.id,
  bookingId: message.bookingId?.toString?.() ?? message.bookingId,
  senderId: message.senderId?.toString?.() ?? message.senderId,
  senderRole: message.senderRole,
  messageType: message.messageType,
  text: message.text,
  media: (message.mediaIds || [])
    .map((id: unknown) => mediaById.get(String(id)))
    .filter(Boolean)
    .map(serializeMedia),
  createdAt: message.createdAt,
});

const loadAuthorizedBooking = async (bookingId: string, userId: string, role: UserRole) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId) || !mongoose.Types.ObjectId.isValid(userId)) return null;

  const booking = await Booking.findById(bookingId);
  if (!booking) return null;
  if (role === UserRole.ADMIN) return booking;
  if (String(booking.customerId) === userId) return booking;
  if (String(booking.technicianId || '') === userId) return booking;
  return null;
};

export const uploadBookingMedia = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const { bookingId } = req.params;

  try {
    const booking = await loadAuthorizedBooking(bookingId, userId, role);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found or access denied.' });
      return;
    }

    const dataUri = assertDataUriImage(req.body?.dataUri);
    const purpose = getPurpose(req.body?.purpose);
    if (purpose === JobMediaPurpose.INSPECTION) {
      if (role !== UserRole.TECHNICIAN && role !== UserRole.ADMIN) {
        res.status(403).json({ message: 'Only the assigned technician can upload inspection evidence.' });
        return;
      }
      if (role !== UserRole.ADMIN && String(booking.technicianId || '') !== userId) {
        res.status(403).json({ message: 'Only the assigned technician can upload inspection evidence.' });
        return;
      }
      if (booking.status !== BookingStatus.ARRIVED || booking.inspection?.status !== InspectionStatus.IN_PROGRESS) {
        res.status(409).json({ message: 'Inspection evidence can be uploaded only during an active inspection.' });
        return;
      }
    }
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : getMimeTypeFromDataUri(dataUri);
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
    const publicId = `${booking.id}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
    const uploaded = await uploadImageToCloudinary({
      dataUri,
      folder: `myfixer/bookings/${booking.id}`,
      publicId,
    });

    const media = await JobMedia.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      technicianId: booking.technicianId || null,
      uploadedByUserId: new mongoose.Types.ObjectId(userId),
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

    if (purpose === JobMediaPurpose.INSPECTION) {
      await Booking.updateOne(
        { _id: booking._id, technicianId: booking.technicianId, 'inspection.status': InspectionStatus.IN_PROGRESS },
        { $addToSet: { 'inspection.evidenceMediaIds': media._id } }
      );
    }

    res.status(201).json({ success: true, media: serializeMedia(media) });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to upload image.' });
  }
};

export const getBookingMessages = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const { bookingId } = req.params;

  const booking = await loadAuthorizedBooking(bookingId, userId, role);
  if (!booking) {
    res.status(404).json({ message: 'Booking not found or access denied.' });
    return;
  }

  const messages = await ChatMessage.find({ bookingId: booking._id }).sort({ createdAt: 1 }).limit(200).lean();
  const mediaIds = messages.flatMap((message) => (message.mediaIds || []).map((id) => new mongoose.Types.ObjectId(String(id))));
  const media = mediaIds.length ? await JobMedia.find({ _id: { $in: mediaIds } }).lean() : [];
  const mediaById = new Map(media.map((item) => [String(item._id), item]));

  res.status(200).json({
    success: true,
    messages: messages.map((message) => serializeMessage(message, mediaById)),
  });
};

export const sendBookingMessage = async (req: Request, res: Response): Promise<void> => {
  const userId = getUserId(req);
  const role = normalizeUserRole(getAuthUser(req)?.role);
  const { bookingId } = req.params;

  try {
    const booking = await loadAuthorizedBooking(bookingId, userId, role);
    if (!booking) {
      res.status(404).json({ message: 'Booking not found or access denied.' });
      return;
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const mediaIds = Array.isArray(req.body?.mediaIds)
      ? req.body.mediaIds.filter((id: unknown) => mongoose.Types.ObjectId.isValid(String(id))).map((id: unknown) => new mongoose.Types.ObjectId(String(id)))
      : [];

    if (!text && !mediaIds.length) {
      res.status(400).json({ message: 'Message text or image is required.' });
      return;
    }

    const authorizedMediaCount = mediaIds.length
      ? await JobMedia.countDocuments({ _id: { $in: mediaIds }, bookingId: booking._id })
      : 0;
    if (authorizedMediaCount !== mediaIds.length) {
      res.status(400).json({ message: 'One or more images do not belong to this booking.' });
      return;
    }

    const message = await ChatMessage.create({
      bookingId: booking._id,
      senderId: new mongoose.Types.ObjectId(userId),
      senderRole: getSenderRole(req),
      messageType: mediaIds.length ? ChatMessageType.IMAGE : ChatMessageType.TEXT,
      text,
      mediaIds,
      readBy: [{ userId: new mongoose.Types.ObjectId(userId), readAt: new Date() }],
    });

    const media = mediaIds.length ? await JobMedia.find({ _id: { $in: mediaIds } }).lean() : [];
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

    const recipientId =
      String(booking.customerId) === userId
        ? booking.technicianId
        : booking.customerId;

    if (recipientId && mongoose.Types.ObjectId.isValid(String(recipientId))) {
      await createNotifications({
        userId: recipientId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
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
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to send message.' });
  }
};
