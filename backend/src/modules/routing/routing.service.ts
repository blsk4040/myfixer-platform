import mongoose from 'mongoose';
import Booking, { BookingStatus } from '../../models/booking.model';
import { normalizeUserRole, UserRole } from '../../models/user.model';
import { createRoutingProvider, getRoutingProviderName } from './routing.provider';
import { routeCache } from './routing.cache';
import { RouteRequest, RouteResult, RoutingError } from './routing.types';

interface AuthUser {
  id?: string;
  _id?: string;
  role?: string;
}

const ACTIVE_ROUTE_STATUSES = new Set<string>([
  BookingStatus.ACCEPTED,
  BookingStatus.IN_ROUTE,
  BookingStatus.ARRIVED,
  BookingStatus.IN_PROGRESS,
]);

export class RoutingService {
  async calculateRoute(input: RouteRequest, authUser?: AuthUser): Promise<RouteResult> {
    if (input.bookingId) {
      await this.assertBookingAccess(input, authUser);
    }

    const providerName = getRoutingProviderName();
    const cached = routeCache.get(input, providerName);
    if (cached) return cached;

    const provider = createRoutingProvider();
    const result = await provider.calculateRoute(input);
    routeCache.set(input, providerName, result);
    return result;
  }

  private async assertBookingAccess(input: RouteRequest, authUser?: AuthUser): Promise<void> {
    const userId = String(authUser?.id ?? authUser?._id ?? '').trim();
    const role = normalizeUserRole(authUser?.role);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new RoutingError('ROUTING_UNAUTHORIZED', 'You are not allowed to access this route.', 403);
    }
    if (!mongoose.Types.ObjectId.isValid(input.bookingId || '')) {
      throw new RoutingError('INVALID_ROUTE_REQUEST', 'Invalid booking id.', 400);
    }

    const booking = await Booking.findById(input.bookingId).select('customerId technicianId status customerLocation').lean();
    if (!booking) {
      throw new RoutingError('ROUTING_UNAUTHORIZED', 'You are not allowed to access this route.', 404);
    }

    const isAdmin = role === UserRole.ADMIN;
    const isCustomer = String(booking.customerId) === userId;
    const isAssignedTechnician = String(booking.technicianId || '') === userId;
    if (!isAdmin && !isCustomer && !isAssignedTechnician) {
      throw new RoutingError('ROUTING_UNAUTHORIZED', 'You are not allowed to access this route.', 403);
    }

    if (!ACTIVE_ROUTE_STATUSES.has(String(booking.status)) && !isAdmin) {
      throw new RoutingError('ROUTING_UNAUTHORIZED', 'Routing is not available for this booking status.', 403);
    }

    if (isAssignedTechnician || isCustomer) {
      const [longitude, latitude] = booking.customerLocation.coordinates;
      const destinationMatches =
        Math.abs(input.destination.latitude - latitude) < 0.000001 &&
        Math.abs(input.destination.longitude - longitude) < 0.000001;
      if (!destinationMatches) {
        throw new RoutingError('ROUTING_UNAUTHORIZED', 'Route destination must match the booking service location.', 403);
      }
    }
  }
}

export const routingService = new RoutingService();
