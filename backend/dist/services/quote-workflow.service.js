"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSubmittedQuoteStatus = exports.calculateQuoteTotals = exports.QuoteWorkflowError = void 0;
const market_config_1 = require("../config/market.config");
const quote_model_1 = require("../models/quote.model");
class QuoteWorkflowError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode = 400) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.QuoteWorkflowError = QuoteWorkflowError;
const normalizeLineItemType = (type) => {
    const raw = typeof type === 'string' ? type.trim().toUpperCase() : '';
    const aliases = {
        CALL_OUT: quote_model_1.QuoteLineItemType.CALL_OUT,
        CALLOUT: quote_model_1.QuoteLineItemType.CALL_OUT,
        LABOUR: quote_model_1.QuoteLineItemType.LABOUR,
        LABOR: quote_model_1.QuoteLineItemType.LABOUR,
    };
    const normalized = aliases[raw] || raw;
    if (!Object.values(quote_model_1.QuoteLineItemType).includes(normalized)) {
        throw new QuoteWorkflowError('Invalid quote line item type.', 'INVALID_LINE_ITEM_TYPE');
    }
    return normalized;
};
const normalizeMinorAmount = (item, currency) => {
    if (Number.isInteger(item.unitAmountMinor)) {
        return Number(item.unitAmountMinor);
    }
    const unitAmount = Number(item.unitAmount);
    if (!Number.isFinite(unitAmount)) {
        throw new QuoteWorkflowError('Each line item requires a valid amount.', 'INVALID_LINE_ITEM_AMOUNT');
    }
    return (0, market_config_1.toMinorUnits)(unitAmount, currency);
};
const calculateQuoteTotals = (items, currency) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new QuoteWorkflowError('At least one quote line item is required.', 'QUOTE_LINE_ITEMS_REQUIRED');
    }
    if (items.length > 60) {
        throw new QuoteWorkflowError('Too many quote line items.', 'TOO_MANY_LINE_ITEMS');
    }
    let subtotalAmountMinor = 0;
    let discountAmountMinor = 0;
    const lineItems = items.map((item) => {
        const type = normalizeLineItemType(item.type);
        const label = String(item.label ?? item.description ?? '').trim();
        if (!label || label.length > 180) {
            throw new QuoteWorkflowError('Each line item requires a concise description.', 'INVALID_LINE_ITEM_DESCRIPTION');
        }
        const quantity = Number(item.quantity ?? 1);
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 999) {
            throw new QuoteWorkflowError('Line item quantity must be positive.', 'INVALID_LINE_ITEM_QUANTITY');
        }
        const unitAmountMinor = normalizeMinorAmount(item, currency);
        if (!Number.isInteger(unitAmountMinor) || unitAmountMinor < 0) {
            throw new QuoteWorkflowError('Line item amount must be a non-negative integer in minor units.', 'INVALID_LINE_ITEM_AMOUNT');
        }
        const absoluteTotal = Math.round(unitAmountMinor * quantity);
        const isDiscount = type === quote_model_1.QuoteLineItemType.DISCOUNT;
        const totalAmountMinor = isDiscount ? -absoluteTotal : absoluteTotal;
        if (isDiscount) {
            discountAmountMinor += absoluteTotal;
        }
        else {
            subtotalAmountMinor += absoluteTotal;
        }
        return {
            type,
            label,
            quantity,
            unitAmountMinor,
            totalAmountMinor,
            notes: typeof item.notes === 'string' ? item.notes.trim().slice(0, 500) : '',
            taxable: item.taxable === true,
        };
    });
    const totalAmountMinor = subtotalAmountMinor - discountAmountMinor;
    if (totalAmountMinor < 0) {
        throw new QuoteWorkflowError('Quote total cannot be negative.', 'NEGATIVE_QUOTE_TOTAL');
    }
    return { lineItems, subtotalAmountMinor, discountAmountMinor, totalAmountMinor };
};
exports.calculateQuoteTotals = calculateQuoteTotals;
const isSubmittedQuoteStatus = (status) => [quote_model_1.QuoteStatus.SUBMITTED, quote_model_1.QuoteStatus.SENT_TO_CLIENT, quote_model_1.QuoteStatus.APPROVED].includes(status);
exports.isSubmittedQuoteStatus = isSubmittedQuoteStatus;
//# sourceMappingURL=quote-workflow.service.js.map