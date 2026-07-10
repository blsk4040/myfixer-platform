import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateRoute } from '../services/routingApi';
import { Coordinate, RouteResult } from '../types/routing';
import { distanceFromRouteMeters, distanceMetersBetween, isValidCoordinate } from '../utils/distance';

const RECALCULATION_DISTANCE_METERS = 100;
const RECALCULATION_INTERVAL_MS = 30000;
const OFF_ROUTE_DISTANCE_METERS = 150;

interface UseJobRouteInput {
  bookingId?: string;
  origin: Coordinate | null;
  destination: Coordinate | null;
  enabled?: boolean;
}

interface RouteState {
  route: RouteResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  lastRouteCalculatedAt: string | null;
  lastRouteOrigin: Coordinate | null;
  lastRouteDestination: Coordinate | null;
  lastKnownDistanceMeters: number | null;
  lastKnownDurationSeconds: number | null;
  refreshRoute: () => void;
}

export function useJobRoute({ bookingId, origin, destination, enabled = true }: UseJobRouteInput): RouteState {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRequestRef = useRef<{
    calculatedAt: number;
    origin: Coordinate;
    destination: Coordinate;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  const refreshRoute = useCallback(() => setRefreshNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled || !isValidCoordinate(origin) || !isValidCoordinate(destination)) {
      abortRef.current?.abort();
      setRoute(null);
      setIsLoading(false);
      return undefined;
    }

    const last = lastRequestRef.current;
    const now = Date.now();
    const movedEnough = !last || distanceMetersBetween(origin, last.origin) >= RECALCULATION_DISTANCE_METERS;
    const waitedEnough = !last || now - last.calculatedAt >= RECALCULATION_INTERVAL_MS;
    const destinationChanged = !last || distanceMetersBetween(destination, last.destination) >= 10;
    const offRouteDistance = route ? distanceFromRouteMeters(origin, route.geometry) : null;
    const offRoute = offRouteDistance !== null && offRouteDistance >= OFF_ROUTE_DISTANCE_METERS;
    const manual = refreshNonce > 0;

    if (inFlightRef.current) return undefined;
    if (!manual && !destinationChanged && !(movedEnough && waitedEnough) && !offRoute) return undefined;

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    inFlightRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    const timer = setTimeout(() => {
      void calculateRoute(
        {
          origin,
          destination,
          profile: 'driving',
          ...(bookingId ? { bookingId } : {}),
        },
        controller.signal
      )
        .then((nextRoute) => {
          setRoute((current) => {
            if (current && Math.abs(current.durationSeconds - nextRoute.durationSeconds) < 60) {
              return { ...nextRoute, durationSeconds: current.durationSeconds, durationMinutes: current.durationMinutes };
            }
            return nextRoute;
          });
          lastRequestRef.current = { calculatedAt: Date.now(), origin, destination };
        })
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setErrorMessage(error instanceof Error ? error.message : 'The road route is temporarily unavailable.');
        })
        .finally(() => {
          inFlightRef.current = false;
          setIsLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
      inFlightRef.current = false;
    };
  }, [bookingId, destination, enabled, origin, refreshNonce, route]);

  return {
    route,
    isLoading,
    errorMessage,
    lastRouteCalculatedAt: route?.calculatedAt ?? null,
    lastRouteOrigin: lastRequestRef.current?.origin ?? null,
    lastRouteDestination: lastRequestRef.current?.destination ?? null,
    lastKnownDistanceMeters: route?.distanceMeters ?? null,
    lastKnownDurationSeconds: route?.durationSeconds ?? null,
    refreshRoute,
  };
}
