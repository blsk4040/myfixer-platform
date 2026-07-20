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
exports.updateMyNotificationPreferences = exports.getMyNotificationPreferences = exports.updateMyNotification = exports.getMyNotifications = exports.processAdminNotifications = exports.cancelAdminNotification = exports.retryAdminNotification = exports.createAdminBroadcastNotification = exports.listAdminNotifications = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notification_model_1 = __importStar(require("../models/notification.model"));
const notification_preference_model_1 = __importDefault(require("../models/notification-preference.model"));
const audit_service_1 = require("../services/audit.service");
const notification_service_1 = require("../services/notification.service");
const user_model_1 = __importStar(require("../models/user.model"));
const getAuthUser = (req) => req.user;
const getUserId = (req) => {
    const authUser = getAuthUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    return mongoose_1.default.Types.ObjectId.isValid(userId) ? new mongoose_1.default.Types.ObjectId(userId) : null;
};
const buildNotificationFilter = (query) => {
    const filter = {};
    if (typeof query.status === 'string' && query.status)
        filter.status = query.status;
    if (typeof query.channel === 'string' && query.channel)
        filter.channel = query.channel;
    if (typeof query.type === 'string' && query.type)
        filter.type = query.type;
    if (typeof query.user === 'string' && query.user) {
        if (mongoose_1.default.Types.ObjectId.isValid(query.user)) {
            filter['recipient.userId'] = new mongoose_1.default.Types.ObjectId(query.user);
        }
        else {
            filter['recipient.email'] = new RegExp(query.user, 'i');
        }
    }
    if (typeof query.from === 'string' || typeof query.to === 'string') {
        const range = {};
        if (typeof query.from === 'string' && query.from) {
            const from = new Date(query.from);
            if (!Number.isNaN(from.getTime()))
                range.$gte = from;
        }
        if (typeof query.to === 'string' && query.to) {
            const to = new Date(query.to);
            if (!Number.isNaN(to.getTime()))
                range.$lte = to;
        }
        if (Object.keys(range).length)
            filter.scheduledAt = range;
    }
    return filter;
};
const listAdminNotifications = async (req, res) => {
    try {
        const filter = buildNotificationFilter(req.query);
        const [notifications, counts] = await Promise.all([
            notification_model_1.default.find(filter).sort({ scheduledAt: -1 }).limit(300).lean(),
            notification_model_1.default.aggregate([
                { $match: filter },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);
        res.status(200).json({
            success: true,
            notifications,
            counts,
            meta: {
                statuses: Object.values(notification_model_1.NotificationStatus),
                channels: Object.values(notification_model_1.NotificationChannel),
                enabledChannels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.EMAIL, notification_model_1.NotificationChannel.PUSH],
                disabledChannels: [notification_model_1.NotificationChannel.SMS, notification_model_1.NotificationChannel.WHATSAPP],
                types: Object.values(notification_model_1.NotificationType),
            },
        });
    }
    catch (error) {
        console.error('Failed to list notifications:', error);
        res.status(500).json({ message: 'Failed to list notifications.' });
    }
};
exports.listAdminNotifications = listAdminNotifications;
const createAdminBroadcastNotification = async (req, res) => {
    const audience = String(req.body?.audience || 'CLIENTS').trim().toUpperCase();
    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const audienceRoleMap = {
        CLIENTS: [user_model_1.UserRole.CUSTOMER],
        TECHNICIANS: [user_model_1.UserRole.TECHNICIAN],
        ALL: [user_model_1.UserRole.CUSTOMER, user_model_1.UserRole.TECHNICIAN],
    };
    const roles = audienceRoleMap[audience];
    if (!roles) {
        res.status(400).json({ message: 'Select a valid broadcast audience.' });
        return;
    }
    if (!title || title.length > 120) {
        res.status(400).json({ message: 'Notification title is required and must be 120 characters or fewer.' });
        return;
    }
    if (!message || message.length > 600) {
        res.status(400).json({ message: 'Notification message is required and must be 600 characters or fewer.' });
        return;
    }
    try {
        const recipients = await user_model_1.default.find({
            role: { $in: roles },
            isActive: true,
            accountStatus: user_model_1.AccountStatus.ACTIVE,
        }).select('name email phone role').lean();
        if (!recipients.length) {
            res.status(404).json({ message: 'No active accounts were found for this broadcast audience.' });
            return;
        }
        const batches = await Promise.all(recipients.map((recipient) => (0, notification_service_1.createNotifications)({
            userId: recipient._id,
            email: recipient.email,
            phone: recipient.phone,
            name: recipient.name || 'Client',
            channels: [notification_model_1.NotificationChannel.IN_APP],
            type: notification_model_1.NotificationType.SYSTEM,
            title,
            message,
            metadata: {
                source: 'ADMIN_PORTAL',
                feed: 'ALERTS',
                broadcast: true,
                audience,
            },
        })));
        const notifications = batches.flat();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'notification.client_alert.broadcast',
            module: 'NOTIFICATIONS',
            resourceType: 'Notification',
            resourceId: notifications[0]?._id?.toString?.() || 'client-alert-broadcast',
            metadata: {
                recipientCount: recipients.length,
                notificationCount: notifications.length,
                audience,
                channel: notification_model_1.NotificationChannel.IN_APP,
                type: notification_model_1.NotificationType.SYSTEM,
            },
        });
        res.status(201).json({ success: true, notifications, recipientCount: recipients.length });
    }
    catch (error) {
        console.error('Failed to create client notification:', error);
        res.status(500).json({ message: 'Failed to send client notification.' });
    }
};
exports.createAdminBroadcastNotification = createAdminBroadcastNotification;
const retryAdminNotification = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid notification id.' });
        return;
    }
    try {
        const before = await notification_model_1.default.findById(id).lean();
        const notification = await (0, notification_service_1.retryNotification)(id);
        if (!notification) {
            res.status(404).json({ message: 'Notification not found.' });
            return;
        }
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'notification.retry',
            module: 'NOTIFICATIONS',
            resourceType: 'Notification',
            resourceId: notification._id.toString(),
            changes: { before, after: notification.toObject() },
            success: notification.status === notification_model_1.NotificationStatus.SENT,
            metadata: { channel: notification.channel, type: notification.type },
        });
        res.status(200).json({ success: true, notification });
    }
    catch (error) {
        console.error('Failed to retry notification:', error);
        res.status(500).json({ message: 'Failed to retry notification.' });
    }
};
exports.retryAdminNotification = retryAdminNotification;
const cancelAdminNotification = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid notification id.' });
        return;
    }
    try {
        const before = await notification_model_1.default.findById(id).lean();
        const notification = await notification_model_1.default.findByIdAndUpdate(id, {
            status: notification_model_1.NotificationStatus.CANCELLED,
            cancelledAt: new Date(),
        }, { new: true, runValidators: true });
        if (!notification) {
            res.status(404).json({ message: 'Notification not found.' });
            return;
        }
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'notification.cancel',
            module: 'NOTIFICATIONS',
            resourceType: 'Notification',
            resourceId: notification._id.toString(),
            changes: { before, after: notification.toObject() },
            metadata: { channel: notification.channel, type: notification.type },
        });
        res.status(200).json({ success: true, notification });
    }
    catch (error) {
        console.error('Failed to cancel notification:', error);
        res.status(500).json({ message: 'Failed to cancel notification.' });
    }
};
exports.cancelAdminNotification = cancelAdminNotification;
const processAdminNotifications = async (req, res) => {
    try {
        const processed = await (0, notification_service_1.processDueNotifications)();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'notification.process_due',
            module: 'NOTIFICATIONS',
            resourceType: 'Notification',
            metadata: { processedCount: processed.length },
        });
        res.status(200).json({ success: true, processed });
    }
    catch (error) {
        console.error('Failed to process notifications:', error);
        res.status(500).json({ message: 'Failed to process notifications.' });
    }
};
exports.processAdminNotifications = processAdminNotifications;
const getMyNotifications = async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: 'Valid user identity is required.' });
        return;
    }
    try {
        const filter = {
            'recipient.userId': userId,
            channel: notification_model_1.NotificationChannel.IN_APP,
            status: { $ne: notification_model_1.NotificationStatus.ARCHIVED },
        };
        if (typeof req.query.status === 'string' && req.query.status)
            filter.status = req.query.status;
        const notifications = await notification_model_1.default.find(filter).sort({ createdAt: -1 }).limit(100).lean();
        const unreadCount = await notification_model_1.default.countDocuments({
            'recipient.userId': userId,
            channel: notification_model_1.NotificationChannel.IN_APP,
            readAt: null,
            status: { $nin: [notification_model_1.NotificationStatus.ARCHIVED, notification_model_1.NotificationStatus.CANCELLED] },
        });
        res.status(200).json({ success: true, notifications, unreadCount });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to load notifications.' });
    }
};
exports.getMyNotifications = getMyNotifications;
const updateMyNotification = async (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    if (!userId || !mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid notification request.' });
        return;
    }
    const action = String(req.body.action || '').trim().toUpperCase();
    const updates = {};
    if (action === 'MARK_READ') {
        updates.readAt = new Date();
        updates.status = notification_model_1.NotificationStatus.READ;
    }
    else if (action === 'MARK_UNREAD') {
        updates.readAt = null;
        updates.status = notification_model_1.NotificationStatus.SENT;
    }
    else if (action === 'ARCHIVE') {
        updates.archivedAt = new Date();
        updates.status = notification_model_1.NotificationStatus.ARCHIVED;
    }
    else {
        res.status(400).json({ message: 'Unsupported notification action.' });
        return;
    }
    try {
        const notification = await notification_model_1.default.findOneAndUpdate({ _id: id, 'recipient.userId': userId }, updates, { new: true, runValidators: true });
        if (!notification) {
            res.status(404).json({ message: 'Notification not found.' });
            return;
        }
        res.status(200).json({ success: true, notification });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to update notification.' });
    }
};
exports.updateMyNotification = updateMyNotification;
const getMyNotificationPreferences = async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: 'Valid user identity is required.' });
        return;
    }
    const preference = await notification_preference_model_1.default.findOneAndUpdate({ userId }, {
        $setOnInsert: {
            userId,
            channels: {
                inApp: true,
                email: true,
                push: true,
                sms: false,
                whatsapp: false,
            },
        },
    }, { new: true, upsert: true, runValidators: true }).lean();
    res.status(200).json({ success: true, preference });
};
exports.getMyNotificationPreferences = getMyNotificationPreferences;
const updateMyNotificationPreferences = async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        res.status(401).json({ message: 'Valid user identity is required.' });
        return;
    }
    const allowed = ['inApp', 'email', 'push', 'sms', 'whatsapp'];
    const channels = {};
    allowed.forEach((key) => {
        if (typeof req.body.channels?.[key] === 'boolean')
            channels[`channels.${key}`] = req.body.channels[key];
    });
    if (!Object.keys(channels).length) {
        res.status(400).json({ message: 'No notification preferences supplied.' });
        return;
    }
    const preference = await notification_preference_model_1.default.findOneAndUpdate({ userId }, { $set: channels }, { new: true, upsert: true, runValidators: true }).lean();
    res.status(200).json({ success: true, preference });
};
exports.updateMyNotificationPreferences = updateMyNotificationPreferences;
//# sourceMappingURL=notification.controller.js.map