import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

interface JobMapViewProps {
  jobStatus: string;
}

// Sleek midnight map styling to match your dark dashboard theme
const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#0A0F14" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featuresType": "road", "elementType": "geometry", "stylers": [{ "color": "#111922" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1E293B" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

export function JobMapView({ jobStatus }: JobMapViewProps): React.JSX.Element {
  // Center coordinates for Johannesburg / Bryanston testing area
  const region = {
    latitude: -26.0435,
    longitude: 28.0142,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={region}
        customMapStyle={darkMapStyle}
        showsUserLocation={true}
      >
        {jobStatus !== 'IDLE' && (
          <Marker
            coordinate={{ latitude: -26.0450, longitude: 28.0160 }}
            title="Appliance Repair Job"
            description="Samsung Washing Machine Fix"
            pinColor="#EF4444"
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 180, borderRadius: 12, overflow: 'hidden', marginVertical: 8, borderWidth: 1, borderColor: '#1E293B' },
  map: { ...StyleSheet.absoluteFillObject },
});