"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsrmRoutingProvider = void 0;
const routing_types_1 = require("./routing.types");
const getBaseUrl = () => {
    const configured = process.env.OSRM_BASE_URL;
    const baseUrl = (configured === undefined ? 'https://router.project-osrm.org' : configured).trim().replace(/\/+$/, '');
    if (!baseUrl) {
        throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider base URL is not configured.', 503);
    }
    return baseUrl;
};
const getTimeoutMs = () => {
    const timeout = Number(process.env.ROUTING_REQUEST_TIMEOUT_MS ?? 8000);
    return Number.isFinite(timeout) && timeout > 0 ? timeout : 8000;
};
const osrmProfileFor = (profile) => {
    if (profile === 'driving')
        return 'driving';
    throw new routing_types_1.RoutingError('INVALID_ROUTE_REQUEST', 'Unsupported routing profile.', 400);
};
const toLngLat = (coordinate) => `${coordinate.longitude},${coordinate.latitude}`;
const buildInstruction = (step) => {
    const maneuver = step.maneuver;
    const action = [maneuver?.type, maneuver?.modifier].filter(Boolean).join(' ');
    const road = step.name ? ` onto ${step.name}` : '';
    return `${action || 'continue'}${road}`.trim();
};
const isLineString = (geometry) => {
    if (!geometry || typeof geometry !== 'object')
        return false;
    const candidate = geometry;
    return (candidate.type === 'LineString' &&
        Array.isArray(candidate.coordinates) &&
        candidate.coordinates.every((item) => Array.isArray(item) &&
            item.length === 2 &&
            typeof item[0] === 'number' &&
            Number.isFinite(item[0]) &&
            typeof item[1] === 'number' &&
            Number.isFinite(item[1])));
};
class OsrmRoutingProvider {
    async calculateRoute(input) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
        const coordinates = `${toLngLat(input.origin)};${toLngLat(input.destination)}`;
        const params = new URLSearchParams({
            overview: 'full',
            geometries: 'geojson',
            steps: 'true',
            alternatives: 'false',
        });
        const url = `${getBaseUrl()}/route/v1/${osrmProfileFor(input.profile)}/${coordinates}?${params.toString()}`;
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Road routing is temporarily unavailable.', 502);
            }
            const payload = (await response.json());
            if (payload.code === 'NoRoute') {
                throw new routing_types_1.RoutingError('ROUTE_NOT_FOUND', 'No road route was found for these locations.', 404);
            }
            if (payload.code && payload.code !== 'Ok') {
                throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Road routing is temporarily unavailable.', 502);
            }
            const route = payload.routes?.[0];
            if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number' || !isLineString(route.geometry)) {
                throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider returned an invalid route.', 502);
            }
            const calculatedAt = new Date();
            const durationSeconds = Math.round(route.duration);
            const steps = (route.legs || []).flatMap((leg) => (leg.steps || []).map((step) => ({
                distanceMeters: Math.round(step.distance ?? 0),
                durationSeconds: Math.round(step.duration ?? 0),
                instruction: buildInstruction(step),
                ...(step.name ? { name: step.name } : {}),
                ...(isLineString(step.geometry) ? { geometry: step.geometry } : {}),
            })));
            return {
                distanceMeters: Math.round(route.distance),
                distanceKilometers: Math.round((route.distance / 1000) * 100) / 100,
                durationSeconds,
                durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
                estimatedArrivalAt: new Date(calculatedAt.getTime() + durationSeconds * 1000).toISOString(),
                geometry: route.geometry,
                steps,
                provider: 'osrm',
                calculatedAt: calculatedAt.toISOString(),
            };
        }
        catch (error) {
            if (error instanceof routing_types_1.RoutingError)
                throw error;
            if (error instanceof Error && error.name === 'AbortError') {
                throw new routing_types_1.RoutingError('ROUTING_TIMEOUT', 'Road routing timed out.', 504);
            }
            throw new routing_types_1.RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Road routing is temporarily unavailable.', 502);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.OsrmRoutingProvider = OsrmRoutingProvider;
//# sourceMappingURL=osrm.provider.js.map