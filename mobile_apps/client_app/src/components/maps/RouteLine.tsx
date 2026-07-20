import React, { useMemo } from 'react';
import { RouteGeometry } from '../../types/routing';
import { isExpoGoRuntime } from '../../config/runtimeEnvironment';

declare const require: any;

const MapLibreNative = (() => {
  if (isExpoGoRuntime) return null;
  try {
    return require('@maplibre/maplibre-react-native');
  } catch {
    return null;
  }
})();

interface RouteLineProps {
  id: string;
  geometry: RouteGeometry | null | undefined;
}

export function RouteLine({ id, geometry }: RouteLineProps): React.JSX.Element | null {
  const data = useMemo(() => {
    if (!geometry || geometry.coordinates.length < 2) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry,
        },
      ],
    };
  }, [geometry]);

  if (!data || !MapLibreNative) return null;

  const { GeoJSONSource, Layer } = MapLibreNative;

  return (
    <GeoJSONSource id={`${id}-source`} data={data}>
      <Layer
        id={`${id}-line`}
        type="line"
        paint={{ 'line-color': '#B8FF3D', 'line-width': 5, 'line-opacity': 0.95 }}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
      />
    </GeoJSONSource>
  );
}
