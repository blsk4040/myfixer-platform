import { MarketStatus } from '../models/market-setting.model';

export const MARKET_STATUS_TRANSITIONS: Record<MarketStatus, MarketStatus[]> = {
  [MarketStatus.DRAFT]: [MarketStatus.DRAFT, MarketStatus.COMING_SOON, MarketStatus.ACTIVE, MarketStatus.DISABLED, MarketStatus.ARCHIVED],
  [MarketStatus.COMING_SOON]: [MarketStatus.COMING_SOON, MarketStatus.ACTIVE, MarketStatus.PAUSED, MarketStatus.DISABLED, MarketStatus.ARCHIVED],
  [MarketStatus.ACTIVE]: [MarketStatus.ACTIVE, MarketStatus.PAUSED, MarketStatus.DISABLED, MarketStatus.ARCHIVED],
  [MarketStatus.PAUSED]: [MarketStatus.PAUSED, MarketStatus.ACTIVE, MarketStatus.DISABLED, MarketStatus.ARCHIVED],
  [MarketStatus.DISABLED]: [MarketStatus.DISABLED, MarketStatus.ACTIVE, MarketStatus.ARCHIVED],
  [MarketStatus.ARCHIVED]: [MarketStatus.ARCHIVED],
};

export const isAllowedMarketStatusTransition = (from: MarketStatus, to: MarketStatus): boolean =>
  (MARKET_STATUS_TRANSITIONS[from] || []).includes(to);
