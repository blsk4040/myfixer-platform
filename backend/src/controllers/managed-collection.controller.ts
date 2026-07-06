import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ManagedCollectionProfile, {
  ManagedCollectionBinColor,
  ManagedCollectionDay,
  ManagedCollectionFrequency,
  ManagedCollectionProfileStatus,
  ManagedCollectionPropertyType,
  ManagedCollectionType,
} from '../models/managed-collection.model';
import ManagedCollectionJob, {
  ManagedCollectionJobStatus,
} from '../models/managed-collection-job.model';
import NotificationReminder, {
  ReminderChannel,
  ReminderStatus,
  ReminderType,
} from '../models/notification-reminder.model';
import {
  NotificationChannel,
  NotificationType,
} from '../models/notification.model';
import User from '../models/user.model';
import { normalizeCountryCode } from '../config/market.config';
import { logAuditEvent } from '../services/audit.service';
import { validateServiceBookable } from '../services/service-availability.service';
import { createNotifications } from '../services/notification.service';

const MANAGED_COLLECTION_SERVICE_KEY = 'managed_collection';

const dayIndexes: Record<ManagedCollectionDay, number> = {
  [ManagedCollectionDay.SUNDAY]: 0,
  [ManagedCollectionDay.MONDAY]: 1,
  [ManagedCollectionDay.TUESDAY]: 2,
  [ManagedCollectionDay.WEDNESDAY]: 3,
  [ManagedCollectionDay.THURSDAY]: 4,
  [ManagedCollectionDay.FRIDAY]: 5,
  [ManagedCollectionDay.SATURDAY]: 6,
};

const editableJobStatuses = new Set<ManagedCollectionJobStatus>([
  ManagedCollectionJobStatus.SCHEDULED,
  ManagedCollectionJobStatus.ASSIGNED,
  ManagedCollectionJobStatus.IN_PROGRESS,
]);

const getAuthenticatedUser = (request: Request) =>
  (request as any).user as
    | { id?: string; _id?: string; email?: string; role?: string }
    | undefined;

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const isEnumValue = <T extends Record<string, string>>(targetEnum: T, value: unknown): value is T[keyof T] =>
  typeof value === 'string' && Object.values(targetEnum).includes(value);

export const calculateNextCollectionDate = (
  preferredDay: ManagedCollectionDay,
  fromDate = new Date()
): Date => {
  const start = new Date(fromDate);
  start.setHours(9, 0, 0, 0);
  const targetDay = dayIndexes[preferredDay];
  const diff = (targetDay - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + (diff === 0 ? 7 : diff));
  return start;
};

export const calculateNextCollectionDateByFrequency = (
  lastCollectionDate: Date,
  frequency: ManagedCollectionFrequency,
  preferredDay: ManagedCollectionDay
): Date => {
  const next = new Date(lastCollectionDate);
  next.setHours(9, 0, 0, 0);

  if (frequency === ManagedCollectionFrequency.TWICE_WEEKLY) {
    next.setDate(next.getDate() + 3);
    return next;
  }

  if (frequency === ManagedCollectionFrequency.MONTHLY) {
    next.setMonth(next.getMonth() + 1);
    return calculateNextCollectionDate(preferredDay, next);
  }

  next.setDate(next.getDate() + 7);
  return calculateNextCollectionDate(preferredDay, next);
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const startOfWeek = (value: Date) => {
  const date = startOfDay(value);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
};

const endOfWeek = (value: Date) => {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  return endOfDay(date);
};

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);

const endOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);

const getActorObjectId = (request: Request) => {
  const authUser = getAuthenticatedUser(request);
  const actorId = String(authUser?.id ?? authUser?._id ?? '').trim();
  return mongoose.Types.ObjectId.isValid(actorId) ? new mongoose.Types.ObjectId(actorId) : undefined;
};

