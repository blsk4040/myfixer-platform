"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinArrivalRadius = exports.distanceMetersBetween = void 0;
const EARTH_RADIUS_METERS = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;
const distanceMetersBetween = (from, to) => {
    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);
    const deltaLat = toRadians(to.latitude - from.latitude);
    const deltaLng = toRadians(to.longitude - from.longitude);
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
exports.distanceMetersBetween = distanceMetersBetween;
const isWithinArrivalRadius = (current, destination, radiusMeters) => (0, exports.distanceMetersBetween)(current, destination) <= radiusMeters;
exports.isWithinArrivalRadius = isWithinArrivalRadius;
//# sourceMappingURL=routing.geo.js.map