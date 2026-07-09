import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Camera, Map as MapLibreMap, Marker, type StyleSpecification } from '@maplibre/maplibre-react-native';

interface JobMapViewProps {
  jobStatus: string;
}

const CENTER: [number, number] = [28.0142, -26.0435];

const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#090D14' } },
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.92 } },
  ],
};

export function JobMapView({ jobStatus }: JobMapViewProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <MapLibreMap mapStyle={OSM_RASTER_STYLE} style={styles.map}>
        <Camera center={CENTER} zoom={13} />
        {jobStatus !== 'IDLE' && (
          <Marker lngLat={[28.0160, -26.0450]}>
            <View style={styles.markerDot} />
          </Marker>
        )}
      </MapLibreMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 180, borderRadius: 12, overflow: 'hidden', marginVertical: 8, borderWidth: 1, borderColor: '#1E293B' },
  map: { ...StyleSheet.absoluteFillObject },
  markerDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', borderWidth: 3, borderColor: '#090D14' },
});
