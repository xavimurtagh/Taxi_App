import React, { useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { COLORS, MAP_STYLE } from '../utils/constants';

const DEFAULT_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MapComponent = ({
  markers = [],
  polyline = null,
  initialRegion,
  onRegionChange,
  showUserLocation = false,
  style,
}) => {
  const mapRef = useRef(null);

  const getMarkerColor = (type) => {
    switch (type) {
      case 'pickup':
        return COLORS.primary;
      case 'dropoff':
        return COLORS.error;
      case 'driver':
        return COLORS.info;
      default:
        return COLORS.secondary;
    }
  };

  const getMarkerLabel = (type) => {
    switch (type) {
      case 'pickup':
        return '\u25B2';
      case 'dropoff':
        return '\u25CF';
      case 'driver':
        return '\u{1F697}';
      default:
        return '\u25CF';
    }
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion || DEFAULT_REGION}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={showUserLocation}
        showsCompass
        customMapStyle={MAP_STYLE}
        onRegionChangeComplete={onRegionChange}
      >
        {/* Markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            pinColor={getMarkerColor(marker.type)}
          >
            {marker.type === 'driver' && (
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerText}>{'\u{1F697}'}</Text>
              </View>
            )}
            {marker.type === 'pickup' && (
              <View style={[styles.locationMarker, styles.pickupMarker]}>
                <View style={styles.locationMarkerInner} />
              </View>
            )}
            {marker.type === 'dropoff' && (
              <View style={[styles.locationMarker, styles.dropoffMarker]}>
                <View style={[styles.locationMarkerInner, styles.dropoffMarkerInner]} />
              </View>
            )}
          </Marker>
        ))}

        {/* Route Polyline */}
        {polyline && polyline.length > 1 && (
          <Polyline
            coordinates={polyline}
            strokeColor={COLORS.mapRoute}
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: COLORS.info,
  },
  driverMarkerText: {
    fontSize: 18,
  },
  locationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  pickupMarker: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '30',
  },
  dropoffMarker: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '30',
  },
  locationMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  dropoffMarkerInner: {
    backgroundColor: COLORS.error,
  },
});

export default MapComponent;
