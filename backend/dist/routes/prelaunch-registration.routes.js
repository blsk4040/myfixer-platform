"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prelaunch_registration_controller_1 = require("../controllers/prelaunch-registration.controller");
const router = (0, express_1.Router)();
router.post('/', prelaunch_registration_controller_1.createPreLaunchRegistration);
exports.default = router;
//# sourceMappingURL=prelaunch-registration.routes.js.map