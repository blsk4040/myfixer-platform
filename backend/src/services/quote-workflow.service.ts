import { CurrencyCode, toMinorUnits } from '../config/market.config';
import { QuoteLineItemType, QuoteStatus } from '../models/quote.model';

export interface QuoteLineItemInput {
  type?: unknown;
  label?: unknown;
  description?: unknown;
  quantity?: unknown;
  unitAmount?: unknown;
  unitAmountMinor?: unknown;
  notes?: unknown;
  taxable?: unknown;
}

export interface NormalizedQuoteLineItem {
  type: QuoteLineItemType;
  label: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  notes?: string;
  taxable?: boolean;
}

export interface QuoteTotals {
  lineItems: NormalizedQuoteLineItem[];
  subtotalAmountMinor: number;
  discountAmountMinor: number;
  totalAmountMinor: number;
}

export class QuoteWorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

const normalizeLineItemType = (type: unknown): QuoteLineItemType => {
  const raw = typeof type === 'string' ? type.trim().toUpperCase() : '';
  const aliases: Record<string, QuoteLineItemType> = {
    CALL_OUT: QuoteLineItemType.CALL_OUT,
    CALLOUT: QuoteLineItemType.CALL_OUT,
    LABOUR: QuoteLineItemType.LABOUR,
    LABOR: QuoteLineItemType.LABOUR,
  };
  const normalized = aliases[raw] || raw;
  if (!Object.values(QuoteLineItemType).includes(normalized as QuoteLineItemType)) {
    throw new QuoteWorkflowError('Invalid quote line item type.', 'INVALID_LINE_ITEM_TYPE');
  }
  return normalized as QuoteLineItemType;
};

const normalizeMinorAmount = (item: QuoteLineItemInput, currency: CurrencyCode): number => {
  if (Number.isInteger(item.unitAmountMinor)) {
    return Number(item.unitAmountMinor);
  }
  const unitAmount = Number(item.unitAmount);
  if (!Number.isFinite(unitAmount)) {
    throw new QuoteWorkflowError('Each line item requires a valid amount.', 'INVALID_LINE_ITEM_AMOUNT');
  }
  return toMinorUnits(unitAmount, currency);
};

export const calculateQuoteTotals = (
  items: QuoteLineItemInput[],
  currency: CurrencyCode
): QuoteTotals => {
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
    const isDiscount = type === QuoteLineItemType.DISCOUNT;
    const totalAmountMinor = isDiscount ? -absoluteTotal : absoluteTotal;
    if (isDiscount) {
      discountAmountMinor += absoluteTotal;
    } else {
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

export const isSubmittedQuoteStatus = (status: string): boolean =>
  [QuoteStatus.SUBMITTED, QuoteStatus.SENT_TO_CLIENT, QuoteStatus.APPROVED].includes(status as QuoteStatus);
