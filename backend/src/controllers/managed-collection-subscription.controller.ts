import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  BillingFrequency,
  ManagedCollectionPlan,
  ManagedCollectionSubscription,
  ManagedCollectionSubscriptionInvoice,
  SubscriptionInvoiceStatus,
  SubscriptionPlanStatus,
  SubscriptionStatus,
} from '../models/managed-collection-subscription.model';
import {
  ManagedCollectionBinColor,
  ManagedCollectionFrequency,
  ManagedCollectionType,
} from '../models/managed-collection.model';
import User, { AdminRole } from '../models/user.model';
import { CurrencyCode, normalizeCountryCode } from '../config/market.config';
import { logAuditEvent } from '../services/audit.service';

const GRACE_PERIOD_DAYS = 7;

const getAuthUser = (req: Request) =>
  (req as any).user as { id?: string; _id?: string; email?: string; role?: string } | undefined;

const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const isEnumValue = <T extends Record<string, string>>(targetEnum: T, value: unknown): value is T[keyof T] =>
  typeof value === 'string' && Object.values(targetEnum).includes(value);

export const calculateNextBillingDate = (fromDate: Date, frequency: BillingFrequency): Date => {
  const next = new Date(fromDate);
  next.setHours(9, 0, 0, 0);
  if (frequency === BillingFrequency.WEEKLY) next.setDate(next.getDate() + 7);
  if (frequency === BillingFrequency.MONTHLY) next.setMonth(next.getMonth() + 1);
  if (frequency === BillingFrequency.QUARTERLY) next.setMonth(next.getMonth() + 3);
  if (frequency === BillingFrequency.YEARLY) next.setFullYear(next.getFullYear() + 1);
  return next;
};

const graceDateFor = (billingDate: Date) => {
  const grace = new Date(billingDate);
  grace.setDate(grace.getDate() + GRACE_PERIOD_DAYS);
  return grace;
};

