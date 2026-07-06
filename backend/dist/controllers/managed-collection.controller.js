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
exports.updateManagedCollectionJob = exports.getAdminCollectionProfile = exports.listAdminCollectionOperations = exports.updateManagedCollectionReminder = exports.listAdminManagedCollections = exports.createManagedCollectionProfile = exports.calculateNextCollectionDateByFrequency = exports.calculateNextCollectionDate = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const managed_collection_model_1 = __importStar(require("../models/managed-collection.model"));
const managed_collection_job_model_1 = __importStar(require("../models/managed-collection-job.model"));
const notification_reminder_model_1 = __importStar(require("../models/notification-reminder.model"));
const notification_model_1 = require("../models/notification.model");
const user_model_1 = __importDefault(require("../models/user.model"));
const market_config_1 = require("../config/market.config");
const audit_service_1 = require("../services/audit.service");
const service_availability_service_1 = require("../services/service-availability.service");
const notification_service_1 = require("../services/notification.service");
const MANAGED_COLLECTION_SERVICE_KEY = 'managed_collection';
const dayIndexes = {
    [managed_collection_model_1.ManagedCollectionDay.SUNDAY]: 0,
    [managed_collection_model_1.ManagedCollectionDay.MONDAY]: 1,
    [managed_collection_model_1.ManagedCollectionDay.TUESDAY]: 2,
    [managed_collection_model_1.ManagedCollectionDay.WEDNESDAY]: 3,
    [managed_collection_model_1.ManagedCollectionDay.THURSDAY]: 4,
    [managed_collection_model_1.ManagedCollectionDay.FRIDAY]: 5,
    [managed_collection_model_1.ManagedCollectionDay.SATURDAY]: 6,
};
const editableJobStatuses = new Set([
    managed_collection_job_model_1.ManagedCollectionJobStatus.SCHEDULED,
    managed_collection_job_model_1.ManagedCollectionJobStatus.ASSIGNED,
    managed_collection_job_model_1.ManagedCollectionJobStatus.IN_PROGRESS,
]);
const getAuthenticatedUser = (request) => request.user;
const normalizeText = (value) => typeof value === 'string' ? value.trim() : '';
const isEnumValue = (targetEnum, value) => typeof value === 'string' && Object.values(targetEnum).includes(value);
const calculateNextCollectionDate = (preferredDay, fromDate = new Date()) => {
    const start = new Date(fromDate);
    start.setHours(9, 0, 0, 0);
    const targetDay = dayIndexes[preferredDay];
    const diff = (targetDay - start.getDay() + 7) % 7;
    start.setDate(start.getDate() + (diff === 0 ? 7 : diff));
    return start;
};
exports.calculateNextCollectionDate = calculateNextCollectionDate;
const calculateNextCollectionDateByFrequency = (lastCollectionDate, frequency, preferredDay) => {
    const next = new Date(lastCollectionDate);
    next.setHours(9, 0, 0, 0);
    if (frequency === managed_collection_model_1.ManagedCollectionFrequency.TWICE_WEEKLY) {
        next.setDate(next.getDate() + 3);
        return next;
    }
    if (frequency === managed_collection_model_1.ManagedCollectionFrequency.MONTHLY) {
        next.setMonth(next.getMonth() + 1);
        return (0, exports.calculateNextCollectionDate)(preferredDay, next);
    }
    next.setDate(next.getDate() + 7);
    return (0, exports.calculateNextCollectionDate)(preferredDay, next);
};
exports.calculateNextCollectionDateByFrequency = calculateNextCollectionDateByFrequency;
const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};
const endOfDay = (value) => {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
};
const startOfWeek = (value) => {
    const date = startOfDay(value);
    const diff = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - diff);
    return date;
};
const endOfWeek = (value) => {
    const date = startOfWeek(value);
    date.setDate(date.getDate() + 6);
    return endOfDay(date);
};
const startOfMonth = (value) => new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (value) => new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
const getActorObjectId = (request) => {
    const authUser = getAuthenticatedUser(request);
    const actorId = String(authUser?.id ?? authUser?._id ?? '').trim();
    return mongoose_1.default.Types.ObjectId.isValid(actorId) ? new mongoose_1.default.Types.ObjectId(actorId) : undefined;
};
const buildJobFromProfile = (profile, scheduledFor) => ({
    profileId: profile._id,
    customerId: profile.customerId,
    customerName: profile.customerName,
    customerEmail: profile.customerEmail,
    countryCode: profile.countryCode,
    city: profile.city,
    area: profile.area,
    fullAddress: profile.fullAddress,
    collectionType: profile.collectionType,
    binPackage: profile.binPackage,
    frequency: profile.frequency,
    preferredCollectionDay: profile.preferredCollectionDay,
    scheduledFor,
    status: managed_collection_job_model_1.ManagedCollectionJobStatus.SCHEDULED,
    metadata: {
        serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
        generatedFromProfileNextCollectionDate: profile.nextCollectionDate,
    },
});
const ensureCollectionJobForProfile = async (profile) => {
    const scheduledFor = new Date(profile.nextCollectionDate);
    const job = await managed_collection_job_model_1.default.findOneAndUpdate({
        profileId: profile._id,
        scheduledFor,
    }, {
        $setOnInsert: buildJobFromProfile(profile, scheduledFor),
    }, {
        new: true,
        upsert: true,
        runValidators: true,
    });
    return job;
};
const generateCollectionJobs = async () => {
    const profiles = await managed_collection_model_1.default.find({
        status: managed_collection_model_1.ManagedCollectionProfileStatus.ACTIVE,
    });
    const jobs = await Promise.all(profiles.map((profile) => ensureCollectionJobForProfile(profile)));
    return jobs;
};
const buildJobFilter = (query) => {
    const filter = {};
    if (typeof query.countryCode === 'string' && query.countryCode)
        filter.countryCode = query.countryCode.toUpperCase();
    if (typeof query.city === 'string' && query.city)
        filter.city = new RegExp(query.city, 'i');
    if (typeof query.area === 'string' && query.area)
        filter.area = new RegExp(query.area, 'i');
    if (typeof query.collectionType === 'string' && query.collectionType)
        filter.collectionType = query.collectionType;
    if (typeof query.status === 'string' && query.status)
        filter.status = query.status;
    if (typeof query.preferredDay === 'string' && query.preferredDay)
        filter.preferredCollectionDay = query.preferredDay;
    return filter;
};
const jobActionHistory = (status, collectionDate, actorId, notes = '', missedReason = '', photos = []) => ({
    collectionDate,
    completedBy: actorId,
    notes,
    photos,
    missedReason,
    status,
    createdAt: new Date(),
});
const reminderDateFor = (nextCollectionDate, reminderType) => {
    const scheduledFor = new Date(nextCollectionDate);
    if (reminderType === notification_reminder_model_1.ReminderType.DAY_BEFORE_COLLECTION) {
        scheduledFor.setDate(scheduledFor.getDate() - 1);
        scheduledFor.setHours(18, 0, 0, 0);
        return scheduledFor;
    }
    scheduledFor.setHours(7, 0, 0, 0);
    return scheduledFor;
};
const formatCollectionDate = (value) => new Intl.DateTimeFormat('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
}).format(value);
const createCollectionReminders = async (profile) => {
    const basePayload = {
        profileId: profile._id.toString(),
        serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
        collectionType: profile.collectionType,
        binPackage: profile.binPackage,
        frequency: profile.frequency,
        nextCollectionDate: profile.nextCollectionDate,
    };
    return notification_reminder_model_1.default.create([
        {
            customerId: profile.customerId,
            targetType: 'ManagedCollectionProfile',
            targetId: profile._id,
            reminderType: notification_reminder_model_1.ReminderType.DAY_BEFORE_COLLECTION,
            channels: [notification_reminder_model_1.ReminderChannel.IN_APP],
            status: notification_reminder_model_1.ReminderStatus.PENDING,
            scheduledFor: reminderDateFor(profile.nextCollectionDate, notification_reminder_model_1.ReminderType.DAY_BEFORE_COLLECTION),
            payload: basePayload,
        },
        {
            customerId: profile.customerId,
            targetType: 'ManagedCollectionProfile',
            targetId: profile._id,
            reminderType: notification_reminder_model_1.ReminderType.COLLECTION_DAY,
            channels: [notification_reminder_model_1.ReminderChannel.IN_APP],
            status: notification_reminder_model_1.ReminderStatus.PENDING,
            scheduledFor: reminderDateFor(profile.nextCollectionDate, notification_reminder_model_1.ReminderType.COLLECTION_DAY),
            payload: basePayload,
        },
    ]);
};
const createManagedCollectionNotifications = async (profile, event, scheduledAt, overrides = {}) => {
    const collectionDate = formatCollectionDate(profile.nextCollectionDate);
    const defaults = {
        [notification_model_1.NotificationType.COLLECTION_REMINDER]: {
            title: 'Collection reminder',
            message: `Your Managed Collection Services pickup is scheduled for ${collectionDate}.`,
        },
        [notification_model_1.NotificationType.COLLECTION_TODAY]: {
            title: 'Collection today',
            message: `Your Managed Collection Services pickup is scheduled for today.`,
        },
        [notification_model_1.NotificationType.COLLECTION_RESCHEDULED]: {
            title: 'Collection rescheduled',
            message: `Your Managed Collection Services pickup has been rescheduled to ${collectionDate}.`,
        },
        [notification_model_1.NotificationType.COLLECTION_CANCELLED]: {
            title: 'Collection cancelled',
            message: 'Your Managed Collection Services pickup has been cancelled.',
        },
        [notification_model_1.NotificationType.COLLECTION_MISSED]: {
            title: 'Collection missed',
            message: 'Your Managed Collection Services pickup was marked as missed.',
        },
        [notification_model_1.NotificationType.SYSTEM]: {
            title: 'MyFixer notification',
            message: 'You have a new MyFixer notification.',
        },
    };
    return (0, notification_service_1.createNotifications)({
        userId: profile.customerId,
        email: profile.customerEmail,
        phone: profile.customerPhone,
        name: profile.customerName,
        channels: [notification_model_1.NotificationChannel.IN_APP, notification_model_1.NotificationChannel.EMAIL],
        type: event,
        title: overrides.title || defaults[event]?.title || defaults[notification_model_1.NotificationType.SYSTEM].title,
        message: overrides.message || defaults[event]?.message || defaults[notification_model_1.NotificationType.SYSTEM].message,
        scheduledAt,
        metadata: {
            serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
            profileId: profile._id.toString(),
            collectionDate,
            address: profile.fullAddress,
            collectionType: profile.collectionType,
        },
    });
};
const createManagedCollectionProfile = async (req, res) => {
    const authUser = getAuthenticatedUser(req);
    const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!customerId || !mongoose_1.default.Types.ObjectId.isValid(customerId)) {
        res.status(401).json({ message: 'Valid customer identity is required.' });
        return;
    }
    const customer = await user_model_1.default.findById(customerId).select('name email phone countryCode location').lean();
    if (!customer) {
        res.status(404).json({ message: 'Customer account not found.' });
        return;
    }
    const countryCode = (0, market_config_1.normalizeCountryCode)(req.body.countryCode ?? customer.countryCode);
    const city = normalizeText(req.body.city) || customer.location?.city || '';
    const area = normalizeText(req.body.area) || customer.location?.area || '';
    const fullAddress = normalizeText(req.body.fullAddress);
    const propertyType = req.body.propertyType;
    const collectionType = req.body.collectionType || managed_collection_model_1.ManagedCollectionType.GENERAL_WASTE;
    const binPackage = Array.isArray(req.body.binPackage) ? req.body.binPackage : [];
    const frequency = req.body.frequency;
    const preferredCollectionDay = req.body.preferredCollectionDay;
    if (!city || !fullAddress) {
        res.status(400).json({ message: 'City and full address are required.' });
        return;
    }
    if (!isEnumValue(managed_collection_model_1.ManagedCollectionPropertyType, propertyType)) {
        res.status(400).json({ message: 'Invalid property type.' });
        return;
    }
    if (!isEnumValue(managed_collection_model_1.ManagedCollectionType, collectionType)) {
        res.status(400).json({ message: 'Invalid collection type.' });
        return;
    }
    if (collectionType !== managed_collection_model_1.ManagedCollectionType.GENERAL_WASTE) {
        res.status(400).json({ message: 'Only GENERAL_WASTE is available in this phase.' });
        return;
    }
    const normalizedBins = binPackage
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => isEnumValue(managed_collection_model_1.ManagedCollectionBinColor, item));
    if (!normalizedBins.length) {
        res.status(400).json({ message: 'Please choose at least one bin package color.' });
        return;
    }
    if (!isEnumValue(managed_collection_model_1.ManagedCollectionFrequency, frequency)) {
        res.status(400).json({ message: 'Invalid collection frequency.' });
        return;
    }
    if (!isEnumValue(managed_collection_model_1.ManagedCollectionDay, preferredCollectionDay)) {
        res.status(400).json({ message: 'Invalid preferred collection day.' });
        return;
    }
    const availability = await (0, service_availability_service_1.validateServiceBookable)({
        countryCode,
        city,
        area,
        serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
    });
    if (!availability.allowed) {
        res.status(409).json({
            message: availability.message || 'Managed Collection Services are not available in this location.',
            serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
            serviceStatus: availability.service?.status,
            waitlistAvailable: availability.service?.status === 'COMING_SOON',
        });
        return;
    }
    try {
        const nextCollectionDate = (0, exports.calculateNextCollectionDate)(preferredCollectionDay);
        const profile = await managed_collection_model_1.default.create({
            customerId: new mongoose_1.default.Types.ObjectId(customerId),
            customerName: customer.name || 'Client',
            customerEmail: customer.email || authUser?.email || '',
            customerPhone: customer.phone || '',
            countryCode,
            city,
            area,
            fullAddress,
            propertyType,
            collectionType,
            binPackage: normalizedBins,
            frequency,
            preferredCollectionDay,
            nextCollectionDate,
            status: managed_collection_model_1.ManagedCollectionProfileStatus.ACTIVE,
            metadata: {
                serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
            },
        });
        const reminders = await createCollectionReminders(profile);
        const dayBeforeNotifications = await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_REMINDER, reminderDateFor(profile.nextCollectionDate, notification_reminder_model_1.ReminderType.DAY_BEFORE_COLLECTION));
        const collectionDayNotifications = await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_TODAY, reminderDateFor(profile.nextCollectionDate, notification_reminder_model_1.ReminderType.COLLECTION_DAY));
        const collectionJob = await ensureCollectionJobForProfile(profile);
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'managed_collection.profile.create',
            module: 'MARKET',
            resourceType: 'ManagedCollectionProfile',
            resourceId: profile._id.toString(),
            metadata: {
                countryCode,
                city,
                area,
                collectionType,
                frequency,
                preferredCollectionDay,
                reminderCount: reminders.length,
                notificationCount: dayBeforeNotifications.length + collectionDayNotifications.length,
                collectionJobId: collectionJob._id.toString(),
            },
        });
        res.status(201).json({
            success: true,
            profile,
            reminders,
            notifications: [...dayBeforeNotifications, ...collectionDayNotifications],
            collectionJob,
        });
    }
    catch (error) {
        console.error('Failed to create managed collection profile:', error);
        res.status(500).json({ message: 'Unable to create managed collection profile.' });
    }
};
exports.createManagedCollectionProfile = createManagedCollectionProfile;
const listAdminManagedCollections = async (req, res) => {
    try {
        const filter = {};
        if (typeof req.query.countryCode === 'string' && req.query.countryCode)
            filter.countryCode = req.query.countryCode.toUpperCase();
        if (typeof req.query.city === 'string' && req.query.city)
            filter.city = new RegExp(req.query.city, 'i');
        if (typeof req.query.status === 'string' && req.query.status)
            filter.status = req.query.status;
        const profiles = await managed_collection_model_1.default.find(filter)
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        const profileIds = profiles.map((profile) => profile._id);
        const reminders = await notification_reminder_model_1.default.find({
            targetType: 'ManagedCollectionProfile',
            targetId: { $in: profileIds },
        })
            .sort({ scheduledFor: 1 })
            .limit(500)
            .lean();
        res.status(200).json({
            success: true,
            profiles,
            reminders,
            meta: {
                propertyTypes: Object.values(managed_collection_model_1.ManagedCollectionPropertyType),
                collectionTypes: Object.values(managed_collection_model_1.ManagedCollectionType),
                binColors: Object.values(managed_collection_model_1.ManagedCollectionBinColor),
                frequencies: Object.values(managed_collection_model_1.ManagedCollectionFrequency),
                days: Object.values(managed_collection_model_1.ManagedCollectionDay),
                reminderTypes: Object.values(notification_reminder_model_1.ReminderType),
                reminderStatuses: Object.values(notification_reminder_model_1.ReminderStatus),
                reminderChannels: Object.values(notification_reminder_model_1.ReminderChannel),
            },
        });
    }
    catch (error) {
        console.error('Failed to list managed collection profiles:', error);
        res.status(500).json({ message: 'Failed to list managed collection profiles.' });
    }
};
exports.listAdminManagedCollections = listAdminManagedCollections;
const updateManagedCollectionReminder = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid reminder id.' });
        return;
    }
    const updates = {};
    if (typeof req.body.scheduledFor === 'string' || req.body.scheduledFor instanceof Date) {
        const scheduledFor = new Date(req.body.scheduledFor);
        if (Number.isNaN(scheduledFor.getTime())) {
            res.status(400).json({ message: 'Invalid reminder schedule date.' });
            return;
        }
        updates.scheduledFor = scheduledFor;
        updates.status = notification_reminder_model_1.ReminderStatus.PENDING;
        updates.cancelledAt = null;
    }
    if (req.body.status === notification_reminder_model_1.ReminderStatus.CANCELLED) {
        updates.status = notification_reminder_model_1.ReminderStatus.CANCELLED;
        updates.cancelledAt = new Date();
    }
    if (!Object.keys(updates).length) {
        res.status(400).json({ message: 'No supported reminder update supplied.' });
        return;
    }
    try {
        const before = await notification_reminder_model_1.default.findById(id).lean();
        const reminder = await notification_reminder_model_1.default.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!reminder) {
            res.status(404).json({ message: 'Reminder not found.' });
            return;
        }
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'managed_collection.reminder.update',
            module: 'MARKET',
            resourceType: 'NotificationReminder',
            resourceId: reminder._id.toString(),
            changes: {
                before,
                after: reminder.toObject(),
            },
        });
        res.status(200).json({ success: true, reminder });
    }
    catch (error) {
        console.error('Failed to update managed collection reminder:', error);
        res.status(500).json({ message: 'Failed to update reminder.' });
    }
};
exports.updateManagedCollectionReminder = updateManagedCollectionReminder;
const listAdminCollectionOperations = async (req, res) => {
    try {
        await generateCollectionJobs();
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const tomorrow = new Date(todayStart);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowEnd = endOfDay(tomorrow);
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const filter = buildJobFilter(req.query);
        if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
            const range = {};
            if (typeof req.query.from === 'string' && req.query.from) {
                const from = new Date(req.query.from);
                if (!Number.isNaN(from.getTime()))
                    range.$gte = from;
            }
            if (typeof req.query.to === 'string' && req.query.to) {
                const to = new Date(req.query.to);
                if (!Number.isNaN(to.getTime()))
                    range.$lte = to;
            }
            if (Object.keys(range).length)
                filter.scheduledFor = range;
        }
        const [jobs, activeCustomers, collectionsToday, collectionsTomorrow, collectionsThisWeek, completedThisMonth, missedCollections, upcomingCollections,] = await Promise.all([
            managed_collection_job_model_1.default.find(filter).sort({ scheduledFor: 1 }).limit(500).lean(),
            managed_collection_model_1.default.countDocuments({ status: managed_collection_model_1.ManagedCollectionProfileStatus.ACTIVE }),
            managed_collection_job_model_1.default.countDocuments({
                scheduledFor: { $gte: todayStart, $lte: todayEnd },
                status: { $nin: [managed_collection_job_model_1.ManagedCollectionJobStatus.CANCELLED] },
            }),
            managed_collection_job_model_1.default.countDocuments({
                scheduledFor: { $gte: tomorrow, $lte: tomorrowEnd },
                status: { $nin: [managed_collection_job_model_1.ManagedCollectionJobStatus.CANCELLED] },
            }),
            managed_collection_job_model_1.default.countDocuments({
                scheduledFor: { $gte: weekStart, $lte: weekEnd },
                status: { $nin: [managed_collection_job_model_1.ManagedCollectionJobStatus.CANCELLED] },
            }),
            managed_collection_job_model_1.default.countDocuments({
                completedAt: { $gte: monthStart, $lte: monthEnd },
                status: managed_collection_job_model_1.ManagedCollectionJobStatus.COMPLETED,
            }),
            managed_collection_job_model_1.default.countDocuments({
                $or: [
                    { status: managed_collection_job_model_1.ManagedCollectionJobStatus.MISSED },
                    {
                        status: { $in: [managed_collection_job_model_1.ManagedCollectionJobStatus.SCHEDULED, managed_collection_job_model_1.ManagedCollectionJobStatus.ASSIGNED, managed_collection_job_model_1.ManagedCollectionJobStatus.IN_PROGRESS] },
                        scheduledFor: { $lt: todayStart },
                    },
                ],
            }),
            managed_collection_job_model_1.default.countDocuments({
                scheduledFor: { $gte: now },
                status: { $in: [managed_collection_job_model_1.ManagedCollectionJobStatus.SCHEDULED, managed_collection_job_model_1.ManagedCollectionJobStatus.ASSIGNED, managed_collection_job_model_1.ManagedCollectionJobStatus.IN_PROGRESS] },
            }),
        ]);
        res.status(200).json({
            success: true,
            jobs,
            metrics: {
                activeCollectionCustomers: activeCustomers,
                collectionsToday,
                collectionsTomorrow,
                collectionsThisWeek,
                completedThisMonth,
                missedCollections,
                upcomingCollections,
            },
            calendar: {
                today: { from: todayStart, to: todayEnd },
                tomorrow: { from: tomorrow, to: tomorrowEnd },
                week: { from: weekStart, to: weekEnd },
                month: { from: monthStart, to: monthEnd },
            },
            meta: {
                statuses: Object.values(managed_collection_job_model_1.ManagedCollectionJobStatus),
                collectionTypes: Object.values(managed_collection_model_1.ManagedCollectionType),
                frequencies: Object.values(managed_collection_model_1.ManagedCollectionFrequency),
                days: Object.values(managed_collection_model_1.ManagedCollectionDay),
            },
        });
    }
    catch (error) {
        console.error('Failed to list collection operations:', error);
        res.status(500).json({ message: 'Failed to list collection operations.' });
    }
};
exports.listAdminCollectionOperations = listAdminCollectionOperations;
const getAdminCollectionProfile = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid managed collection profile id.' });
        return;
    }
    try {
        const profile = await managed_collection_model_1.default.findById(id).lean();
        if (!profile) {
            res.status(404).json({ message: 'Managed collection profile not found.' });
            return;
        }
        const [jobs, reminders] = await Promise.all([
            managed_collection_job_model_1.default.find({ profileId: id }).sort({ scheduledFor: -1 }).limit(100).lean(),
            notification_reminder_model_1.default.find({ targetType: 'ManagedCollectionProfile', targetId: id }).sort({ scheduledFor: 1 }).lean(),
        ]);
        res.status(200).json({
            success: true,
            profile,
            jobs,
            reminders,
            history: jobs.flatMap((job) => job.history || []),
        });
    }
    catch (error) {
        console.error('Failed to load managed collection profile:', error);
        res.status(500).json({ message: 'Failed to load managed collection profile.' });
    }
};
exports.getAdminCollectionProfile = getAdminCollectionProfile;
const updateManagedCollectionJob = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid collection job id.' });
        return;
    }
    const action = String(req.body.action || '').trim().toUpperCase();
    const notes = normalizeText(req.body.notes);
    const missedReason = normalizeText(req.body.missedReason);
    const photos = Array.isArray(req.body.photos)
        ? req.body.photos.map((photo) => normalizeText(photo)).filter(Boolean)
        : [];
    if (!['MARK_COMPLETED', 'MARK_MISSED', 'RESCHEDULE', 'CANCEL'].includes(action)) {
        res.status(400).json({ message: 'Unsupported collection job action.' });
        return;
    }
    try {
        const job = await managed_collection_job_model_1.default.findById(id);
        if (!job) {
            res.status(404).json({ message: 'Collection job not found.' });
            return;
        }
        if (!editableJobStatuses.has(job.status) && action !== 'RESCHEDULE') {
            res.status(409).json({ message: `Collection job is already ${job.status}.` });
            return;
        }
        const before = job.toObject();
        const actorId = getActorObjectId(req);
        if (action === 'MARK_COMPLETED') {
            job.status = managed_collection_job_model_1.ManagedCollectionJobStatus.COMPLETED;
            job.completedAt = new Date();
            job.notes = notes;
            job.photos = photos;
            job.history.push(jobActionHistory(managed_collection_job_model_1.ManagedCollectionJobStatus.COMPLETED, job.completedAt, actorId, notes, '', photos));
            const profile = await managed_collection_model_1.default.findById(job.profileId);
            if (profile) {
                profile.nextCollectionDate = (0, exports.calculateNextCollectionDateByFrequency)(job.scheduledFor, profile.frequency, profile.preferredCollectionDay);
                await profile.save();
                await ensureCollectionJobForProfile(profile);
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_REMINDER, reminderDateFor(profile.nextCollectionDate, notification_reminder_model_1.ReminderType.DAY_BEFORE_COLLECTION));
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_TODAY, reminderDateFor(profile.nextCollectionDate, notification_reminder_model_1.ReminderType.COLLECTION_DAY));
            }
        }
        if (action === 'MARK_MISSED') {
            if (!missedReason) {
                res.status(400).json({ message: 'Missed reason is required.' });
                return;
            }
            job.status = managed_collection_job_model_1.ManagedCollectionJobStatus.MISSED;
            job.missedReason = missedReason;
            job.notes = notes;
            job.history.push(jobActionHistory(managed_collection_job_model_1.ManagedCollectionJobStatus.MISSED, job.scheduledFor, actorId, notes, missedReason));
            const profile = await managed_collection_model_1.default.findById(job.profileId);
            if (profile) {
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_MISSED, new Date(), {
                    message: `Your Managed Collection Services pickup was marked as missed. Reason: ${missedReason}`,
                });
            }
        }
        if (action === 'RESCHEDULE') {
            const scheduledFor = new Date(req.body.scheduledFor);
            if (Number.isNaN(scheduledFor.getTime())) {
                res.status(400).json({ message: 'Valid reschedule date is required.' });
                return;
            }
            job.scheduledFor = scheduledFor;
            job.status = managed_collection_job_model_1.ManagedCollectionJobStatus.SCHEDULED;
            job.completedAt = null;
            job.history.push(jobActionHistory(managed_collection_job_model_1.ManagedCollectionJobStatus.SCHEDULED, scheduledFor, actorId, notes || 'Collection rescheduled.'));
            await managed_collection_model_1.default.findByIdAndUpdate(job.profileId, {
                nextCollectionDate: scheduledFor,
            });
            const profile = await managed_collection_model_1.default.findById(job.profileId);
            if (profile) {
                profile.nextCollectionDate = scheduledFor;
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_RESCHEDULED, new Date());
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_REMINDER, reminderDateFor(scheduledFor, notification_reminder_model_1.ReminderType.DAY_BEFORE_COLLECTION));
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_TODAY, reminderDateFor(scheduledFor, notification_reminder_model_1.ReminderType.COLLECTION_DAY));
            }
        }
        if (action === 'CANCEL') {
            job.status = managed_collection_job_model_1.ManagedCollectionJobStatus.CANCELLED;
            job.notes = notes;
            job.history.push(jobActionHistory(managed_collection_job_model_1.ManagedCollectionJobStatus.CANCELLED, job.scheduledFor, actorId, notes || 'Collection cancelled.'));
            const profile = await managed_collection_model_1.default.findById(job.profileId);
            if (profile) {
                await createManagedCollectionNotifications(profile, notification_model_1.NotificationType.COLLECTION_CANCELLED, new Date());
            }
        }
        await job.save();
        await (0, audit_service_1.logAuditEvent)(req, {
            action: `managed_collection.job.${action.toLowerCase()}`,
            module: 'MARKET',
            resourceType: 'ManagedCollectionJob',
            resourceId: job._id.toString(),
            changes: {
                before,
                after: job.toObject(),
            },
            metadata: {
                profileId: job.profileId.toString(),
                scheduledFor: job.scheduledFor,
                status: job.status,
            },
        });
        res.status(200).json({ success: true, job });
    }
    catch (error) {
        console.error('Failed to update collection job:', error);
        res.status(500).json({ message: 'Failed to update collection job.' });
    }
};
exports.updateManagedCollectionJob = updateManagedCollectionJob;
//# sourceMappingURL=managed-collection.controller.js.map