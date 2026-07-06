"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinServiceWaitlist = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const service_waitlist_model_1 = __importStar(require("../models/service-waitlist.model"));
const audit_service_1 = require("../services/audit.service");
const service_availability_service_1 = require("../services/service-availability.service");
const market_config_1 = require("../config/market.config");
const getAuthenticatedUser = (request) => request.user;
const joinServiceWaitlist = async (request, response) => {
    const body = request.body || {};
    const authUser = getAuthenticatedUser(request);
    const countryCode = (0, market_config_1.normalizeCountryCode)(body.countryCode ?? body.country_code);
    const city = (0, service_availability_service_1.normalizeText)(body.city);
    const area = (0, service_availability_service_1.normalizeText)(body.area ?? body.neighbourhood ?? body.neighborhood);
    const serviceKey = (0, service_availability_service_1.normalizeServiceKey)(body.serviceKey ?? body.service_key);
    const email = (0, service_availability_service_1.normalizeText)(body.email ?? authUser?.email).toLowerCase();
    const phone = (0, service_availability_service_1.normalizeText)(body.phone);
    const customerId = (0, service_availability_service_1.normalizeText)(body.customerId ?? authUser?.id ?? authUser?._id);
    if (!email || !email.includes('@')) {
        response.status(400).json({ message: 'A valid email address is required.' });
        return;
    }
    if (!city || !serviceKey) {
        response.status(400).json({ message: 'City and service are required to join the waitlist.' });
        return;
    }
    const availability = await (0, service_availability_service_1.getMarketAvailability)(countryCode, city, area);
    const service = availability.services.find((item) => item.serviceKey === serviceKey);
    if (!service) {
        response.status(404).json({ message: 'This service is not configured for the selected location.' });
        return;
    }
    if (service.canBook) {
        response.status(409).json({ message: 'This service is already available in your area. You can book it now.' });
        return;
    }
    try {
        const waitlist = await service_waitlist_model_1.default.findOneAndUpdate({
            email,
            countryCode,
            city,
            area,
            serviceKey,
        }, {
            $setOnInsert: {
                customerId: customerId && mongoose_1.default.Types.ObjectId.isValid(customerId)
                    ? new mongoose_1.default.Types.ObjectId(customerId)
                    : undefined,
                email,
                phone,
                countryCode,
                city,
                area,
                serviceKey,
                status: service_waitlist_model_1.ServiceWaitlistStatus.WAITING,
                source: service_waitlist_model_1.ServiceWaitlistSource.CLIENT_APP,
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
        await (0, audit_service_1.logAuditEvent)(request, {
            action: 'service_waitlist.join',
            module: 'MARKETS',
            resourceType: 'ServiceWaitlist',
            resourceId: waitlist._id.toString(),
            metadata: {
                countryCode,
                city,
                area,
                serviceKey,
                email,
                status: waitlist.status,
            },
        });
        response.status(200).json({
            success: true,
            message: 'You are on the waitlist. We will notify you when this service launches in your area.',
            waitlist: {
                id: waitlist._id,
                countryCode: waitlist.countryCode,
                city: waitlist.city,
                area: waitlist.area,
                serviceKey: waitlist.serviceKey,
                status: waitlist.status,
            },
        });
    }
    catch (error) {
        if (error?.code === 11000) {
            response.status(200).json({
                success: true,
                message: 'You are already on the waitlist for this service.',
            });
            return;
        }
        console.error('Failed to join service waitlist:', error);
        response.status(500).json({ message: 'Unable to join the waitlist right now.' });
    }
};
exports.joinServiceWaitlist = joinServiceWaitlist;
//# sourceMappingURL=waitlist.controller.js.map