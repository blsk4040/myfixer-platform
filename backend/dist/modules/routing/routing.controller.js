"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRoute = exports.routeRateLimit = void 0;
const routing_service_1 = require("./routing.service");
const routing_types_1 = require("./routing.types");
const routing_validation_1 = require("./routing.validation");
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const buckets = new Map();
const routeRateLimit = (request, response, next) => {
    const userId = String(request.user?.id ?? request.ip ?? 'anonymous');
    const now = Date.now();
    const bucket = buckets.get(userId);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        next();
        return;
    }
    if (bucket.count >= RATE_LIMIT_MAX) {
        response.status(429).json({ success: false, message: 'Too many route requests. Please try again shortly.' });
        return;
    }
    bucket.count += 1;
    next();
};
exports.routeRateLimit = routeRateLimit;
const calculateRoute = async (request, response) => {
    const validation = (0, routing_validation_1.validateRouteRequest)(request.body);
    if (!validation.value) {
        response.status(400).json({ success: false, message: validation.message || 'Invalid route request.' });
        return;
    }
    try {
        const result = await routing_service_1.routingService.calculateRoute(validation.value, request.user);
        response.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof routing_types_1.RoutingError) {
            response.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
            return;
        }
        response.status(500).json({ success: false, message: 'Road routing is temporarily unavailable.' });
    }
};
exports.calculateRoute = calculateRoute;
//# sourceMappingURL=routing.controller.js.map