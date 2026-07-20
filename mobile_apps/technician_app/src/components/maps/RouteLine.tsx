import React, { useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { RouteGeometry } from '../../types/routing';

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

  if (!data) return null;

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
