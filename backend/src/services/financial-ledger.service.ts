import mongoose from 'mongoose';
import FinancialLedgerEntry, {
  FinancialLedgerEntryStatus,
  FinancialLedgerEntryType,
  IFinancialLedgerEntry,
} from '../models/financial-ledger-entry.model';

type LedgerDirection = IFinancialLedgerEntry['direction'];
type LedgerComponent = IFinancialLedgerEntry['component'];

export interface LedgerEntryInput {
  idempotencyKey: string;
  entryType: FinancialLedgerEntryType;
  amountMinor?: number;
  direction?: LedgerDirection;
  component?: LedgerComponent;
  description: string;
  countryCode?: string;
  currency?: string;
  bookingId?: unknown;
  quoteId?: unknown;
  invoiceId?: unknown;
  paymentTransactionId?: unknown;
  settlementId?: unknown;
  customerId?: unknown;
  technicianId?: unknown;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

const toObjectId = (value: unknown): mongoose.Types.ObjectId | null => {
  const raw = String(value || '').trim();
  return mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null;
};

const cleanCode = (value: unknown, length: number): string => {
  const next = String(value || '').trim().toUpperCase();
  return next.length === length ? next : '';
};

const normalizeAmount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;

const duplicateKey = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

export const recordLedgerEntry = async (input: LedgerEntryInput) => {
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new Error('Ledger idempotency key is required.');
  }

  const payload = {
    idempotencyKey,
    entryType: input.entryType,
    status: FinancialLedgerEntryStatus.POSTED,
    bookingId: toObjectId(input.bookingId),
    quoteId: toObjectId(input.quoteId),
    invoiceId: toObjectId(input.invoiceId),
    paymentTransactionId: toObjectId(input.paymentTransactionId),
    settlementId: toObjectId(input.settlementId),
    customerId: toObjectId(input.customerId),
    technicianId: toObjectId(input.technicianId),
    countryCode: cleanCode(input.countryCode, 2),
    currency: cleanCode(input.currency, 3),
    amountMinor: normalizeAmount(input.amountMinor),
    direction: input.direction || 'MEMO',
    component: input.component || 'MEMO',
    description: input.description,
    occurredAt: input.occurredAt || new Date(),
    metadata: input.metadata || {},
  };

  try {
    return await FinancialLedgerEntry.findOneAndUpdate(
      { idempotencyKey },
      { $setOnInsert: payload },
      { new: true, upsert: true }
    );
  } catch (error) {
    if (duplicateKey(error)) {
      return FinancialLedgerEntry.findOne({ idempotencyKey });
    }
    throw error;
  }
};

export const recordLedgerEntries = async (entries: LedgerEntryInput[]) => {
  const results = [];
  for (const entry of entries) {
    results.push(await recordLedgerEntry(entry));
  }
  return results;
};

export const listLedgerEntries = async (filter: {
  bookingId?: string;
  quoteId?: string;
  invoiceId?: string;
  paymentTransactionId?: string;
  settlementId?: string;
  countryCode?: string;
  customerId?: string;
  technicianId?: string;
  entryType?: string;
  status?: string;
  occurredFrom?: string;
  occurredTo?: string;
  limit?: number;
}) => {
  const query: Record<string, unknown> = {};
  const applyObjectIdFilter = (field: string, value?: string): boolean => {
    if (!value) return true;
    if (!mongoose.Types.ObjectId.isValid(value)) return false;
    query[field] = new mongoose.Types.ObjectId(value);
    return true;
  };
  if (!applyObjectIdFilter('bookingId', filter.bookingId)) return [];
  if (!applyObjectIdFilter('quoteId', filter.quoteId)) return [];
  if (!applyObjectIdFilter('invoiceId', filter.invoiceId)) return [];
  if (!applyObjectIdFilter('paymentTransactionId', filter.paymentTransactionId)) return [];
  if (!applyObjectIdFilter('settlementId', filter.settlementId)) return [];
  if (!applyObjectIdFilter('customerId', filter.customerId)) return [];
  if (!applyObjectIdFilter('technicianId', filter.technicianId)) return [];
  if (filter.countryCode) {
    const countryCode = cleanCode(filter.countryCode, 2);
    if (!countryCode) return [];
    query.countryCode = countryCode;
  }
  if (filter.entryType && Object.values(FinancialLedgerEntryType).includes(filter.entryType as FinancialLedgerEntryType)) {
    query.entryType = filter.entryType;
  }
  if (filter.status && Object.values(FinancialLedgerEntryStatus).includes(filter.status as FinancialLedgerEntryStatus)) {
    query.status = filter.status;
  }
  const occurredAt: Record<string, Date> = {};
  const occurredFrom = filter.occurredFrom ? new Date(filter.occurredFrom) : null;
  const occurredTo = filter.occurredTo ? new Date(filter.occurredTo) : null;
  if (occurredFrom && !Number.isNaN(occurredFrom.getTime())) occurredAt.$gte = occurredFrom;
  if (occurredTo && !Number.isNaN(occurredTo.getTime())) occurredAt.$lte = occurredTo;
  if (Object.keys(occurredAt).length) query.occurredAt = occurredAt;
  const limit = Math.min(Math.max(Number(filter.limit) || 100, 1), 500);
  return FinancialLedgerEntry.find(query).sort({ occurredAt: -1, createdAt: -1 }).limit(limit).lean();
};

export const ledgerType = FinancialLedgerEntryType;