const buildJobFromProfile = (profile: InstanceType<typeof ManagedCollectionProfile>, scheduledFor: Date) => ({
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
  status: ManagedCollectionJobStatus.SCHEDULED,
  metadata: {
    serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
    generatedFromProfileNextCollectionDate: profile.nextCollectionDate,
  },
});

const ensureCollectionJobForProfile = async (profile: InstanceType<typeof ManagedCollectionProfile>) => {
  const scheduledFor = new Date(profile.nextCollectionDate);
  const job = await ManagedCollectionJob.findOneAndUpdate(
    {
      profileId: profile._id,
      scheduledFor,
    },
    {
      $setOnInsert: buildJobFromProfile(profile, scheduledFor),
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );

  return job;
};

const generateCollectionJobs = async () => {
  const profiles = await ManagedCollectionProfile.find({
    status: ManagedCollectionProfileStatus.ACTIVE,
  });

  const jobs = await Promise.all(profiles.map((profile) => ensureCollectionJobForProfile(profile)));
  return jobs;
};

const buildJobFilter = (query: Request['query']) => {
  const filter: Record<string, unknown> = {};
  if (typeof query.countryCode === 'string' && query.countryCode) filter.countryCode = query.countryCode.toUpperCase();
  if (typeof query.city === 'string' && query.city) filter.city = new RegExp(query.city, 'i');
  if (typeof query.area === 'string' && query.area) filter.area = new RegExp(query.area, 'i');
  if (typeof query.collectionType === 'string' && query.collectionType) filter.collectionType = query.collectionType;
  if (typeof query.status === 'string' && query.status) filter.status = query.status;
  if (typeof query.preferredDay === 'string' && query.preferredDay) filter.preferredCollectionDay = query.preferredDay;
  return filter;
};

const jobActionHistory = (
  status: ManagedCollectionJobStatus,
  collectionDate: Date,
  actorId?: mongoose.Types.ObjectId,
  notes = '',
  missedReason = '',
  photos: string[] = []
) => ({
  collectionDate,
  completedBy: actorId,
  notes,
  photos,
  missedReason,
  status,
  createdAt: new Date(),
});

const reminderDateFor = (nextCollectionDate: Date, reminderType: ReminderType): Date => {
  const scheduledFor = new Date(nextCollectionDate);
  if (reminderType === ReminderType.DAY_BEFORE_COLLECTION) {
    scheduledFor.setDate(scheduledFor.getDate() - 1);
    scheduledFor.setHours(18, 0, 0, 0);
    return scheduledFor;
  }

  scheduledFor.setHours(7, 0, 0, 0);
  return scheduledFor;
};

const formatCollectionDate = (value: Date) =>
  new Intl.DateTimeFormat('en', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value);

const createCollectionReminders = async (profile: InstanceType<typeof ManagedCollectionProfile>) => {
  const basePayload = {
    profileId: profile._id.toString(),
    serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
    collectionType: profile.collectionType,
    binPackage: profile.binPackage,
    frequency: profile.frequency,
    nextCollectionDate: profile.nextCollectionDate,
  };

  return NotificationReminder.create([
    {
      customerId: profile.customerId,
      targetType: 'ManagedCollectionProfile',
      targetId: profile._id,
      reminderType: ReminderType.DAY_BEFORE_COLLECTION,
      channels: [ReminderChannel.IN_APP],
      status: ReminderStatus.PENDING,
      scheduledFor: reminderDateFor(profile.nextCollectionDate, ReminderType.DAY_BEFORE_COLLECTION),
      payload: basePayload,
    },
    {
      customerId: profile.customerId,
      targetType: 'ManagedCollectionProfile',
      targetId: profile._id,
      reminderType: ReminderType.COLLECTION_DAY,
      channels: [ReminderChannel.IN_APP],
      status: ReminderStatus.PENDING,
      scheduledFor: reminderDateFor(profile.nextCollectionDate, ReminderType.COLLECTION_DAY),
      payload: basePayload,
    },
  ]);
};

const createManagedCollectionNotifications = async (
  profile: InstanceType<typeof ManagedCollectionProfile>,
  event: NotificationType,
  scheduledAt?: Date,
  overrides: Partial<{ title: string; message: string }> = {}
) => {
  const collectionDate = formatCollectionDate(profile.nextCollectionDate);
  const defaults: Record<string, { title: string; message: string }> = {
    [NotificationType.COLLECTION_REMINDER]: {
      title: 'Collection reminder',
      message: `Your Managed Collection Services pickup is scheduled for ${collectionDate}.`,
    },
    [NotificationType.COLLECTION_TODAY]: {
      title: 'Collection today',
      message: `Your Managed Collection Services pickup is scheduled for today.`,
    },
    [NotificationType.COLLECTION_RESCHEDULED]: {
      title: 'Collection rescheduled',
      message: `Your Managed Collection Services pickup has been rescheduled to ${collectionDate}.`,
    },
    [NotificationType.COLLECTION_CANCELLED]: {
      title: 'Collection cancelled',
      message: 'Your Managed Collection Services pickup has been cancelled.',
    },
    [NotificationType.COLLECTION_MISSED]: {
      title: 'Collection missed',
      message: 'Your Managed Collection Services pickup was marked as missed.',
    },
    [NotificationType.SYSTEM]: {
      title: 'MyFixer notification',
      message: 'You have a new MyFixer notification.',
    },
  };

  return createNotifications({
    userId: profile.customerId,
    email: profile.customerEmail,
    phone: profile.customerPhone,
    name: profile.customerName,
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    type: event,
    title: overrides.title || defaults[event]?.title || defaults[NotificationType.SYSTEM].title,
    message: overrides.message || defaults[event]?.message || defaults[NotificationType.SYSTEM].message,
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

export const createManagedCollectionProfile = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthenticatedUser(req);
  const customerId = String(authUser?.id ?? authUser?._id ?? '').trim();

  if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
    res.status(401).json({ message: 'Valid customer identity is required.' });
    return;
  }

  const customer = await User.findById(customerId).select('name email phone countryCode location').lean();
  if (!customer) {
    res.status(404).json({ message: 'Customer account not found.' });
    return;
  }

  const countryCode = normalizeCountryCode(req.body.countryCode ?? customer.countryCode);
  const city = normalizeText(req.body.city) || customer.location?.city || '';
  const area = normalizeText(req.body.area) || customer.location?.area || '';
  const fullAddress = normalizeText(req.body.fullAddress);
  const propertyType = req.body.propertyType;
  const collectionType = req.body.collectionType || ManagedCollectionType.GENERAL_WASTE;
  const binPackage = Array.isArray(req.body.binPackage) ? req.body.binPackage : [];
  const frequency = req.body.frequency;
  const preferredCollectionDay = req.body.preferredCollectionDay;

  if (!city || !fullAddress) {
    res.status(400).json({ message: 'City and full address are required.' });
    return;
  }

  if (!isEnumValue(ManagedCollectionPropertyType, propertyType)) {
    res.status(400).json({ message: 'Invalid property type.' });
    return;
  }

  if (!isEnumValue(ManagedCollectionType, collectionType)) {
    res.status(400).json({ message: 'Invalid collection type.' });
    return;
  }

  if (collectionType !== ManagedCollectionType.GENERAL_WASTE) {
    res.status(400).json({ message: 'Only GENERAL_WASTE is available in this phase.' });
    return;
  }

  const normalizedBins = binPackage
    .map((item: unknown) => String(item || '').trim().toUpperCase())
    .filter((item: string): item is ManagedCollectionBinColor => isEnumValue(ManagedCollectionBinColor, item));

  if (!normalizedBins.length) {
    res.status(400).json({ message: 'Please choose at least one bin package color.' });
    return;
  }

  if (!isEnumValue(ManagedCollectionFrequency, frequency)) {
    res.status(400).json({ message: 'Invalid collection frequency.' });
    return;
  }

  if (!isEnumValue(ManagedCollectionDay, preferredCollectionDay)) {
    res.status(400).json({ message: 'Invalid preferred collection day.' });
    return;
  }

  const availability = await validateServiceBookable({
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
    const nextCollectionDate = calculateNextCollectionDate(preferredCollectionDay);
    const profile = await ManagedCollectionProfile.create({
      customerId: new mongoose.Types.ObjectId(customerId),
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
      status: ManagedCollectionProfileStatus.ACTIVE,
      metadata: {
        serviceKey: MANAGED_COLLECTION_SERVICE_KEY,
      },
    });

    const reminders = await createCollectionReminders(profile);
    const dayBeforeNotifications = await createManagedCollectionNotifications(
      profile,
      NotificationType.COLLECTION_REMINDER,
      reminderDateFor(profile.nextCollectionDate, ReminderType.DAY_BEFORE_COLLECTION)
    );
    const collectionDayNotifications = await createManagedCollectionNotifications(
      profile,
      NotificationType.COLLECTION_TODAY,
      reminderDateFor(profile.nextCollectionDate, ReminderType.COLLECTION_DAY)
    );
    const collectionJob = await ensureCollectionJobForProfile(profile);

    await logAuditEvent(req, {
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
  } catch (error) {
    console.error('Failed to create managed collection profile:', error);
    res.status(500).json({ message: 'Unable to create managed collection profile.' });
  }
};

export const listAdminManagedCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.countryCode === 'string' && req.query.countryCode) filter.countryCode = req.query.countryCode.toUpperCase();
    if (typeof req.query.city === 'string' && req.query.city) filter.city = new RegExp(req.query.city, 'i');
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;

    const profiles = await ManagedCollectionProfile.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const profileIds = profiles.map((profile) => profile._id);
    const reminders = await NotificationReminder.find({
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
        propertyTypes: Object.values(ManagedCollectionPropertyType),
        collectionTypes: Object.values(ManagedCollectionType),
        binColors: Object.values(ManagedCollectionBinColor),
        frequencies: Object.values(ManagedCollectionFrequency),
        days: Object.values(ManagedCollectionDay),
        reminderTypes: Object.values(ReminderType),
        reminderStatuses: Object.values(ReminderStatus),
        reminderChannels: Object.values(ReminderChannel),
      },
    });
  } catch (error) {
    console.error('Failed to list managed collection profiles:', error);
    res.status(500).json({ message: 'Failed to list managed collection profiles.' });
  }
};

export const updateManagedCollectionReminder = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid reminder id.' });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (typeof req.body.scheduledFor === 'string' || req.body.scheduledFor instanceof Date) {
    const scheduledFor = new Date(req.body.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      res.status(400).json({ message: 'Invalid reminder schedule date.' });
      return;
    }
    updates.scheduledFor = scheduledFor;
    updates.status = ReminderStatus.PENDING;
    updates.cancelledAt = null;
  }

  if (req.body.status === ReminderStatus.CANCELLED) {
    updates.status = ReminderStatus.CANCELLED;
    updates.cancelledAt = new Date();
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ message: 'No supported reminder update supplied.' });
    return;
  }

  try {
    const before = await NotificationReminder.findById(id).lean();
    const reminder = await NotificationReminder.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!reminder) {
      res.status(404).json({ message: 'Reminder not found.' });
      return;
    }

    await logAuditEvent(req, {
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
  } catch (error) {
    console.error('Failed to update managed collection reminder:', error);
    res.status(500).json({ message: 'Failed to update reminder.' });
  }
};

