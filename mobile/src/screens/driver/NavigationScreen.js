import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency, formatRating, formatDuration } from '../../utils/formatters';
import useLocationStore from '../../store/locationStore';
import { getSocket } from '../../services/socket';
import { post } from '../../services/api';
import MapComponent from '../../components/Map';

const RIDE_PHASES = {
  TO_PICKUP: 'to_pickup',
  AT_PICKUP: 'at_pickup',
  IN_RIDE: 'in_ride',
  COMPLETED: 'completed',
};

const NavigationScreen = ({ navigation, route }) => {
  const ride = route.params?.ride;
  const [phase, setPhase] = useState(RIDE_PHASES.TO_PICKUP);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { currentLocation, startTracking } = useLocationStore();

  useEffect(() => {
    startTracking();

    const socket = getSocket();
    if (socket && currentLocation) {
      const locationInterval = setInterval(() => {
        const loc = useLocationStore.getState().currentLocation;
        if (loc) {
          socket.emit('driver:location_update', {
            rideId: ride?.id || ride?._id,
            location: loc,
          });
        }
      }, 5000);

      return () => clearInterval(locationInterval);
    }
  }, []);

  const handleArrivedAtPickup = async () => {
    setIsSubmitting(true);
    try {
      const rideId = ride?.id || ride?._id;
      await post(`/rides/${rideId}/arrived`);
      const socket = getSocket();
      if (socket) {
        socket.emit('ride:driver_arrived', { rideId });
      }
      setPhase(RIDE_PHASES.AT_PICKUP);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRide = async () => {
    setIsSubmitting(true);
    try {
      const rideId = ride?.id || ride?._id;
      await post(`/rides/${rideId}/start`);
      const socket = getSocket();
      if (socket) {
        socket.emit('ride:started', { rideId });
      }
      setPhase(RIDE_PHASES.IN_RIDE);
    } catch (error) {
      Alert.alert('Error', 'Failed to start ride.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteRide = async () => {
    Alert.alert(
      'Complete Ride',
      'Are you sure the passenger has arrived at their destination?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const rideId = ride?.id || ride?._id;
              await post(`/rides/${rideId}/complete`);
              const socket = getSocket();
              if (socket) {
                socket.emit('ride:completed', { rideId });
              }
              setPhase(RIDE_PHASES.COMPLETED);
              navigation.replace('DriverRating', { ride });
            } catch (error) {
              Alert.alert('Error', 'Failed to complete ride.');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const getActionButton = () => {
    switch (phase) {
      case RIDE_PHASES.TO_PICKUP:
        return {
          label: 'Arrived at Pickup',
          onPress: handleArrivedAtPickup,
          color: COLORS.info,
        };
      case RIDE_PHASES.AT_PICKUP:
        return {
          label: 'Start Ride',
          onPress: handleStartRide,
          color: COLORS.primary,
        };
      case RIDE_PHASES.IN_RIDE:
        return {
          label: 'Complete Ride',
          onPress: handleCompleteRide,
          color: COLORS.secondary,
        };
      default:
        return null;
    }
  };

  const getPhaseLabel = () => {
    switch (phase) {
      case RIDE_PHASES.TO_PICKUP:
        return 'Navigate to pickup';
      case RIDE_PHASES.AT_PICKUP:
        return 'Waiting for passenger';
      case RIDE_PHASES.IN_RIDE:
        return 'Ride in progress';
      case RIDE_PHASES.COMPLETED:
        return 'Ride completed';
      default:
        return '';
    }
  };

  // Build markers and route
  const markers = [];
  if (currentLocation) {
    markers.push({
      id: 'driver',
      coordinate: currentLocation,
      title: 'You',
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

  // Route polyline based on phase
  const polyline = [];
  if (currentLocation) polyline.push(currentLocation);
  if (phase === RIDE_PHASES.TO_PICKUP || phase === RIDE_PHASES.AT_PICKUP) {
    if (ride?.pickup) {
      polyline.push({
        latitude: ride.pickup.latitude,
        longitude: ride.pickup.longitude,
      });
    }
  }
  if (phase === RIDE_PHASES.IN_RIDE || phase === RIDE_PHASES.AT_PICKUP) {
    if (ride?.dropoff) {
      polyline.push({
        latitude: ride.dropoff.latitude,
        longitude: ride.dropoff.longitude,
      });
    }
  }

  const action = getActionButton();
  const passenger = ride?.passenger;

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapComponent
        markers={markers}
        polyline={polyline.length > 1 ? polyline : null}
        showUserLocation
        initialRegion={
          currentLocation
            ? {
                ...currentLocation,
                latitudeDelta: 0.03,
                longitudeDelta: 0.03,
              }
            : undefined
        }
      />

      {/* Phase Label */}
      <View style={styles.phaseBanner}>
        <View style={[styles.phaseDot, { backgroundColor: action?.color || COLORS.primary }]} />
        <Text style={styles.phaseText}>{getPhaseLabel()}</Text>
      </View>

      {/* Bottom Info */}
      <View style={styles.bottomCard}>
        {/* Passenger Info */}
        {passenger && (
          <View style={styles.passengerRow}>
            <View style={styles.passengerAvatar}>
              <Text style={styles.passengerAvatarText}>
                {(passenger.firstName || 'P')[0]}
              </Text>
            </View>
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerName}>
                {passenger.firstName} {passenger.lastName?.[0] || ''}.
              </Text>
              <Text style={styles.passengerRating}>
                {formatRating(passenger.rating || 4.5)}
              </Text>
            </View>
            {ride?.fare && (
              <View style={styles.fareDisplay}>
                <Text style={styles.fareAmount}>
                  {formatCurrency(ride.fare || ride.estimatedFare)}
                </Text>
                <Text style={styles.fareLabel}>Est. fare</Text>
              </View>
            )}
          </View>
        )}

        {/* Route info */}
        <View style={styles.routeInfo}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {ride?.pickup?.address || 'Pickup location'}
            </Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {ride?.dropoff?.address || 'Dropoff location'}
            </Text>
          </View>
        </View>

        {/* Action Button */}
        {action && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: action.color },
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={action.onPress}
            disabled={isSubmitting}
          >
            <Text style={styles.actionButtonText}>
              {isSubmitting ? 'Updating...' : action.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  phaseBanner: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  phaseText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
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
    paddingTop: 20,
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  passengerRating: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  fareDisplay: {
    alignItems: 'flex-end',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  fareLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  routeInfo: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  routeText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: 4,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default NavigationScreen;
