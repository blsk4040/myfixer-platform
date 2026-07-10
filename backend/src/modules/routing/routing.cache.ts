import { RouteRequest, RouteResult, RoutingProviderName } from './routing.types';

interface CacheEntry {
  expiresAt: number;
  result: RouteResult;
}

export interface RouteCache {
  get(input: RouteRequest, provider: RoutingProviderName): RouteResult | null;
  set(input: RouteRequest, provider: RoutingProviderName, result: RouteResult): void;
  clear(): void;
}

const getTtlMs = (): number => {
  const seconds = Number(process.env.ROUTE_CACHE_TTL_SECONDS ?? 30);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 30000;
};

const roundCoordinate = (value: number): number => Math.round(value * 10000) / 10000;

const buildCacheKey = (input: RouteRequest, provider: RoutingProviderName): string =>
  [
    provider,
    input.profile,
    roundCoordinate(input.origin.latitude),
    roundCoordinate(input.origin.longitude),
    roundCoordinate(input.destination.latitude),
    roundCoordinate(input.destination.longitude),
  ].join(':');

export class InMemoryRouteCache implements RouteCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(input: RouteRequest, provider: RoutingProviderName): RouteResult | null {
    const key = buildCacheKey(input, provider);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.result;
  }

  set(input: RouteRequest, provider: RoutingProviderName, result: RouteResult): void {
    this.entries.set(buildCacheKey(input, provider), {
      expiresAt: Date.now() + getTtlMs(),
      result,
    });
  }

  clear(): void {
    this.entries.clear();
  }
}

export const routeCache = new InMemoryRouteCache();
