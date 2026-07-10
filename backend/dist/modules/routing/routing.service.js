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
exports.routingService = exports.RoutingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const booking_model_1 = __importStar(require("../../models/booking.model"));
const user_model_1 = require("../../models/user.model");
const routing_provider_1 = require("./routing.provider");
const routing_cache_1 = require("./routing.cache");
const routing_types_1 = require("./routing.types");
const ACTIVE_ROUTE_STATUSES = new Set([
    booking_model_1.BookingStatus.ACCEPTED,
    booking_model_1.BookingStatus.IN_ROUTE,
    booking_model_1.BookingStatus.ARRIVED,
    booking_model_1.BookingStatus.IN_PROGRESS,
]);
class RoutingService {
    async calculateRoute(input, authUser) {
        if (input.bookingId) {
            await this.assertBookingAccess(input, authUser);
        }
        const providerName = (0, routing_provider_1.getRoutingProviderName)();
        const cached = routing_cache_1.routeCache.get(input, providerName);
        if (cached)
            return cached;
        const provider = (0, routing_provider_1.createRoutingProvider)();
        const result = await provider.calculateRoute(input);
        routing_cache_1.routeCache.set(input, providerName, result);
        return result;
    }
    async assertBookingAccess(input, authUser) {
        const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
        const role = (0, user_model_1.normalizeUserRole)(authUser?.role);
        if (!userId || !mongoose_1.default.Types.ObjectId.isValid(userId)) {
            throw new routing_types_1.RoutingError('ROUTING_UNAUTHORIZED', 'You are not allowed to access this route.', 403);
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(input.bookingId || '')) {
            throw new routing_types_1.RoutingError('INVALID_ROUTE_REQUEST', 'Invalid booking id.', 400);
        }
        const booking = await booking_model_1.default.findById(input.bookingId).select('customerId technicianId status customerLocation').lean();
        if (!booking) {
            throw new routing_types_1.RoutingError('ROUTING_UNAUTHORIZED', 'You are not allowed to access this route.', 404);
        }
        const isAdmin = role === user_model_1.UserRole.ADMIN;
        const isCustomer = String(booking.customerId) === userId;
        const isAssignedTechnician = String(booking.technicianId || '') === userId;
        if (!isAdmin && !isCustomer && !isAssignedTechnician) {
            throw new routing_types_1.RoutingError('ROUTING_UNAUTHORIZED', 'You are not allowed to access this route.', 403);
        }
        if (!ACTIVE_ROUTE_STATUSES.has(String(booking.status)) && !isAdmin) {
            throw new routing_types_1.RoutingError('ROUTING_UNAUTHORIZED', 'Routing is not available for this booking status.', 403);
        }
        if (isAssignedTechnician || isCustomer) {
            const [longitude, latitude] = booking.customerLocation.coordinates;
            const destinationMatches = Math.abs(input.destination.latitude - latitude) < 0.000001 &&
                Math.abs(input.destination.longitude - longitude) < 0.000001;
            if (!destinationMatches) {
                throw new routing_types_1.RoutingError('ROUTING_UNAUTHORIZED', 'Route destination must match the booking service location.', 403);
            }
        }
    }
}
exports.RoutingService = RoutingService;
exports.routingService = new RoutingService();
//# sourceMappingURL=routing.service.js.map