const invoiceNumber = () => `MCS-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;

const sanitizeSubscription = (subscription: any) => {
  const source = typeof subscription?.toObject === 'function' ? subscription.toObject() : { ...(subscription || {}) };
  delete source.recurringPayment;
  return source;
};

const createSubscriptionInvoice = async (subscription: InstanceType<typeof ManagedCollectionSubscription>) => {
  const periodStart = subscription.previousBillingDate || subscription.startedAt;
  const periodEnd = subscription.nextBillingDate;
  return ManagedCollectionSubscriptionInvoice.create({
    invoiceNumber: invoiceNumber(),
    subscriptionId: subscription._id,
    planId: subscription.planId,
    customerId: subscription.customerId,
    countryCode: subscription.countryCode,
    currency: subscription.currency,
    amountMinor: subscription.priceMinor,
    billingPeriodStart: periodStart,
    billingPeriodEnd: periodEnd,
    dueAt: subscription.nextBillingDate,
    status: SubscriptionInvoiceStatus.UNPAID,
    metadata: {
      serviceKey: 'managed_collection',
      autoChargeEnabled: false,
      billingFrequency: subscription.billingFrequency,
    },
  });
};

const buildPlanPayload = (body: Record<string, unknown>) => {
  const name = normalizeText(body.name);
  const description = normalizeText(body.description);
  const countryCode = normalizeCountryCode(body.countryCode);
  const currency = String(body.currency || '').trim().toUpperCase() as CurrencyCode;
  const priceMinor = Number(body.priceMinor ?? Math.round(Number(body.price || 0) * 100));
  const billingFrequency = body.billingFrequency;
  const collectionFrequency = body.collectionFrequency;
  const collectionType = body.collectionType || ManagedCollectionType.GENERAL_WASTE;
  const status = body.status || SubscriptionPlanStatus.ACTIVE;
  const binPackage = Array.isArray(body.binPackage)
    ? body.binPackage.map((item) => String(item).trim().toUpperCase()).filter((item): item is ManagedCollectionBinColor => isEnumValue(ManagedCollectionBinColor, item))
    : [];

  if (!name) throw new Error('Plan name is required.');
  if (!Number.isFinite(priceMinor) || priceMinor < 0) throw new Error('Valid plan price is required.');
  if (!Object.values(CurrencyCode).includes(currency)) throw new Error('Valid currency is required.');
  if (!isEnumValue(BillingFrequency, billingFrequency)) throw new Error('Valid billing frequency is required.');
  if (!isEnumValue(ManagedCollectionFrequency, collectionFrequency)) throw new Error('Valid collection frequency is required.');
  if (!isEnumValue(ManagedCollectionType, collectionType)) throw new Error('Valid collection type is required.');
  if (!isEnumValue(SubscriptionPlanStatus, status)) throw new Error('Valid plan status is required.');
  if (!binPackage.length) throw new Error('At least one bin package color is required.');

  return {
    name,
    description,
    countryCode,
    currency,
    priceMinor,
    billingFrequency,
    collectionFrequency,
    collectionType,
    status,
    binPackage,
    metadata: {
      serviceKey: 'managed_collection',
    },
  };
};

export const listPublicSubscriptionPlans = async (req: Request, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = { status: SubscriptionPlanStatus.ACTIVE };
  if (typeof req.query.countryCode === 'string' && req.query.countryCode) {
    filter.countryCode = req.query.countryCode.toUpperCase();
  }
  const plans = await ManagedCollectionPlan.find(filter).sort({ priceMinor: 1 }).lean();
  res.status(200).json({ success: true, plans });
};

export const createAdminSubscriptionPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = buildPlanPayload(req.body);
    const plan = await ManagedCollectionPlan.create(payload);
    await logAuditEvent(req, {
      action: 'managed_collection.subscription_plan.create',
      module: 'MARKET',
      resourceType: 'ManagedCollectionPlan',
      resourceId: plan._id.toString(),
      changes: { after: plan.toObject() },
    });
    res.status(201).json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create plan.' });
  }
};

export const updateAdminSubscriptionPlan = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid plan id.' });
    return;
  }
  try {
    const before = await ManagedCollectionPlan.findById(id).lean();
    const payload = buildPlanPayload(req.body);
    const plan = await ManagedCollectionPlan.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
    if (!plan) {
      res.status(404).json({ message: 'Plan not found.' });
      return;
    }
    await logAuditEvent(req, {
      action: 'managed_collection.subscription_plan.update',
      module: 'MARKET',
      resourceType: 'ManagedCollectionPlan',
      resourceId: plan._id.toString(),
      changes: { before, after: plan.toObject() },
    });
    res.status(200).json({ success: true, plan });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update plan.' });
  }
};

export const getMyManagedCollectionSubscriptionDashboard = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const customerId = String(authUser?.id ?? authUser?._id ?? '');
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    res.status(401).json({ message: 'Valid customer identity is required.' });
    return;
  }

  const subscriptions = await ManagedCollectionSubscription.find({ customerId }).sort({ createdAt: -1 }).lean();
  const invoices = await ManagedCollectionSubscriptionInvoice.find({ customerId }).sort({ dueAt: -1 }).limit(50).lean();
  const safeSubscriptions = subscriptions.map(sanitizeSubscription);
  res.status(200).json({
    success: true,
    currentSubscription: safeSubscriptions.find((item) => [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED, SubscriptionStatus.PENDING].includes(item.status)) || null,
    subscriptions: safeSubscriptions,
    invoices,
  });
};

export const createManagedCollectionSubscription = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const customerId = String(authUser?.id ?? authUser?._id ?? '');
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    res.status(401).json({ message: 'Valid customer identity is required.' });
    return;
  }

  const planId = String(req.body.planId || '');
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    res.status(400).json({ message: 'Valid plan id is required.' });
    return;
  }

  const [customer, plan] = await Promise.all([
    User.findById(customerId).select('name email countryCode location').lean(),
    ManagedCollectionPlan.findById(planId),
  ]);

  if (!customer || !plan || plan.status !== SubscriptionPlanStatus.ACTIVE) {
    res.status(404).json({ message: 'Active subscription plan not found.' });
    return;
  }

  const now = new Date();
  const nextBillingDate = calculateNextBillingDate(now, plan.billingFrequency);
  const subscription = await ManagedCollectionSubscription.create({
    customerId: new mongoose.Types.ObjectId(customerId),
    profileId: mongoose.Types.ObjectId.isValid(String(req.body.profileId || ''))
      ? new mongoose.Types.ObjectId(String(req.body.profileId))
      : undefined,
    planId: plan._id,
    planName: plan.name,
    customerName: customer.name || 'Client',
    customerEmail: customer.email || authUser?.email || '',
    countryCode: plan.countryCode || customer.countryCode,
    city: normalizeText(req.body.city) || customer.location?.city || 'Local Area',
    area: normalizeText(req.body.area) || customer.location?.area || '',
    currency: plan.currency,
    priceMinor: plan.priceMinor,
    billingFrequency: plan.billingFrequency,
    collectionFrequency: plan.collectionFrequency,
    binPackage: plan.binPackage,
    collectionType: plan.collectionType,
    status: SubscriptionStatus.ACTIVE,
    startedAt: now,
    previousBillingDate: null,
    nextBillingDate,
    renewalDate: nextBillingDate,
    gracePeriodEndsAt: graceDateFor(nextBillingDate),
    recurringPayment: {
      provider: 'paystack',
      customerCode: normalizeText(req.body.recurringPayment?.customerCode),
      authorizationReference: normalizeText(req.body.recurringPayment?.authorizationReference),
      defaultMethodId: normalizeText(req.body.recurringPayment?.defaultMethodId),
      enabled: false,
    },
    metadata: {
      serviceKey: 'managed_collection',
      autoChargeEnabled: false,
    },
  });

  const invoice = await createSubscriptionInvoice(subscription);
  await logAuditEvent(req, {
    action: 'managed_collection.subscription.create',
    module: 'MARKET',
    resourceType: 'ManagedCollectionSubscription',
    resourceId: subscription._id.toString(),
    metadata: { planId, invoiceId: invoice._id.toString(), autoChargeEnabled: false },
  });

  res.status(201).json({ success: true, subscription: sanitizeSubscription(subscription), invoice });
};

export const updateManagedCollectionSubscription = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const authUserId = String(authUser?.id ?? authUser?._id ?? '');
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(authUserId)) {
    res.status(400).json({ message: 'Invalid subscription request.' });
    return;
  }

  const action = String(req.body.action || '').trim().toUpperCase();
  const allowed = ['PAUSE', 'RESUME', 'CANCEL', 'UPGRADE', 'DOWNGRADE'];
  if (!allowed.includes(action)) {
    res.status(400).json({ message: 'Unsupported subscription action.' });
    return;
  }

  const subscription = await ManagedCollectionSubscription.findById(id);
  if (!subscription) {
    res.status(404).json({ message: 'Subscription not found.' });
    return;
  }
  if (String(subscription.customerId) !== authUserId) {
    res.status(403).json({ message: 'You cannot update this subscription.' });
    return;
  }

  const before = subscription.toObject();
  if (action === 'PAUSE') {
    subscription.status = SubscriptionStatus.PAUSED;
    subscription.pausedAt = new Date();
  }
  if (action === 'RESUME') {
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.pausedAt = null;
  }
  if (action === 'CANCEL') {
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
  }
  if (['UPGRADE', 'DOWNGRADE'].includes(action)) {
    const planId = String(req.body.planId || '');
    if (!mongoose.Types.ObjectId.isValid(planId)) {
      res.status(400).json({ message: 'Plan id is required for plan changes.' });
      return;
    }
    const plan = await ManagedCollectionPlan.findById(planId);
    if (!plan || plan.status !== SubscriptionPlanStatus.ACTIVE) {
      res.status(404).json({ message: 'Active target plan not found.' });
      return;
    }
    subscription.planId = plan._id;
    subscription.planName = plan.name;
    subscription.priceMinor = plan.priceMinor;
    subscription.currency = plan.currency;
    subscription.billingFrequency = plan.billingFrequency;
    subscription.collectionFrequency = plan.collectionFrequency;
    subscription.binPackage = plan.binPackage;
    subscription.collectionType = plan.collectionType;
    subscription.nextBillingDate = calculateNextBillingDate(new Date(), plan.billingFrequency);
    subscription.renewalDate = subscription.nextBillingDate;
    subscription.gracePeriodEndsAt = graceDateFor(subscription.nextBillingDate);
  }

  await subscription.save();
  await logAuditEvent(req, {
    action: `managed_collection.subscription.${action.toLowerCase()}`,
    module: 'MARKET',
    resourceType: 'ManagedCollectionSubscription',
    resourceId: subscription._id.toString(),
    changes: { before, after: subscription.toObject() },
  });

  res.status(200).json({ success: true, subscription: sanitizeSubscription(subscription) });
};

export const generateManagedCollectionSubscriptionInvoices = async (req: Request, res: Response): Promise<void> => {
  const authUser = getAuthUser(req);
  const authUserId = String(authUser?.id ?? authUser?._id ?? '');
  if (mongoose.Types.ObjectId.isValid(authUserId)) {
    const admin = await User.findById(authUserId).select('adminRole').lean();
    if (admin?.adminRole === AdminRole.READ_ONLY_ADMIN) {
      res.status(403).json({ message: 'Read-only admins cannot generate subscription invoices.' });
      return;
    }
  }

  const now = new Date();
  const dueSubscriptions = await ManagedCollectionSubscription.find({
    status: SubscriptionStatus.ACTIVE,
    nextBillingDate: { $lte: now },
  });

  const invoices = [];
  for (const subscription of dueSubscriptions) {
    const exists = await ManagedCollectionSubscriptionInvoice.findOne({
      subscriptionId: subscription._id,
      billingPeriodEnd: subscription.nextBillingDate,
    });
    if (exists) continue;
    invoices.push(await createSubscriptionInvoice(subscription));
    subscription.previousBillingDate = subscription.nextBillingDate;
    subscription.nextBillingDate = calculateNextBillingDate(subscription.nextBillingDate, subscription.billingFrequency);
    subscription.renewalDate = subscription.nextBillingDate;
    subscription.gracePeriodEndsAt = graceDateFor(subscription.nextBillingDate);
    await subscription.save();
  }

  await logAuditEvent(req, {
    action: 'managed_collection.subscription.generate_invoices',
    module: 'MARKET',
    resourceType: 'ManagedCollectionSubscriptionInvoice',
    metadata: { invoiceCount: invoices.length },
  });

  res.status(200).json({ success: true, invoices });
};

export const listAdminManagedCollectionSubscriptions = async (req: Request, res: Response): Promise<void> => {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  if (typeof req.query.countryCode === 'string' && req.query.countryCode) filter.countryCode = req.query.countryCode.toUpperCase();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [plans, subscriptions, invoices, revenueAgg, activeSubscriptions, cancelledSubscriptions, renewals, overdueInvoices] = await Promise.all([
    ManagedCollectionPlan.find().sort({ createdAt: -1 }).lean(),
    ManagedCollectionSubscription.find(filter).sort({ createdAt: -1 }).limit(300).lean(),
    ManagedCollectionSubscriptionInvoice.find().sort({ dueAt: -1 }).limit(300).lean(),
    ManagedCollectionSubscription.aggregate([
      { $match: { status: SubscriptionStatus.ACTIVE } },
      { $group: { _id: '$currency', monthlyRecurringRevenueMinor: { $sum: '$priceMinor' } } },
    ]),
    ManagedCollectionSubscription.countDocuments({ status: SubscriptionStatus.ACTIVE }),
    ManagedCollectionSubscription.countDocuments({ status: SubscriptionStatus.CANCELLED, cancelledAt: { $gte: monthStart } }),
    ManagedCollectionSubscription.countDocuments({ renewalDate: { $gte: monthStart, $lt: nextMonth } }),
    ManagedCollectionSubscriptionInvoice.countDocuments({ status: SubscriptionInvoiceStatus.UNPAID, dueAt: { $lt: now } }),
  ]);

  const churn = activeSubscriptions + cancelledSubscriptions > 0
    ? cancelledSubscriptions / (activeSubscriptions + cancelledSubscriptions)
    : 0;

  res.status(200).json({
    success: true,
    plans,
    subscriptions: subscriptions.map(sanitizeSubscription),
    invoices,
    reports: {
      monthlyRecurringRevenue: revenueAgg,
      activeSubscriptions,
      churn,
      renewals,
      failedRenewals: overdueInvoices,
      overdue: overdueInvoices,
      cancelled: cancelledSubscriptions,
    },
    meta: {
      subscriptionStatuses: Object.values(SubscriptionStatus),
      planStatuses: Object.values(SubscriptionPlanStatus),
      billingFrequencies: Object.values(BillingFrequency),
      collectionFrequencies: Object.values(ManagedCollectionFrequency),
      binColors: Object.values(ManagedCollectionBinColor),
      collectionTypes: Object.values(ManagedCollectionType),
    },
  });
};
