import { RouteGeometry, RouteRequest, RouteResult, RouteStep, RoutingError, RoutingProvider } from './routing.types';

interface OsrmStep {
  distance?: number;
  duration?: number;
  name?: string;
  geometry?: RouteGeometry;
  maneuver?: {
    type?: string;
    modifier?: string;
  };
}

interface OsrmRouteResponse {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: RouteGeometry;
    legs?: Array<{
      steps?: OsrmStep[];
    }>;
  }>;
}

const getBaseUrl = (): string => {
  const configured = process.env.OSRM_BASE_URL;
  const baseUrl = (configured === undefined ? 'https://router.project-osrm.org' : configured).trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider base URL is not configured.', 503);
  }
  return baseUrl;
};

const getTimeoutMs = (): number => {
  const timeout = Number(process.env.ROUTING_REQUEST_TIMEOUT_MS ?? 8000);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 8000;
};

const osrmProfileFor = (profile: RouteRequest['profile']): string => {
  if (profile === 'driving') return 'driving';
  throw new RoutingError('INVALID_ROUTE_REQUEST', 'Unsupported routing profile.', 400);
};

const toLngLat = (coordinate: { latitude: number; longitude: number }): string =>
  `${coordinate.longitude},${coordinate.latitude}`;

const buildInstruction = (step: OsrmStep): string => {
  const maneuver = step.maneuver;
  const action = [maneuver?.type, maneuver?.modifier].filter(Boolean).join(' ');
  const road = step.name ? ` onto ${step.name}` : '';
  return `${action || 'continue'}${road}`.trim();
};

const isLineString = (geometry: unknown): geometry is RouteGeometry => {
  if (!geometry || typeof geometry !== 'object') return false;
  const candidate = geometry as Partial<RouteGeometry>;
  return (
    candidate.type === 'LineString' &&
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        typeof item[0] === 'number' &&
        Number.isFinite(item[0]) &&
        typeof item[1] === 'number' &&
        Number.isFinite(item[1])
    )
  );
};

export class OsrmRoutingProvider implements RoutingProvider {
  async calculateRoute(input: RouteRequest): Promise<RouteResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getTimeoutMs());
    const coordinates = `${toLngLat(input.origin)};${toLngLat(input.destination)}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true',
      alternatives: 'false',
    });
    const url = `${getBaseUrl()}/route/v1/${osrmProfileFor(input.profile)}/${coordinates}?${params.toString()}`;

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Road routing is temporarily unavailable.', 502);
      }

      const payload = (await response.json()) as OsrmRouteResponse;
      if (payload.code === 'NoRoute') {
        throw new RoutingError('ROUTE_NOT_FOUND', 'No road route was found for these locations.', 404);
      }
      if (payload.code && payload.code !== 'Ok') {
        throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Road routing is temporarily unavailable.', 502);
      }

      const route = payload.routes?.[0];
      if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number' || !isLineString(route.geometry)) {
        throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Routing provider returned an invalid route.', 502);
      }

      const calculatedAt = new Date();
      const durationSeconds = Math.round(route.duration);
      const steps: RouteStep[] = (route.legs || []).flatMap((leg) =>
        (leg.steps || []).map((step) => ({
          distanceMeters: Math.round(step.distance ?? 0),
          durationSeconds: Math.round(step.duration ?? 0),
          instruction: buildInstruction(step),
          ...(step.name ? { name: step.name } : {}),
          ...(isLineString(step.geometry) ? { geometry: step.geometry } : {}),
        }))
      );

      return {
        distanceMeters: Math.round(route.distance),
        distanceKilometers: Math.round((route.distance / 1000) * 100) / 100,
        durationSeconds,
        durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
        estimatedArrivalAt: new Date(calculatedAt.getTime() + durationSeconds * 1000).toISOString(),
        geometry: route.geometry,
        steps,
        provider: 'osrm',
        calculatedAt: calculatedAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof RoutingError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RoutingError('ROUTING_TIMEOUT', 'Road routing timed out.', 504);
      }
      throw new RoutingError('ROUTING_PROVIDER_UNAVAILABLE', 'Road routing is temporarily unavailable.', 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}
