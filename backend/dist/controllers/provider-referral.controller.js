"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyProviderReferralProgram = void 0;
const technician_model_1 = __importDefault(require("../models/technician.model"));
const provider_referral_service_1 = require("../services/provider-referral.service");
const getAuthUser = (req) => req.user;
const getMyProviderReferralProgram = async (req, res) => {
    const authUser = getAuthUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!userId) {
        res.status(401).json({ message: 'Authentication is required.' });
        return;
    }
    try {
        const technician = await technician_model_1.default.findOne({ userId }).populate('userId', 'name isActive').exec();
        if (!technician) {
            res.status(404).json({ message: 'Padi Pro profile not found.' });
            return;
        }
        const providerName = typeof technician.userId === 'object' && technician.userId && 'name' in technician.userId
            ? String(technician.userId.name || '')
            : '';
        const referralCode = await (0, provider_referral_service_1.getOrCreateProviderReferralCode)(technician, providerName);
        const appLinkBase = (process.env.CLIENT_APP_SHARE_URL || process.env.CLIENT_APP_URL || 'https://padi.app').replace(/\/$/, '');
        const inviteUrl = `${appLinkBase}/invite/${encodeURIComponent(referralCode)}`;
        const summary = await (0, provider_referral_service_1.getProviderReferralSummary)(technician._id);
        const eligibility = await (0, provider_referral_service_1.getProviderReferralEligibility)(technician);
        const shareMessage = eligibility.eligible
            ? `Book trusted home services through Padi. Use my invite code ${referralCode} when you sign up: ${inviteUrl}`
            : '';
        res.status(200).json({
            success: true,
            referral: {
                referralCode,
                inviteUrl,
                shareMessage,
                summary,
                eligibility,
                rewardsEnabled: eligibility.eligible,
                rewardMessage: eligibility.eligible
                    ? 'Rewards are issued only after the invited customer completes a legitimate paid booking.'
                    : eligibility.reason,
            },
        });
    }
    catch (error) {
        console.error('Failed to load provider referral program:', error);
        res.status(500).json({ message: 'Unable to load referral details right now.' });
    }
};
exports.getMyProviderReferralProgram = getMyProviderReferralProgram;
//# sourceMappingURL=provider-referral.controller.js.map