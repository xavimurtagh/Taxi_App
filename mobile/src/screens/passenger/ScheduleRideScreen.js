import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  FlatList,
} from 'react-native';
import { COLORS, VEHICLE_TYPES } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';
import useSchedulingStore from '../../store/schedulingStore';

const ScheduleRideScreen = ({ navigation }) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('economy');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState(false);
  const [notes, setNotes] = useState('');
  const [estimatedFare, setEstimatedFare] = useState(null);

  const {
    scheduledRides,
    isLoading,
    error,
    fetchScheduledRides,
    createScheduledRide,
    cancelScheduledRide,
    clearError,
  } = useSchedulingStore();

  useEffect(() => {
    fetchScheduledRides();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  // Compute a simple fare estimate based on vehicle type multiplier
  useEffect(() => {
    if (pickupAddress && dropoffAddress) {
      const vehicle = VEHICLE_TYPES.find((v) => v.id === selectedVehicle);
      const multiplier = parseFloat(vehicle?.multiplier) || 1;
      const baseFare = 12.5; // Base estimate
      setEstimatedFare(baseFare * multiplier);
    } else {
      setEstimatedFare(null);
    }
  }, [pickupAddress, dropoffAddress, selectedVehicle]);

  const validateInputs = () => {
    if (!date.trim()) {
      Alert.alert('Missing Date', 'Please enter a date (YYYY-MM-DD).');
      return false;
    }
    if (!time.trim()) {
      Alert.alert('Missing Time', 'Please enter a time (HH:MM).');
      return false;
    }
    if (!pickupAddress.trim()) {
      Alert.alert('Missing Pickup', 'Please enter a pickup address.');
      return false;
    }
    if (!dropoffAddress.trim()) {
      Alert.alert('Missing Dropoff', 'Please enter a dropoff address.');
      return false;
    }

    // Basic date format validation
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date.trim())) {
      Alert.alert('Invalid Date', 'Please use the format YYYY-MM-DD.');
      return false;
    }

    // Basic time format validation
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(time.trim())) {
      Alert.alert('Invalid Time', 'Please use the format HH:MM.');
      return false;
    }

    // Check that scheduled time is in the future
    const scheduledDate = new Date(`${date.trim()}T${time.trim()}:00`);
    if (scheduledDate <= new Date()) {
      Alert.alert('Invalid Time', 'Scheduled time must be in the future.');
      return false;
    }

    return true;
  };

  const handleScheduleRide = async () => {
    if (!validateInputs()) return;

    try {
      const scheduledDateTime = `${date.trim()}T${time.trim()}:00`;
      await createScheduledRide({
        scheduledTime: scheduledDateTime,
        pickup: { address: pickupAddress.trim() },
        dropoff: { address: dropoffAddress.trim() },
        vehicleType: selectedVehicle,
        accessibilityNeeds,
        notes: notes.trim(),
      });

      Alert.alert('Success', 'Your ride has been scheduled!');

      // Reset form
      setDate('');
      setTime('');
      setPickupAddress('');
      setDropoffAddress('');
      setSelectedVehicle('economy');
      setAccessibilityNeeds(false);
      setNotes('');
      setEstimatedFare(null);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to schedule ride.');
    }
  };

  const handleCancelScheduledRide = (rideId) => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this scheduled ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelScheduledRide(rideId);
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to cancel ride.');
            }
          },
        },
      ]
    );
  };

  const renderScheduledRide = useCallback(
    ({ item }) => {
      const rideId = item.id || item._id;
      const scheduledTime = item.scheduledTime || item.scheduledAt;
      const status = item.status || 'scheduled';

      return (
        <View style={styles.scheduledRideCard}>
          <View style={styles.scheduledRideHeader}>
            <Text style={styles.scheduledRideDate}>
              {formatDate(scheduledTime)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                status === 'cancelled' && styles.statusBadgeCancelled,
                status === 'completed' && styles.statusBadgeCompleted,
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  status === 'cancelled' && styles.statusBadgeTextCancelled,
                  status === 'completed' && styles.statusBadgeTextCompleted,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.scheduledRideRoute}>
            <View style={styles.routeRow}>
              <View style={styles.routeDotGreen} />
              <Text style={styles.routeAddress} numberOfLines={1}>
                {item.pickup?.address || 'Pickup'}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={styles.routeDotRed} />
              <Text style={styles.routeAddress} numberOfLines={1}>
                {item.dropoff?.address || 'Dropoff'}
              </Text>
            </View>
          </View>

          <View style={styles.scheduledRideFooter}>
            <Text style={styles.scheduledRideVehicle}>
              {item.vehicleType || 'economy'}
            </Text>
            {status === 'scheduled' && (
              <TouchableOpacity
                style={styles.cancelRideButton}
                onPress={() => handleCancelScheduledRide(rideId)}
              >
                <Text style={styles.cancelRideButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [handleCancelScheduledRide]
  );

  const upcomingRides = scheduledRides.filter(
    (r) => r.status !== 'cancelled' && r.status !== 'completed'
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Date and Time */}
      <Text style={styles.sectionTitle}>When</Text>
      <View style={styles.dateTimeRow}>
        <View style={styles.dateTimeField}>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={COLORS.textLight}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
        <View style={styles.dateTimeSpacer} />
        <View style={styles.dateTimeField}>
          <Text style={styles.fieldLabel}>Time</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            placeholderTextColor={COLORS.textLight}
            value={time}
            onChangeText={setTime}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      </View>

      {/* Pickup Address */}
      <Text style={styles.sectionTitle}>Route</Text>
      <Text style={styles.fieldLabel}>Pickup Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter pickup address"
        placeholderTextColor={COLORS.textLight}
        value={pickupAddress}
        onChangeText={setPickupAddress}
      />

      {/* Dropoff Address */}
      <Text style={styles.fieldLabel}>Dropoff Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter dropoff address"
        placeholderTextColor={COLORS.textLight}
        value={dropoffAddress}
        onChangeText={setDropoffAddress}
      />

      {/* Vehicle Type Selector */}
      <Text style={styles.sectionTitle}>Vehicle Type</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.vehicleList}
      >
        {VEHICLE_TYPES.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={[
              styles.vehicleOption,
              selectedVehicle === vehicle.id && styles.vehicleOptionSelected,
            ]}
            onPress={() => setSelectedVehicle(vehicle.id)}
          >
            <Text style={styles.vehicleIcon}>
              {vehicle.id === 'accessible'
                ? '\u267F'
                : vehicle.id === 'pool'
                  ? '\u{1F465}'
                  : '\u{1F697}'}
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

      {/* Accessibility Needs */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Accessibility Needs</Text>
          <Text style={styles.toggleSubtext}>
            Wheelchair accessible vehicle required
          </Text>
        </View>
        <Switch
          value={accessibilityNeeds}
          onValueChange={setAccessibilityNeeds}
          trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
          thumbColor={accessibilityNeeds ? COLORS.primary : COLORS.surface}
        />
      </View>

      {/* Notes */}
      <Text style={styles.fieldLabel}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Any special instructions..."
        placeholderTextColor={COLORS.textLight}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Estimated Fare */}
      {estimatedFare != null && (
        <View style={styles.fareEstimateCard}>
          <Text style={styles.fareEstimateLabel}>Estimated Fare</Text>
          <Text style={styles.fareEstimateValue}>
            {formatCurrency(estimatedFare)}
          </Text>
          <Text style={styles.fareEstimateNote}>
            Final fare may vary based on actual route and conditions
          </Text>
        </View>
      )}

      {/* Schedule Button */}
      <TouchableOpacity
        style={[styles.scheduleButton, isLoading && styles.buttonDisabled]}
        onPress={handleScheduleRide}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.textOnPrimary} />
        ) : (
          <Text style={styles.scheduleButtonText}>Schedule Ride</Text>
        )}
      </TouchableOpacity>

      {/* Upcoming Scheduled Rides */}
      {upcomingRides.length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Upcoming Scheduled Rides</Text>
          {upcomingRides.map((ride) => (
            <View key={ride.id || ride._id}>
              {renderScheduledRide({ item: ride })}
            </View>
          ))}
        </View>
      )}

      {upcomingRides.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No upcoming scheduled rides
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Schedule a ride above to get started
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 14,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateTimeField: {
    flex: 1,
  },
  dateTimeSpacer: {
    width: 12,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  toggleSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fareEstimateCard: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  fareEstimateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  fareEstimateValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fareEstimateNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  scheduleButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  scheduleButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  upcomingSection: {
    marginTop: 24,
  },
  scheduledRideCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scheduledRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduledRideDate: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeCancelled: {
    backgroundColor: COLORS.errorLight,
  },
  statusBadgeCompleted: {
    backgroundColor: COLORS.infoLight,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  statusBadgeTextCancelled: {
    color: COLORS.error,
  },
  statusBadgeTextCompleted: {
    color: COLORS.info,
  },
  scheduledRideRoute: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    marginRight: 10,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: COLORS.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  routeAddress: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  scheduledRideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduledRideVehicle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  cancelRideButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  cancelRideButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
});

export default ScheduleRideScreen;