export const listAdminCollectionOperations = async (req: Request, res: Response): Promise<void> => {
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
      const range: Record<string, Date> = {};
      if (typeof req.query.from === 'string' && req.query.from) {
        const from = new Date(req.query.from);
        if (!Number.isNaN(from.getTime())) range.$gte = from;
      }
      if (typeof req.query.to === 'string' && req.query.to) {
        const to = new Date(req.query.to);
        if (!Number.isNaN(to.getTime())) range.$lte = to;
      }
      if (Object.keys(range).length) filter.scheduledFor = range;
    }

    const [
      jobs,
      activeCustomers,
      collectionsToday,
      collectionsTomorrow,
      collectionsThisWeek,
      completedThisMonth,
      missedCollections,
      upcomingCollections,
    ] = await Promise.all([
      ManagedCollectionJob.find(filter).sort({ scheduledFor: 1 }).limit(500).lean(),
      ManagedCollectionProfile.countDocuments({ status: ManagedCollectionProfileStatus.ACTIVE }),
      ManagedCollectionJob.countDocuments({
        scheduledFor: { $gte: todayStart, $lte: todayEnd },
        status: { $nin: [ManagedCollectionJobStatus.CANCELLED] },
      }),
      ManagedCollectionJob.countDocuments({
        scheduledFor: { $gte: tomorrow, $lte: tomorrowEnd },
        status: { $nin: [ManagedCollectionJobStatus.CANCELLED] },
      }),
      ManagedCollectionJob.countDocuments({
        scheduledFor: { $gte: weekStart, $lte: weekEnd },
        status: { $nin: [ManagedCollectionJobStatus.CANCELLED] },
      }),
      ManagedCollectionJob.countDocuments({
        completedAt: { $gte: monthStart, $lte: monthEnd },
        status: ManagedCollectionJobStatus.COMPLETED,
      }),
      ManagedCollectionJob.countDocuments({
        $or: [
          { status: ManagedCollectionJobStatus.MISSED },
          {
            status: { $in: [ManagedCollectionJobStatus.SCHEDULED, ManagedCollectionJobStatus.ASSIGNED, ManagedCollectionJobStatus.IN_PROGRESS] },
            scheduledFor: { $lt: todayStart },
          },
        ],
      }),
      ManagedCollectionJob.countDocuments({
        scheduledFor: { $gte: now },
        status: { $in: [ManagedCollectionJobStatus.SCHEDULED, ManagedCollectionJobStatus.ASSIGNED, ManagedCollectionJobStatus.IN_PROGRESS] },
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
        statuses: Object.values(ManagedCollectionJobStatus),
        collectionTypes: Object.values(ManagedCollectionType),
        frequencies: Object.values(ManagedCollectionFrequency),
        days: Object.values(ManagedCollectionDay),
      },
    });
  } catch (error) {
    console.error('Failed to list collection operations:', error);
    res.status(500).json({ message: 'Failed to list collection operations.' });
  }
};

