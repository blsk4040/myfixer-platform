import assert from 'node:assert/strict';
import { InMemoryRouteCache } from '../src/modules/routing/routing.cache';
import { distanceMetersBetween, isWithinArrivalRadius } from '../src/modules/routing/routing.geo';
import { OsrmRoutingProvider } from '../src/modules/routing/osrm.provider';
import { RoutingError } from '../src/modules/routing/routing.types';
import { validateRouteRequest } from '../src/modules/routing/routing.validation';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

const southAfricanOrigin = { latitude: -25.7479, longitude: 28.2293 };
const southAfricanDestination = { latitude: -25.8603, longitude: 28.1878 };

const setMockFetch = (handler: (url: string, init?: RequestInit) => Promise<Response>): void => {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    handler(typeof input === 'string' ? input : input.toString(), init)) as typeof fetch;
};

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const assertRejectsRoutingCode = async (promise: Promise<unknown>, code: string): Promise<void> => {
  await assert.rejects(
    promise,
    (error: unknown) => error instanceof RoutingError && error.code === code
  );
};

async function run(): Promise<void> {
  process.env.ROUTING_REQUEST_TIMEOUT_MS = '5';
  process.env.ROUTE_CACHE_TTL_SECONDS = '30';
  process.env.OSRM_BASE_URL = 'https://router.project-osrm.org';

  const valid = validateRouteRequest({
    origin: southAfricanOrigin,
    destination: southAfricanDestination,
    profile: 'driving',
  });
  assert.ok(valid.value, 'valid South African route request should pass validation');

  assert.equal(validateRouteRequest({ origin: { latitude: -91, longitude: 28 }, destination: southAfricanDestination }).value, undefined);
  assert.equal(validateRouteRequest({ origin: { latitude: -25, longitude: 181 }, destination: southAfricanDestination }).value, undefined);
  assert.equal(validateRouteRequest({ origin: southAfricanOrigin, destination: southAfricanDestination, profile: 'walking' }).value, undefined);

  let capturedUrl = '';
  setMockFetch(async (url) => {
    capturedUrl = url;
    return jsonResponse({
      code: 'Ok',
      routes: [
        {
          distance: 12540.4,
          duration: 1080.2,
          geometry: {
            type: 'LineString',
            coordinates: [
              [28.2293, -25.7479],
              [28.1878, -25.8603],
            ],
          },
          legs: [
            {
              steps: [
                {
                  distance: 100,
                  duration: 20,
                  name: 'Pretoria Road',
                  geometry: { type: 'LineString', coordinates: [[28.2293, -25.7479], [28.22, -25.75]] },
                  maneuver: { type: 'depart' },
                },
              ],
            },
          ],
        },
      ],
    });
  });

  const provider = new OsrmRoutingProvider();
  const route = await provider.calculateRoute({
    origin: southAfricanOrigin,
    destination: southAfricanDestination,
    profile: 'driving',
  });

  assert.ok(capturedUrl.includes('/route/v1/driving/28.2293,-25.7479;28.1878,-25.8603?'), 'OSRM URL must use longitude,latitude order');
  assert.equal(route.distanceMeters, 12540);
  assert.equal(route.distanceKilometers, 12.54);
  assert.equal(route.durationSeconds, 1080);
  assert.equal(route.durationMinutes, 18);
  assert.equal(route.geometry.coordinates[0][0], 28.2293);
  assert.equal(route.geometry.coordinates[0][1], -25.7479);
  assert.equal(route.steps.length, 1);

  setMockFetch(async () => jsonResponse({ code: 'NoRoute' }));
  await assertRejectsRoutingCode(provider.calculateRoute({ origin: southAfricanOrigin, destination: southAfricanDestination, profile: 'driving' }), 'ROUTE_NOT_FOUND');

  setMockFetch(async () => jsonResponse({ code: 'Ok', routes: [{ distance: 10, duration: 5, geometry: { type: 'Point', coordinates: [0, 0] } }] }));
  await assertRejectsRoutingCode(provider.calculateRoute({ origin: southAfricanOrigin, destination: southAfricanDestination, profile: 'driving' }), 'ROUTING_PROVIDER_UNAVAILABLE');

  setMockFetch(async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  });
  await assertRejectsRoutingCode(provider.calculateRoute({ origin: southAfricanOrigin, destination: southAfricanDestination, profile: 'driving' }), 'ROUTING_TIMEOUT');

  const cache = new InMemoryRouteCache();
  cache.set({ origin: southAfricanOrigin, destination: southAfricanDestination, profile: 'driving' }, 'osrm', route);
  assert.equal(cache.get({ origin: { latitude: -25.74791, longitude: 28.22931 }, destination: southAfricanDestination, profile: 'driving' }, 'osrm')?.distanceMeters, 12540);
  assert.equal(cache.get({ origin: { latitude: -25.70, longitude: 28.22 }, destination: southAfricanDestination, profile: 'driving' }, 'osrm'), null);

  const shortDistance = distanceMetersBetween(southAfricanOrigin, { latitude: -25.748, longitude: 28.2294 });
  assert.ok(shortDistance > 0 && shortDistance < 20);
  assert.equal(isWithinArrivalRadius(southAfricanOrigin, { latitude: -25.748, longitude: 28.2294 }, 100), true);
  assert.equal(isWithinArrivalRadius(southAfricanOrigin, southAfricanDestination, 100), false);
}

run()
  .then(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    console.info('Routing module tests passed.');
  })
  .catch((error) => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    console.error(error);
    process.exit(1);
  });
