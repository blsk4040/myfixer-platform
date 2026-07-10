import { Coordinate, RouteGeometry } from '../types/routing';

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const isValidCoordinate = (coordinate: Coordinate | null | undefined): coordinate is Coordinate =>
  Boolean(
    coordinate &&
      Number.isFinite(coordinate.latitude) &&
      coordinate.latitude >= -90 &&
      coordinate.latitude <= 90 &&
      Number.isFinite(coordinate.longitude) &&
      coordinate.longitude >= -180 &&
      coordinate.longitude <= 180
  );

export const distanceMetersBetween = (from: Coordinate, to: Coordinate): number => {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const distancePointToSegmentMeters = (point: Coordinate, start: Coordinate, end: Coordinate): number => {
  const x = point.longitude;
  const y = point.latitude;
  const x1 = start.longitude;
  const y1 = start.latitude;
  const x2 = end.longitude;
  const y2 = end.latitude;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distanceMetersBetween(point, start);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return distanceMetersBetween(point, { longitude: x1 + t * dx, latitude: y1 + t * dy });
};

export const distanceFromRouteMeters = (point: Coordinate, geometry: RouteGeometry | null | undefined): number | null => {
  if (!geometry || geometry.coordinates.length < 2) return null;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    const [startLng, startLat] = geometry.coordinates[index - 1];
    const [endLng, endLat] = geometry.coordinates[index];
    best = Math.min(
      best,
      distancePointToSegmentMeters(
        point,
        { longitude: startLng, latitude: startLat },
        { longitude: endLng, latitude: endLat }
      )
    );
  }
  return best;
};
