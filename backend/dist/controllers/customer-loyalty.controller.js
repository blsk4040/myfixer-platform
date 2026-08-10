"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyCustomerLoyaltyProgram = void 0;
const customer_loyalty_reward_service_1 = require("../services/customer-loyalty-reward.service");
const getAuthUser = (req) => req.user;
const getMyCustomerLoyaltyProgram = async (req, res) => {
    const authUser = getAuthUser(req);
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    if (!userId) {
        res.status(401).json({ message: 'Authentication is required.' });
        return;
    }
    try {
        const loyalty = await (0, customer_loyalty_reward_service_1.getCustomerLoyaltyProgram)(userId);
        res.status(200).json({
            success: true,
            loyalty,
        });
    }
    catch (error) {
        console.error('Failed to load customer loyalty program:', error);
        res.status(500).json({ message: 'Unable to load loyalty rewards right now.' });
    }
};
exports.getMyCustomerLoyaltyProgram = getMyCustomerLoyaltyProgram;
//# sourceMappingURL=customer-loyalty.controller.js.map