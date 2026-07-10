export type RoutingProfile = 'driving';
export type RoutingProviderName = 'osrm';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  profile: RoutingProfile;
  bookingId?: string;
}

export interface MatrixRequest {
  origins: Coordinate[];
  destinations: Coordinate[];
  profile: RoutingProfile;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteStep {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
  name?: string;
  geometry?: RouteGeometry;
}

export interface RouteResult {
  distanceMeters: number;
  distanceKilometers: number;
  durationSeconds: number;
  durationMinutes: number;
  estimatedArrivalAt: string;
  geometry: RouteGeometry;
  steps: RouteStep[];
  provider: RoutingProviderName;
  calculatedAt: string;
}

export interface MatrixResult {
  distancesMeters: number[][];
  durationsSeconds: number[][];
  provider: RoutingProviderName;
  calculatedAt: string;
}

export interface RoutingProvider {
  calculateRoute(input: RouteRequest): Promise<RouteResult>;
  calculateMatrix?(input: MatrixRequest): Promise<MatrixResult>;
}

export type RoutingErrorCode =
  | 'INVALID_ROUTE_REQUEST'
  | 'ROUTING_PROVIDER_UNAVAILABLE'
  | 'ROUTE_NOT_FOUND'
  | 'ROUTING_TIMEOUT'
  | 'ROUTING_UNAUTHORIZED';

export class RoutingError extends Error {
  constructor(
    public readonly code: RoutingErrorCode,
    message: string,
    public readonly statusCode = 502
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}
