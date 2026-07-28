"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = void 0;
const metrics_service_1 = require("../services/metrics.service");
const routeLabel = (req) => {
    const routePath = req.route?.path;
    if (typeof routePath === 'string')
        return routePath;
    return req.path.replace(/[0-9a-f]{24}/gi, ':id');
};
const metricsMiddleware = (req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
        const labels = {
            method: req.method,
            route: routeLabel(req),
            status: res.statusCode,
        };
        (0, metrics_service_1.incrementMetric)('http_requests_total', labels);
        (0, metrics_service_1.observeMetric)('http_request_duration_ms', Date.now() - started, {
            method: req.method,
            route: routeLabel(req),
        });
    });
    next();
};
exports.metricsMiddleware = metricsMiddleware;
//# sourceMappingURL=metrics.middleware.js.map