import { RouteRequest, RoutingProfile } from './routing.types';

const SUPPORTED_PROFILES: RoutingProfile[] = ['driving'];

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCoordinate = (value: unknown): { latitude: number; longitude: number } | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const latitude = toFiniteNumber(candidate.latitude);
  const longitude = toFiniteNumber(candidate.longitude);

  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
};

export interface RouteValidationResult {
  value?: RouteRequest;
  message?: string;
}

export const validateRouteRequest = (body: unknown): RouteValidationResult => {
  if (!body || typeof body !== 'object') {
    return { message: 'Route request body is required.' };
  }

  const record = body as Record<string, unknown>;
  const origin = parseCoordinate(record.origin);
  const destination = parseCoordinate(record.destination);
  const profile = typeof record.profile === 'string' ? record.profile.trim().toLowerCase() : 'driving';
  const bookingId = typeof record.bookingId === 'string' ? record.bookingId.trim() : undefined;

  if (!origin) return { message: 'Origin coordinates are missing or invalid.' };
  if (!destination) return { message: 'Destination coordinates are missing or invalid.' };
  if (!SUPPORTED_PROFILES.includes(profile as RoutingProfile)) {
    return { message: 'Unsupported routing profile.' };
  }

  return {
    value: {
      origin,
      destination,
      profile: profile as RoutingProfile,
      ...(bookingId ? { bookingId } : {}),
    },
  };
};
