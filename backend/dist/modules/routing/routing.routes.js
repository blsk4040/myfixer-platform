"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const routing_controller_1 = require("./routing.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const routingRouter = (0, express_1.Router)();
routingRouter.post('/route', auth_middleware_1.authenticateToken, routing_controller_1.routeRateLimit, routing_controller_1.calculateRoute);
exports.default = routingRouter;
//# sourceMappingURL=routing.routes.js.map