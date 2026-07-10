"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingWorkflowConfig = void 0;
const toPositiveNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
exports.bookingWorkflowConfig = {
    arrivalRadiusMeters: toPositiveNumber(process.env.ARRIVAL_RADIUS_METERS, 100),
    arrivalConfirmationSeconds: toPositiveNumber(process.env.ARRIVAL_CONFIRMATION_SECONDS, 10),
    arrivalRequiredReadings: Math.max(1, Math.round(toPositiveNumber(process.env.ARRIVAL_REQUIRED_READINGS, 2))),
    arrivalMaxGpsAccuracyMeters: toPositiveNumber(process.env.ARRIVAL_MAX_GPS_ACCURACY_METERS, 50),
    arrivalMaxReadingAgeSeconds: toPositiveNumber(process.env.ARRIVAL_MAX_READING_AGE_SECONDS, 30),
    arrivalMaxFutureSkewSeconds: 5,
    arrivalImpossibleSpeedMetersPerSecond: 80,
};
//# sourceMappingURL=booking-workflow.config.js.map