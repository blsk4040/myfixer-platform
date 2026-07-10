"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRouteRequest = void 0;
const SUPPORTED_PROFILES = ['driving'];
const toFiniteNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const parseCoordinate = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    const latitude = toFiniteNumber(candidate.latitude);
    const longitude = toFiniteNumber(candidate.longitude);
    if (latitude === null || longitude === null)
        return null;
    if (latitude < -90 || latitude > 90)
        return null;
    if (longitude < -180 || longitude > 180)
        return null;
    return { latitude, longitude };
};
const validateRouteRequest = (body) => {
    if (!body || typeof body !== 'object') {
        return { message: 'Route request body is required.' };
    }
    const record = body;
    const origin = parseCoordinate(record.origin);
    const destination = parseCoordinate(record.destination);
    const profile = typeof record.profile === 'string' ? record.profile.trim().toLowerCase() : 'driving';
    const bookingId = typeof record.bookingId === 'string' ? record.bookingId.trim() : undefined;
    if (!origin)
        return { message: 'Origin coordinates are missing or invalid.' };
    if (!destination)
        return { message: 'Destination coordinates are missing or invalid.' };
    if (!SUPPORTED_PROFILES.includes(profile)) {
        return { message: 'Unsupported routing profile.' };
    }
    return {
        value: {
            origin,
            destination,
            profile: profile,
            ...(bookingId ? { bookingId } : {}),
        },
    };
};
exports.validateRouteRequest = validateRouteRequest;
//# sourceMappingURL=routing.validation.js.map