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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyCustomerReferralProgram = void 0;
const user_model_1 = __importStar(require("../models/user.model"));
const customer_referral_service_1 = require("../services/customer-referral.service");
const getAuthUser = (req) => req.user;
const getMyCustomerReferralProgram = async (req, res) => {
    const authUser = getAuthUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!userId) {
        res.status(401).json({ message: 'Authentication is required.' });
        return;
    }
    try {
        const customer = await user_model_1.default.findOne({ _id: userId, role: user_model_1.UserRole.CUSTOMER }).select('name').lean();
        if (!customer) {
            res.status(404).json({ message: 'Customer account not found.' });
            return;
        }
        const referralCode = await (0, customer_referral_service_1.getOrCreateCustomerReferralCode)(userId);
        const appLinkBase = (process.env.CLIENT_APP_SHARE_URL || process.env.CLIENT_APP_URL || 'https://padi.app').replace(/\/$/, '');
        const inviteUrl = `${appLinkBase}/invite/${encodeURIComponent(referralCode)}`;
        const [summary, rewards] = await Promise.all([
            (0, customer_referral_service_1.getCustomerReferralSummary)(userId),
            (0, customer_referral_service_1.listActiveCustomerReferralPromotions)(userId),
        ]);
        res.status(200).json({
            success: true,
            referral: {
                referralCode,
                inviteUrl,
                shareMessage: `I booked through Padi. Use my invite code ${referralCode} when you sign up and get a discount on your first qualifying booking: ${inviteUrl}`,
                summary,
                rewards,
                friendDiscountMessage: 'Your friend gets a discount on their first qualifying booking.',
                rewardMessage: 'Your reward is issued after your friend completes a real paid booking.',
            },
        });
    }
    catch (error) {
        console.error('Failed to load customer referral program:', error);
        res.status(500).json({ message: 'Unable to load referral details right now.' });
    }
};
exports.getMyCustomerReferralProgram = getMyCustomerReferralProgram;
//# sourceMappingURL=customer-referral.controller.js.map