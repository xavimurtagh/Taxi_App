import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { COLORS, VEHICLE_TYPES } from '../../utils/constants';
import { formatCurrency, formatDuration } from '../../utils/formatters';
import useRideStore from '../../store/rideStore';
import useLocationStore from '../../store/locationStore';
import MapComponent from '../../components/Map';
import DriverCard from '../../components/DriverCard';
import FareEstimate from '../../components/FareEstimate';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState('economy');
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const {
    currentRide,
    rideStatus,
    nearbyDrivers,
    fareEstimate,
    requestRide,
    getFareEstimate,
    cancelRide,
    clearFareEstimate,
    isLoading,
  } = useRideStore();

  const { currentLocation, startTracking } = useLocationStore();

  useEffect(() => {
    startTracking();
  }, []);

  useEffect(() => {
    if (currentLocation && !pickup) {
      setPickup({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: 'Current Location',
      });
    }
  }, [currentLocation]);

  // Navigate to ride tracking when driver is assigned
  useEffect(() => {
    if (rideStatus === 'accepted' && currentRide?.driver) {
      navigation.navigate('RideTracking', { ride: currentRide });
    }
    if (rideStatus === 'completed') {
      navigation.navigate('PassengerRating', { ride: currentRide });
    }
  }, [rideStatus, currentRide]);

  const handleDestinationSelect = async (place) => {
    const simulatedDropoff = {
      latitude: (currentLocation?.latitude || 37.7749) + 0.02,
      longitude: (currentLocation?.longitude || -122.4194) + 0.015,
      address: place || destination,
    };
    setDropoff(simulatedDropoff);
    setShowVehicleSelector(true);
    setIsSearching(false);

    if (pickup) {
      try {
        await getFareEstimate(pickup, simulatedDropoff, selectedVehicle);
      } catch (err) {
        // Estimate may fail, user can still proceed
      }
    }
  };

  const handleVehicleSelect = async (vehicleId) => {
    setSelectedVehicle(vehicleId);
    if (pickup && dropoff) {
      try {
        await getFareEstimate(pickup, dropoff, vehicleId);
      } catch (err) {
        // silently handle
      }
    }
  };

  const handleConfirmRide = async () => {
    if (!pickup || !dropoff) {
      Alert.alert('Error', 'Please select pickup and dropoff locations.');
      return;
    }

    try {
      await requestRide(pickup, dropoff, selectedVehicle);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to request ride.');
    }
  };

  const handleCancelSearch = async () => {
    if (currentRide) {
      try {
        await cancelRide(currentRide.id || currentRide._id, 'User cancelled');
      } catch (err) {
        // handle error
      }
    }
    setShowVehicleSelector(false);
    setDropoff(null);
    clearFareEstimate();
  };

  const recentPlaces = [
    { id: '1', name: 'Home', address: '123 Main St', icon: '\u2302' },
    { id: '2', name: 'Work', address: '456 Office Ave', icon: '\u2616' },
  ];

  const quickSuggestions = [
    'Airport',
    'Downtown',
    'Shopping Mall',
    'Train Station',
  ];

  // Build map markers
  const markers = [];
  if (pickup) {
    markers.push({
      id: 'pickup',
      coordinate: { latitude: pickup.latitude, longitude: pickup.longitude },
      title: 'Pickup',
      type: 'pickup',
    });
  }
  if (dropoff) {
    markers.push({
      id: 'dropoff',
      coordinate: { latitude: dropoff.latitude, longitude: dropoff.longitude },
      title: 'Dropoff',
      type: 'dropoff',
    });
  }
  nearbyDrivers.forEach((driver, i) => {
    markers.push({
      id: `driver-${i}`,
      coordinate: driver.location,
      title: driver.name || 'Driver',
      type: 'driver',
    });
  });

  const polyline =
    pickup && dropoff
      ? [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: dropoff.latitude, longitude: dropoff.longitude },
        ]
      : null;

  const renderBottomContent = () => {
    // Finding driver state
    if (rideStatus === 'requested' || rideStatus === 'matching') {
      return (
        <View style={styles.bottomCard}>
          <View style={styles.searchingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.searchingText}>Finding your driver...</Text>
            <Text style={styles.searchingSubtext}>
              This usually takes less than a minute
            </Text>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSearch}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Driver assigned
    if (rideStatus === 'accepted' && currentRide?.driver) {
      return (
        <View style={styles.bottomCard}>
          <DriverCard driver={currentRide.driver} />
          <TouchableOpacity
            style={styles.sosButton}
            onPress={() => Alert.alert('SOS', 'Emergency services will be contacted.')}
          >
            <Text style={styles.sosButtonText}>Emergency SOS</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Vehicle selector and fare estimate
    if (showVehicleSelector) {
      return (
        <View style={styles.bottomCard}>
          <Text style={styles.sectionTitle}>Choose your ride</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleList}>
            {VEHICLE_TYPES.map((vehicle) => (
              <TouchableOpacity
                key={vehicle.id}
                style={[
                  styles.vehicleOption,
                  selectedVehicle === vehicle.id && styles.vehicleOptionSelected,
                ]}
                onPress={() => handleVehicleSelect(vehicle.id)}
              >
                <Text style={styles.vehicleIcon}>
                  {vehicle.id === 'accessible' ? '\u267F' : '\u{1F697}'}
                </Text>
                <Text
                  style={[
                    styles.vehicleLabel,
                    selectedVehicle === vehicle.id && styles.vehicleLabelSelected,
                  ]}
                >
                  {vehicle.label}
                </Text>
                <Text style={styles.vehicleMultiplier}>{vehicle.multiplier}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {fareEstimate && <FareEstimate estimate={fareEstimate} />}

          <TouchableOpacity
            style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
            onPress={handleConfirmRide}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <Text style={styles.confirmButtonText}>
                Confirm Ride{fareEstimate ? ` - ${formatCurrency(fareEstimate.total || fareEstimate.fare)}` : ''}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelLinkButton}
            onPress={handleCancelSearch}
          >
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default: destination search
    return (
      <View style={styles.bottomCard}>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setIsSearching(true)}
          activeOpacity={0.8}
        >
          <View style={styles.searchDot} />
          <Text style={[styles.searchPlaceholder, destination && styles.searchText]}>
            {destination || 'Where to?'}
          </Text>
        </TouchableOpacity>

        {isSearching && (
          <View style={styles.searchExpanded}>
            <TextInput
              style={styles.searchInput}
              placeholder="Enter destination..."
              placeholderTextColor={COLORS.textLight}
              value={destination}
              onChangeText={setDestination}
              autoFocus
              onSubmitEditing={() => handleDestinationSelect(destination)}
            />
            {/* Quick Suggestions */}
            <View style={styles.quickSuggestions}>
              {quickSuggestions.map((place) => (
                <TouchableOpacity
                  key={place}
                  style={styles.suggestionChip}
                  onPress={() => {
                    setDestination(place);
                    handleDestinationSelect(place);
                  }}
                >
                  <Text style={styles.suggestionChipText}>{place}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!isSearching && (
          <>
            <Text style={styles.sectionTitle}>Saved Places</Text>
            {recentPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.placeItem}
                onPress={() => {
                  setDestination(place.address);
                  handleDestinationSelect(place.address);
                }}
              >
                <View style={styles.placeIcon}>
                  <Text style={styles.placeIconText}>{place.icon}</Text>
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text style={styles.placeAddress}>{place.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapComponent
        markers={markers}
        polyline={polyline}
        showUserLocation
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : undefined
        }
      />

      {/* Emergency button during ride */}
      {(rideStatus === 'in_progress' || rideStatus === 'arriving' || rideStatus === 'arrived') && (
        <TouchableOpacity
          style={styles.sosFloating}
          onPress={() => Alert.alert('SOS', 'Emergency services will be contacted.')}
        >
          <Text style={styles.sosFloatingText}>SOS</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Sheet */}
      {renderBottomContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  searchDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },
  searchPlaceholder: {
    fontSize: 18,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  searchText: {
    color: COLORS.text,
  },
  searchExpanded: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  quickSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: COLORS.successLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionChipText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeIconText: {
    fontSize: 18,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  vehicleList: {
    marginBottom: 16,
  },
  vehicleOption: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    minWidth: 80,
  },
  vehicleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.successLight,
  },
  vehicleIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  vehicleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  vehicleLabelSelected: {
    color: COLORS.primary,
  },
  vehicleMultiplier: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelLinkButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  cancelLinkText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  searchingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  searchingText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  searchingSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  sosButton: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  sosButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  sosFloating: {
    position: 'absolute',
    top: 60,
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
  sosFloatingText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
});

export default HomeScreen;
