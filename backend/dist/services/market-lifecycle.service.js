"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAllowedMarketStatusTransition = exports.MARKET_STATUS_TRANSITIONS = void 0;
const market_setting_model_1 = require("../models/market-setting.model");
exports.MARKET_STATUS_TRANSITIONS = {
    [market_setting_model_1.MarketStatus.DRAFT]: [market_setting_model_1.MarketStatus.DRAFT, market_setting_model_1.MarketStatus.COMING_SOON, market_setting_model_1.MarketStatus.ACTIVE, market_setting_model_1.MarketStatus.DISABLED, market_setting_model_1.MarketStatus.ARCHIVED],
    [market_setting_model_1.MarketStatus.COMING_SOON]: [market_setting_model_1.MarketStatus.COMING_SOON, market_setting_model_1.MarketStatus.ACTIVE, market_setting_model_1.MarketStatus.PAUSED, market_setting_model_1.MarketStatus.DISABLED, market_setting_model_1.MarketStatus.ARCHIVED],
    [market_setting_model_1.MarketStatus.ACTIVE]: [market_setting_model_1.MarketStatus.ACTIVE, market_setting_model_1.MarketStatus.PAUSED, market_setting_model_1.MarketStatus.DISABLED, market_setting_model_1.MarketStatus.ARCHIVED],
    [market_setting_model_1.MarketStatus.PAUSED]: [market_setting_model_1.MarketStatus.PAUSED, market_setting_model_1.MarketStatus.ACTIVE, market_setting_model_1.MarketStatus.DISABLED, market_setting_model_1.MarketStatus.ARCHIVED],
    [market_setting_model_1.MarketStatus.DISABLED]: [market_setting_model_1.MarketStatus.DISABLED, market_setting_model_1.MarketStatus.ACTIVE, market_setting_model_1.MarketStatus.ARCHIVED],
    [market_setting_model_1.MarketStatus.ARCHIVED]: [market_setting_model_1.MarketStatus.ARCHIVED],
};
const isAllowedMarketStatusTransition = (from, to) => (exports.MARKET_STATUS_TRANSITIONS[from] || []).includes(to);
exports.isAllowedMarketStatusTransition = isAllowedMarketStatusTransition;
//# sourceMappingURL=market-lifecycle.service.js.map