export const getAdminCollectionProfile = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid managed collection profile id.' });
    return;
  }

  try {
    const profile = await ManagedCollectionProfile.findById(id).lean();
    if (!profile) {
      res.status(404).json({ message: 'Managed collection profile not found.' });
      return;
    }

    const [jobs, reminders] = await Promise.all([
      ManagedCollectionJob.find({ profileId: id }).sort({ scheduledFor: -1 }).limit(100).lean(),
      NotificationReminder.find({ targetType: 'ManagedCollectionProfile', targetId: id }).sort({ scheduledFor: 1 }).lean(),
    ]);

    res.status(200).json({
      success: true,
      profile,
      jobs,
      reminders,
      history: jobs.flatMap((job) => job.history || []),
    });
  } catch (error) {
    console.error('Failed to load managed collection profile:', error);
    res.status(500).json({ message: 'Failed to load managed collection profile.' });
  }
};

export const updateManagedCollectionJob = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid collection job id.' });
    return;
  }

  const action = String(req.body.action || '').trim().toUpperCase();
  const notes = normalizeText(req.body.notes);
  const missedReason = normalizeText(req.body.missedReason);
  const photos = Array.isArray(req.body.photos)
    ? req.body.photos.map((photo: unknown) => normalizeText(photo)).filter(Boolean)
    : [];

  if (!['MARK_COMPLETED', 'MARK_MISSED', 'RESCHEDULE', 'CANCEL'].includes(action)) {
    res.status(400).json({ message: 'Unsupported collection job action.' });
    return;
  }

  try {
    const job = await ManagedCollectionJob.findById(id);
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
      job.status = ManagedCollectionJobStatus.COMPLETED;
      job.completedAt = new Date();
      job.notes = notes;
      job.photos = photos;
      job.history.push(jobActionHistory(ManagedCollectionJobStatus.COMPLETED, job.completedAt, actorId, notes, '', photos));

      const profile = await ManagedCollectionProfile.findById(job.profileId);
      if (profile) {
        profile.nextCollectionDate = calculateNextCollectionDateByFrequency(
          job.scheduledFor,
          profile.frequency,
          profile.preferredCollectionDay
        );
        await profile.save();
        await ensureCollectionJobForProfile(profile);
        await createManagedCollectionNotifications(
          profile,
          NotificationType.COLLECTION_REMINDER,
          reminderDateFor(profile.nextCollectionDate, ReminderType.DAY_BEFORE_COLLECTION)
        );
        await createManagedCollectionNotifications(
          profile,
          NotificationType.COLLECTION_TODAY,
          reminderDateFor(profile.nextCollectionDate, ReminderType.COLLECTION_DAY)
        );
      }
    }

    if (action === 'MARK_MISSED') {
      if (!missedReason) {
        res.status(400).json({ message: 'Missed reason is required.' });
        return;
      }
      job.status = ManagedCollectionJobStatus.MISSED;
      job.missedReason = missedReason;
      job.notes = notes;
      job.history.push(jobActionHistory(ManagedCollectionJobStatus.MISSED, job.scheduledFor, actorId, notes, missedReason));
      const profile = await ManagedCollectionProfile.findById(job.profileId);
      if (profile) {
        await createManagedCollectionNotifications(profile, NotificationType.COLLECTION_MISSED, new Date(), {
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
      job.status = ManagedCollectionJobStatus.SCHEDULED;
      job.completedAt = null;
      job.history.push(jobActionHistory(ManagedCollectionJobStatus.SCHEDULED, scheduledFor, actorId, notes || 'Collection rescheduled.'));

      await ManagedCollectionProfile.findByIdAndUpdate(job.profileId, {
        nextCollectionDate: scheduledFor,
      });
      const profile = await ManagedCollectionProfile.findById(job.profileId);
      if (profile) {
        profile.nextCollectionDate = scheduledFor;
        await createManagedCollectionNotifications(profile, NotificationType.COLLECTION_RESCHEDULED, new Date());
        await createManagedCollectionNotifications(
          profile,
          NotificationType.COLLECTION_REMINDER,
          reminderDateFor(scheduledFor, ReminderType.DAY_BEFORE_COLLECTION)
        );
        await createManagedCollectionNotifications(
          profile,
          NotificationType.COLLECTION_TODAY,
          reminderDateFor(scheduledFor, ReminderType.COLLECTION_DAY)
        );
      }
    }

    if (action === 'CANCEL') {
      job.status = ManagedCollectionJobStatus.CANCELLED;
      job.notes = notes;
      job.history.push(jobActionHistory(ManagedCollectionJobStatus.CANCELLED, job.scheduledFor, actorId, notes || 'Collection cancelled.'));
      const profile = await ManagedCollectionProfile.findById(job.profileId);
      if (profile) {
        await createManagedCollectionNotifications(profile, NotificationType.COLLECTION_CANCELLED, new Date());
      }
    }

    await job.save();

    await logAuditEvent(req, {
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
  } catch (error) {
    console.error('Failed to update collection job:', error);
    res.status(500).json({ message: 'Failed to update collection job.' });
  }
};
