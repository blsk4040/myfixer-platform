export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type RoutingProviderName = 'osrm';
export type RoutingProfile = 'driving';

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

export interface RouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  profile: RoutingProfile;
  bookingId?: string;
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

export interface RoutingError {
  message: string;
  code?: string;
}

export interface EtaDisplay {
  travelTime: string;
  arrivalTime: string;
}
