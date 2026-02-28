import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatDuration, formatRating } from '../../utils/formatters';
import useRideStore from '../../store/rideStore';
import useLocationStore from '../../store/locationStore';
import { getSocket } from '../../services/socket';
import MapComponent from '../../components/Map';
import DriverCard from '../../components/DriverCard';

const RideTrackingScreen = ({ navigation, route }) => {
  const { currentRide, rideStatus } = useRideStore();
  const { currentLocation, driverLocation, setDriverLocation } = useLocationStore();

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('ride:driver_location', (data) => {
        setDriverLocation(data.location);
      });

      return () => {
        socket.off('ride:driver_location');
      };
    }
  }, []);

  useEffect(() => {
    if (rideStatus === 'completed') {
      navigation.replace('PassengerRating', { ride: currentRide });
    }
  }, [rideStatus]);

  const handleShareTrip = async () => {
    try {
      await Share.share({
        message: `I'm on my way via OpenRide! Driver: ${currentRide?.driver?.firstName || 'Unknown'}. Tracking my ride in real-time.`,
      });
    } catch (error) {
      // share cancelled
    }
  };

  const handleSOS = () => {
    Alert.alert(
      'Emergency SOS',
      'Are you sure you want to contact emergency services?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Emergency',
          style: 'destructive',
          onPress: () => Alert.alert('SOS', 'Emergency services have been notified.'),
        },
      ]
    );
  };

  const ride = currentRide || route.params?.ride;
  const driver = ride?.driver;

  const markers = [];
  if (driverLocation) {
    markers.push({
      id: 'driver',
      coordinate: driverLocation,
      title: 'Driver',
      type: 'driver',
    });
  }
  if (ride?.pickup) {
    markers.push({
      id: 'pickup',
      coordinate: {
        latitude: ride.pickup.latitude,
        longitude: ride.pickup.longitude,
      },
      title: 'Pickup',
      type: 'pickup',
    });
  }
  if (ride?.dropoff) {
    markers.push({
      id: 'dropoff',
      coordinate: {
        latitude: ride.dropoff.latitude,
        longitude: ride.dropoff.longitude,
      },
      title: 'Dropoff',
      type: 'dropoff',
    });
  }

  const polyline = [];
  if (driverLocation) {
    polyline.push(driverLocation);
  }
  if (ride?.pickup) {
    polyline.push({
      latitude: ride.pickup.latitude,
      longitude: ride.pickup.longitude,
    });
  }
  if (ride?.dropoff) {
    polyline.push({
      latitude: ride.dropoff.latitude,
      longitude: ride.dropoff.longitude,
    });
  }

  const getStatusMessage = () => {
    switch (rideStatus) {
      case 'accepted':
        return 'Driver is on the way';
      case 'arriving':
        return 'Driver is almost there';
      case 'arrived':
        return 'Driver has arrived';
      case 'in_progress':
        return 'Ride in progress';
      default:
        return 'Tracking ride...';
    }
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapComponent
        markers={markers}
        polyline={polyline.length > 1 ? polyline : null}
        showUserLocation
        initialRegion={
          driverLocation
            ? {
                ...driverLocation,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }
            : currentLocation
              ? {
                  ...currentLocation,
                  latitudeDelta: 0.03,
                  longitudeDelta: 0.03,
                }
              : undefined
        }
      />

      {/* SOS Button */}
      <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
        <Text style={styles.sosButtonText}>SOS</Text>
      </TouchableOpacity>

      {/* Bottom Info Card */}
      <View style={styles.bottomCard}>
        {/* Status */}
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{getStatusMessage()}</Text>
        </View>

        {/* ETA */}
        {ride?.driverEta && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{formatDuration(ride.driverEta)}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
        )}

        {/* Driver Info */}
        {driver && <DriverCard driver={driver} />}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareTrip}>
            <Text style={styles.shareButtonText}>Share Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyButton} onPress={handleSOS}>
            <Text style={styles.emergencyButtonText}>Emergency</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  sosButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  sosButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  etaValue: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
    marginRight: 8,
  },
  etaLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  shareButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emergencyButton: {
    flex: 1,
    backgroundColor: COLORS.errorLight,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emergencyButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RideTrackingScreen;
