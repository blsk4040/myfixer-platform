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
exports.listAdminManagedCollectionSubscriptions = exports.generateManagedCollectionSubscriptionInvoices = exports.updateManagedCollectionSubscription = exports.createManagedCollectionSubscription = exports.getMyManagedCollectionSubscriptionDashboard = exports.updateAdminSubscriptionPlan = exports.createAdminSubscriptionPlan = exports.listPublicSubscriptionPlans = exports.calculateNextBillingDate = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const managed_collection_subscription_model_1 = require("../models/managed-collection-subscription.model");
const managed_collection_model_1 = require("../models/managed-collection.model");
const user_model_1 = __importStar(require("../models/user.model"));
const market_config_1 = require("../config/market.config");
const audit_service_1 = require("../services/audit.service");
const GRACE_PERIOD_DAYS = 7;
const getAuthUser = (req) => req.user;
const normalizeText = (value) => typeof value === 'string' ? value.trim() : '';
const isEnumValue = (targetEnum, value) => typeof value === 'string' && Object.values(targetEnum).includes(value);
const calculateNextBillingDate = (fromDate, frequency) => {
    const next = new Date(fromDate);
    next.setHours(9, 0, 0, 0);
    if (frequency === managed_collection_subscription_model_1.BillingFrequency.WEEKLY)
        next.setDate(next.getDate() + 7);
    if (frequency === managed_collection_subscription_model_1.BillingFrequency.MONTHLY)
        next.setMonth(next.getMonth() + 1);
    if (frequency === managed_collection_subscription_model_1.BillingFrequency.QUARTERLY)
        next.setMonth(next.getMonth() + 3);
    if (frequency === managed_collection_subscription_model_1.BillingFrequency.YEARLY)
        next.setFullYear(next.getFullYear() + 1);
    return next;
};
exports.calculateNextBillingDate = calculateNextBillingDate;
const graceDateFor = (billingDate) => {
    const grace = new Date(billingDate);
    grace.setDate(grace.getDate() + GRACE_PERIOD_DAYS);
    return grace;
};
const invoiceNumber = () => `MCS-${Date.now()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
const sanitizeSubscription = (subscription) => {
    const source = typeof subscription?.toObject === 'function' ? subscription.toObject() : { ...(subscription || {}) };
    delete source.recurringPayment;
    return source;
};
const createSubscriptionInvoice = async (subscription) => {
    const periodStart = subscription.previousBillingDate || subscription.startedAt;
    const periodEnd = subscription.nextBillingDate;
    return managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.create({
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
        status: managed_collection_subscription_model_1.SubscriptionInvoiceStatus.UNPAID,
        metadata: {
            serviceKey: 'managed_collection',
            autoChargeEnabled: false,
            billingFrequency: subscription.billingFrequency,
        },
    });
};
const buildPlanPayload = (body) => {
    const name = normalizeText(body.name);
    const description = normalizeText(body.description);
    const countryCode = (0, market_config_1.normalizeCountryCode)(body.countryCode);
    const currency = (0, market_config_1.normalizeIsoCurrencyCode)(body.currency);
    const priceMinor = Number(body.priceMinor ?? Math.round(Number(body.price || 0) * 100));
    const billingFrequency = body.billingFrequency;
    const collectionFrequency = body.collectionFrequency;
    const collectionType = body.collectionType || managed_collection_model_1.ManagedCollectionType.GENERAL_WASTE;
    const status = body.status || managed_collection_subscription_model_1.SubscriptionPlanStatus.ACTIVE;
    const binPackage = Array.isArray(body.binPackage)
        ? body.binPackage.map((item) => String(item).trim().toUpperCase()).filter((item) => isEnumValue(managed_collection_model_1.ManagedCollectionBinColor, item))
        : [];
    if (!name)
        throw new Error('Plan name is required.');
    if (!Number.isFinite(priceMinor) || priceMinor < 0)
        throw new Error('Valid plan price is required.');
    if (!isEnumValue(managed_collection_subscription_model_1.BillingFrequency, billingFrequency))
        throw new Error('Valid billing frequency is required.');
    if (!isEnumValue(managed_collection_model_1.ManagedCollectionFrequency, collectionFrequency))
        throw new Error('Valid collection frequency is required.');
    if (!isEnumValue(managed_collection_model_1.ManagedCollectionType, collectionType))
        throw new Error('Valid collection type is required.');
    if (!isEnumValue(managed_collection_subscription_model_1.SubscriptionPlanStatus, status))
        throw new Error('Valid plan status is required.');
    if (!binPackage.length)
        throw new Error('At least one bin package color is required.');
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
const listPublicSubscriptionPlans = async (req, res) => {
    const filter = { status: managed_collection_subscription_model_1.SubscriptionPlanStatus.ACTIVE };
    if (typeof req.query.countryCode === 'string' && req.query.countryCode) {
        filter.countryCode = req.query.countryCode.toUpperCase();
    }
    const plans = await managed_collection_subscription_model_1.ManagedCollectionPlan.find(filter).sort({ priceMinor: 1 }).lean();
    res.status(200).json({ success: true, plans });
};
exports.listPublicSubscriptionPlans = listPublicSubscriptionPlans;
const createAdminSubscriptionPlan = async (req, res) => {
    try {
        const payload = buildPlanPayload(req.body);
        const plan = await managed_collection_subscription_model_1.ManagedCollectionPlan.create(payload);
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'managed_collection.subscription_plan.create',
            module: 'MARKET',
            resourceType: 'ManagedCollectionPlan',
            resourceId: plan._id.toString(),
            changes: { after: plan.toObject() },
        });
        res.status(201).json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to create plan.' });
    }
};
exports.createAdminSubscriptionPlan = createAdminSubscriptionPlan;
const updateAdminSubscriptionPlan = async (req, res) => {
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid plan id.' });
        return;
    }
    try {
        const before = await managed_collection_subscription_model_1.ManagedCollectionPlan.findById(id).lean();
        const payload = buildPlanPayload(req.body);
        const plan = await managed_collection_subscription_model_1.ManagedCollectionPlan.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
        if (!plan) {
            res.status(404).json({ message: 'Plan not found.' });
            return;
        }
        await (0, audit_service_1.logAuditEvent)(req, {
            action: 'managed_collection.subscription_plan.update',
            module: 'MARKET',
            resourceType: 'ManagedCollectionPlan',
            resourceId: plan._id.toString(),
            changes: { before, after: plan.toObject() },
        });
        res.status(200).json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ message: error instanceof Error ? error.message : 'Unable to update plan.' });
    }
};
exports.updateAdminSubscriptionPlan = updateAdminSubscriptionPlan;
const getMyManagedCollectionSubscriptionDashboard = async (req, res) => {
    const authUser = getAuthUser(req);
    const customerId = String(authUser?.id ?? authUser?._id ?? '');
    if (!mongoose_1.default.Types.ObjectId.isValid(customerId)) {
        res.status(401).json({ message: 'Valid customer identity is required.' });
        return;
    }
    const subscriptions = await managed_collection_subscription_model_1.ManagedCollectionSubscription.find({ customerId }).sort({ createdAt: -1 }).lean();
    const invoices = await managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.find({ customerId }).sort({ dueAt: -1 }).limit(50).lean();
    const safeSubscriptions = subscriptions.map(sanitizeSubscription);
    res.status(200).json({
        success: true,
        currentSubscription: safeSubscriptions.find((item) => [managed_collection_subscription_model_1.SubscriptionStatus.ACTIVE, managed_collection_subscription_model_1.SubscriptionStatus.PAUSED, managed_collection_subscription_model_1.SubscriptionStatus.PENDING].includes(item.status)) || null,
        subscriptions: safeSubscriptions,
        invoices,
    });
};
exports.getMyManagedCollectionSubscriptionDashboard = getMyManagedCollectionSubscriptionDashboard;
const createManagedCollectionSubscription = async (req, res) => {
    const authUser = getAuthUser(req);
    const customerId = String(authUser?.id ?? authUser?._id ?? '');
    if (!mongoose_1.default.Types.ObjectId.isValid(customerId)) {
        res.status(401).json({ message: 'Valid customer identity is required.' });
        return;
    }
    const planId = String(req.body.planId || '');
    if (!mongoose_1.default.Types.ObjectId.isValid(planId)) {
        res.status(400).json({ message: 'Valid plan id is required.' });
        return;
    }
    const [customer, plan] = await Promise.all([
        user_model_1.default.findById(customerId).select('name email countryCode location').lean(),
        managed_collection_subscription_model_1.ManagedCollectionPlan.findById(planId),
    ]);
    if (!customer || !plan || plan.status !== managed_collection_subscription_model_1.SubscriptionPlanStatus.ACTIVE) {
        res.status(404).json({ message: 'Active subscription plan not found.' });
        return;
    }
    const now = new Date();
    const nextBillingDate = (0, exports.calculateNextBillingDate)(now, plan.billingFrequency);
    const subscription = await managed_collection_subscription_model_1.ManagedCollectionSubscription.create({
        customerId: new mongoose_1.default.Types.ObjectId(customerId),
        profileId: mongoose_1.default.Types.ObjectId.isValid(String(req.body.profileId || ''))
            ? new mongoose_1.default.Types.ObjectId(String(req.body.profileId))
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
        status: managed_collection_subscription_model_1.SubscriptionStatus.ACTIVE,
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
    await (0, audit_service_1.logAuditEvent)(req, {
        action: 'managed_collection.subscription.create',
        module: 'MARKET',
        resourceType: 'ManagedCollectionSubscription',
        resourceId: subscription._id.toString(),
        metadata: { planId, invoiceId: invoice._id.toString(), autoChargeEnabled: false },
    });
    res.status(201).json({ success: true, subscription: sanitizeSubscription(subscription), invoice });
};
exports.createManagedCollectionSubscription = createManagedCollectionSubscription;
const updateManagedCollectionSubscription = async (req, res) => {
    const authUser = getAuthUser(req);
    const authUserId = String(authUser?.id ?? authUser?._id ?? '');
    const { id } = req.params;
    if (!mongoose_1.default.Types.ObjectId.isValid(id) || !mongoose_1.default.Types.ObjectId.isValid(authUserId)) {
        res.status(400).json({ message: 'Invalid subscription request.' });
        return;
    }
    const action = String(req.body.action || '').trim().toUpperCase();
    const allowed = ['PAUSE', 'RESUME', 'CANCEL', 'UPGRADE', 'DOWNGRADE'];
    if (!allowed.includes(action)) {
        res.status(400).json({ message: 'Unsupported subscription action.' });
        return;
    }
    const subscription = await managed_collection_subscription_model_1.ManagedCollectionSubscription.findById(id);
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
        subscription.status = managed_collection_subscription_model_1.SubscriptionStatus.PAUSED;
        subscription.pausedAt = new Date();
    }
    if (action === 'RESUME') {
        subscription.status = managed_collection_subscription_model_1.SubscriptionStatus.ACTIVE;
        subscription.pausedAt = null;
    }
    if (action === 'CANCEL') {
        subscription.status = managed_collection_subscription_model_1.SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
    }
    if (['UPGRADE', 'DOWNGRADE'].includes(action)) {
        const planId = String(req.body.planId || '');
        if (!mongoose_1.default.Types.ObjectId.isValid(planId)) {
            res.status(400).json({ message: 'Plan id is required for plan changes.' });
            return;
        }
        const plan = await managed_collection_subscription_model_1.ManagedCollectionPlan.findById(planId);
        if (!plan || plan.status !== managed_collection_subscription_model_1.SubscriptionPlanStatus.ACTIVE) {
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
        subscription.nextBillingDate = (0, exports.calculateNextBillingDate)(new Date(), plan.billingFrequency);
        subscription.renewalDate = subscription.nextBillingDate;
        subscription.gracePeriodEndsAt = graceDateFor(subscription.nextBillingDate);
    }
    await subscription.save();
    await (0, audit_service_1.logAuditEvent)(req, {
        action: `managed_collection.subscription.${action.toLowerCase()}`,
        module: 'MARKET',
        resourceType: 'ManagedCollectionSubscription',
        resourceId: subscription._id.toString(),
        changes: { before, after: subscription.toObject() },
    });
    res.status(200).json({ success: true, subscription: sanitizeSubscription(subscription) });
};
exports.updateManagedCollectionSubscription = updateManagedCollectionSubscription;
const generateManagedCollectionSubscriptionInvoices = async (req, res) => {
    const authUser = getAuthUser(req);
    const authUserId = String(authUser?.id ?? authUser?._id ?? '');
    if (mongoose_1.default.Types.ObjectId.isValid(authUserId)) {
        const admin = await user_model_1.default.findById(authUserId).select('adminRole').lean();
        if (admin?.adminRole === user_model_1.AdminRole.READ_ONLY_ADMIN) {
            res.status(403).json({ message: 'Read-only admins cannot generate subscription invoices.' });
            return;
        }
    }
    const now = new Date();
    const dueSubscriptions = await managed_collection_subscription_model_1.ManagedCollectionSubscription.find({
        status: managed_collection_subscription_model_1.SubscriptionStatus.ACTIVE,
        nextBillingDate: { $lte: now },
    });
    const invoices = [];
    for (const subscription of dueSubscriptions) {
        const exists = await managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.findOne({
            subscriptionId: subscription._id,
            billingPeriodEnd: subscription.nextBillingDate,
        });
        if (exists)
            continue;
        invoices.push(await createSubscriptionInvoice(subscription));
        subscription.previousBillingDate = subscription.nextBillingDate;
        subscription.nextBillingDate = (0, exports.calculateNextBillingDate)(subscription.nextBillingDate, subscription.billingFrequency);
        subscription.renewalDate = subscription.nextBillingDate;
        subscription.gracePeriodEndsAt = graceDateFor(subscription.nextBillingDate);
        await subscription.save();
    }
    await (0, audit_service_1.logAuditEvent)(req, {
        action: 'managed_collection.subscription.generate_invoices',
        module: 'MARKET',
        resourceType: 'ManagedCollectionSubscriptionInvoice',
        metadata: { invoiceCount: invoices.length },
    });
    res.status(200).json({ success: true, invoices });
};
exports.generateManagedCollectionSubscriptionInvoices = generateManagedCollectionSubscriptionInvoices;
const listAdminManagedCollectionSubscriptions = async (req, res) => {
    const filter = {};
    if (typeof req.query.status === 'string' && req.query.status)
        filter.status = req.query.status;
    if (typeof req.query.countryCode === 'string' && req.query.countryCode)
        filter.countryCode = req.query.countryCode.toUpperCase();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const [plans, subscriptions, invoices, revenueAgg, activeSubscriptions, cancelledSubscriptions, renewals, overdueInvoices] = await Promise.all([
        managed_collection_subscription_model_1.ManagedCollectionPlan.find().sort({ createdAt: -1 }).lean(),
        managed_collection_subscription_model_1.ManagedCollectionSubscription.find(filter).sort({ createdAt: -1 }).limit(300).lean(),
        managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.find().sort({ dueAt: -1 }).limit(300).lean(),
        managed_collection_subscription_model_1.ManagedCollectionSubscription.aggregate([
            { $match: { status: managed_collection_subscription_model_1.SubscriptionStatus.ACTIVE } },
            { $group: { _id: '$currency', monthlyRecurringRevenueMinor: { $sum: '$priceMinor' } } },
        ]),
        managed_collection_subscription_model_1.ManagedCollectionSubscription.countDocuments({ status: managed_collection_subscription_model_1.SubscriptionStatus.ACTIVE }),
        managed_collection_subscription_model_1.ManagedCollectionSubscription.countDocuments({ status: managed_collection_subscription_model_1.SubscriptionStatus.CANCELLED, cancelledAt: { $gte: monthStart } }),
        managed_collection_subscription_model_1.ManagedCollectionSubscription.countDocuments({ renewalDate: { $gte: monthStart, $lt: nextMonth } }),
        managed_collection_subscription_model_1.ManagedCollectionSubscriptionInvoice.countDocuments({ status: managed_collection_subscription_model_1.SubscriptionInvoiceStatus.UNPAID, dueAt: { $lt: now } }),
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
            subscriptionStatuses: Object.values(managed_collection_subscription_model_1.SubscriptionStatus),
            planStatuses: Object.values(managed_collection_subscription_model_1.SubscriptionPlanStatus),
            billingFrequencies: Object.values(managed_collection_subscription_model_1.BillingFrequency),
            collectionFrequencies: Object.values(managed_collection_model_1.ManagedCollectionFrequency),
            binColors: Object.values(managed_collection_model_1.ManagedCollectionBinColor),
            collectionTypes: Object.values(managed_collection_model_1.ManagedCollectionType),
        },
    });
};
exports.listAdminManagedCollectionSubscriptions = listAdminManagedCollectionSubscriptions;
//# sourceMappingURL=managed-collection-subscription.controller.js.map