"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeCache = exports.InMemoryRouteCache = void 0;
const getTtlMs = () => {
    const seconds = Number(process.env.ROUTE_CACHE_TTL_SECONDS ?? 30);
    return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 30000;
};
const roundCoordinate = (value) => Math.round(value * 10000) / 10000;
const buildCacheKey = (input, provider) => [
    provider,
    input.profile,
    roundCoordinate(input.origin.latitude),
    roundCoordinate(input.origin.longitude),
    roundCoordinate(input.destination.latitude),
    roundCoordinate(input.destination.longitude),
].join(':');
class InMemoryRouteCache {
    entries = new Map();
    get(input, provider) {
        const key = buildCacheKey(input, provider);
        const entry = this.entries.get(key);
        if (!entry)
            return null;
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return null;
        }
        return entry.result;
    }
    set(input, provider, result) {
        this.entries.set(buildCacheKey(input, provider), {
            expiresAt: Date.now() + getTtlMs(),
            result,
        });
    }
    clear() {
        this.entries.clear();
    }
}
exports.InMemoryRouteCache = InMemoryRouteCache;
exports.routeCache = new InMemoryRouteCache();
//# sourceMappingURL=routing.cache.js.map