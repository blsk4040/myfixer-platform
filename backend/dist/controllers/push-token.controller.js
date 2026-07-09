"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unregisterPushToken = exports.registerPushToken = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const push_token_model_1 = __importDefault(require("../models/push-token.model"));
const notification_preference_model_1 = __importDefault(require("../models/notification-preference.model"));
const getAuthUser = (req) => req.user;
const normalizePlatform = (value) => {
    const platform = typeof value === 'string' ? value.toLowerCase().trim() : '';
    return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'unknown';
};
const normalizeApp = (value) => {
    const app = typeof value === 'string' ? value.toLowerCase().trim() : '';
    return app === 'client' || app === 'technician' || app === 'admin' ? app : 'unknown';
};
const isExpoPushToken = (value) => {
    if (typeof value !== 'string')
        return false;
    const token = value.trim();
    return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
};
const registerPushToken = async (req, res) => {
    const authUser = getAuthUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    const { token, deviceId } = req.body || {};
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        res.status(401).json({ message: 'Valid user identity is required.' });
        return;
    }
    if (!isExpoPushToken(token)) {
        res.status(400).json({ message: 'A valid Expo push token is required.' });
        return;
    }
    const normalizedToken = token.trim();
    const now = new Date();
    try {
        const pushToken = await push_token_model_1.default.findOneAndUpdate({ token: normalizedToken }, {
            $set: {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                platform: normalizePlatform(req.body.platform),
                app: normalizeApp(req.body.app),
                deviceId: typeof deviceId === 'string' ? deviceId.trim() : '',
                isActive: true,
                lastRegisteredAt: now,
                disabledAt: null,
            },
        }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
        await notification_preference_model_1.default.findOneAndUpdate({ userId: new mongoose_1.default.Types.ObjectId(userId) }, {
            $setOnInsert: {
                userId: new mongoose_1.default.Types.ObjectId(userId),
                channels: {
                    inApp: true,
                    email: true,
                    push: true,
                    sms: false,
                    whatsapp: false,
                },
            },
            $set: {
                'channels.push': true,
            },
        }, { new: true, upsert: true, runValidators: true });
        res.status(200).json({ success: true, pushTokenId: pushToken._id });
    }
    catch (error) {
        console.error('Failed to register push token:', error);
        res.status(500).json({ message: 'Failed to register push token.' });
    }
};
exports.registerPushToken = registerPushToken;
const unregisterPushToken = async (req, res) => {
    const authUser = getAuthUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
        res.status(401).json({ message: 'Valid user identity is required.' });
        return;
    }
    if (!token) {
        res.status(400).json({ message: 'Push token is required.' });
        return;
    }
    await push_token_model_1.default.updateOne({ token, userId: new mongoose_1.default.Types.ObjectId(userId) }, { $set: { isActive: false, disabledAt: new Date() } });
    res.status(200).json({ success: true });
};
exports.unregisterPushToken = unregisterPushToken;
//# sourceMappingURL=push-token.controller.js.map