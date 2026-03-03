import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import useRidesharingStore from '../../store/ridesharingStore';

const SharedRideScreen = ({ navigation }) => {
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const {
    availableSharedRides,
    activeSharedRide,
    isLoading,
    error,
    findSharedRides,
    joinSharedRide,
    leaveSharedRide,
    requestSharedRide,
    fetchActiveSharedRide,
    clearError,
  } = useRidesharingStore();

  useEffect(() => {
    fetchActiveSharedRide().catch(() => {
      // No active shared ride, that is fine
    });
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  const handleSearch = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('Missing Info', 'Please enter both pickup and dropoff addresses.');
      return;
    }

    try {
      await findSharedRides(
        { address: pickupAddress.trim() },
        { address: dropoffAddress.trim() }
      );
      setHasSearched(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to find shared rides.');
    }
  };

  const handleJoinRide = (rideId) => {
    Alert.alert(
      'Join Shared Ride',
      'Would you like to join this shared ride and save on your fare?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join Ride',
          onPress: async () => {
            try {
              await joinSharedRide(rideId);
              Alert.alert('Success', 'You have joined the shared ride!');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to join ride.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveRide = () => {
    const rideId = activeSharedRide?.id || activeSharedRide?._id;
    if (!rideId) return;

    Alert.alert(
      'Leave Shared Ride',
      'Are you sure you want to leave this shared ride?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveSharedRide(rideId);
              Alert.alert('Left Ride', 'You have left the shared ride.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to leave ride.');
            }
          },
        },
      ]
    );
  };

  const handleRequestSharedRide = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('Missing Info', 'Please enter both pickup and dropoff addresses.');
      return;
    }

    try {
      await requestSharedRide({
        pickup: { address: pickupAddress.trim() },
        dropoff: { address: dropoffAddress.trim() },
        vehicleType: 'pool',
      });
      Alert.alert(
        'Ride Requested',
        'Your shared ride request has been submitted. We will match you with other riders going your way.'
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to request shared ride.');
    }
  };

  const renderAvailableRide = ({ item }) => {
    const rideId = item.id || item._id;
    const participants = item.participants || [];
    const totalSeats = item.totalSeats || 4;
    const availableSeats = item.availableSeats || totalSeats - participants.length;
    const regularFare = item.regularFare || item.estimatedFare || 15;
    const sharedFare = item.sharedFare || regularFare * 0.7;
    const savings = regularFare - sharedFare;

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideCardHeader}>
          <View style={styles.rideRouteInfo}>
            <View style={styles.routeRow}>
              <View style={styles.routeDotGreen} />
              <Text style={styles.routeText} numberOfLines={1}>
                {item.pickup?.address || 'Pickup'}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={styles.routeDotRed} />
              <Text style={styles.routeText} numberOfLines={1}>
                {item.dropoff?.address || 'Dropoff'}
              </Text>
            </View>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.participantsSection}>
          <View style={styles.participantsRow}>
            {participants.map((p, i) => (
              <View key={p.id || i} style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>
                  {(p.name || 'R').charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
            {participants.length === 0 && (
              <Text style={styles.noParticipantsText}>No riders yet</Text>
            )}
          </View>
          <Text style={styles.seatsText}>
            {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
          </Text>
        </View>

        {/* Fare Info */}
        <View style={styles.fareSection}>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Regular fare</Text>
            <Text style={styles.fareRegular}>{formatCurrency(regularFare)}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Shared fare</Text>
            <Text style={styles.fareShared}>{formatCurrency(sharedFare)}</Text>
          </View>
          <View style={styles.savingsRow}>
            <Text style={styles.savingsText}>
              You save {formatCurrency(savings)}
            </Text>
          </View>
        </View>

        {/* Join Button */}
        <TouchableOpacity
          style={[styles.joinButton, isLoading && styles.buttonDisabled]}
          onPress={() => handleJoinRide(rideId)}
          disabled={isLoading || availableSeats === 0}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.joinButtonText}>
              {availableSeats === 0 ? 'Full' : 'Join Ride'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Active shared ride view
  if (activeSharedRide) {
    const participants = activeSharedRide.participants || [];
    const status = activeSharedRide.status || 'active';

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.activeRideCard}>
          <View style={styles.activeRideHeader}>
            <Text style={styles.activeRideTitle}>Your Shared Ride</Text>
            <View style={styles.activeStatusBadge}>
              <Text style={styles.activeStatusText}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Route */}
          <View style={styles.activeRouteSection}>
            <View style={styles.routeRow}>
              <View style={styles.routeDotGreen} />
              <Text style={styles.routeText} numberOfLines={1}>
                {activeSharedRide.pickup?.address || 'Pickup'}
              </Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={styles.routeDotRed} />
              <Text style={styles.routeText} numberOfLines={1}>
                {activeSharedRide.dropoff?.address || 'Dropoff'}
              </Text>
            </View>
          </View>

          {/* Participants */}
          <Text style={styles.participantsTitle}>Riders</Text>
          {participants.map((participant, index) => (
            <View key={participant.id || index} style={styles.participantDetail}>
              <View style={styles.participantDetailAvatar}>
                <Text style={styles.participantDetailAvatarText}>
                  {(participant.name || 'R').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.participantDetailInfo}>
                <Text style={styles.participantDetailName}>
                  {participant.name || `Rider ${index + 1}`}
                </Text>
                {participant.pickup?.address && (
                  <Text style={styles.participantDetailRoute} numberOfLines={1}>
                    {participant.pickup.address}
                  </Text>
                )}
              </View>
            </View>
          ))}

          {/* Fare */}
          {activeSharedRide.sharedFare != null && (
            <View style={styles.activeFareSection}>
              <Text style={styles.activeFareLabel}>Your Share</Text>
              <Text style={styles.activeFareValue}>
                {formatCurrency(activeSharedRide.sharedFare)}
              </Text>
              {activeSharedRide.regularFare != null && (
                <Text style={styles.activeSavings}>
                  Saving{' '}
                  {formatCurrency(
                    activeSharedRide.regularFare - activeSharedRide.sharedFare
                  )}
                </Text>
              )}
            </View>
          )}

          {/* Leave Ride */}
          {status !== 'completed' && status !== 'cancelled' && (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveRide}
              disabled={isLoading}
            >
              <Text style={styles.leaveButtonText}>Leave Shared Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Shared Ride Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerTitle}>Share your ride, save money</Text>
        <Text style={styles.infoBannerText}>
          Pool rides cost up to 30% less by sharing with riders going your way.
        </Text>
      </View>

      {/* Route Input */}
      <Text style={styles.sectionTitle}>Your Route</Text>
      <TextInput
        style={styles.input}
        placeholder="Pickup address"
        placeholderTextColor={COLORS.textLight}
        value={pickupAddress}
        onChangeText={setPickupAddress}
      />
      <TextInput
        style={styles.input}
        placeholder="Dropoff address"
        placeholderTextColor={COLORS.textLight}
        value={dropoffAddress}
        onChangeText={setDropoffAddress}
      />

      {/* Search and Request Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.searchButton, isLoading && styles.buttonDisabled]}
          onPress={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.searchButtonText}>Find Rides</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.requestButton, isLoading && styles.buttonDisabled]}
          onPress={handleRequestSharedRide}
          disabled={isLoading}
        >
          <Text style={styles.requestButtonText}>Request New</Text>
        </TouchableOpacity>
      </View>

      {/* Available Shared Rides */}
      {hasSearched && (
        <>
          <Text style={styles.sectionTitle}>
            Available Rides ({availableSharedRides.length})
          </Text>

          {availableSharedRides.length > 0 ? (
            availableSharedRides.map((ride) => (
              <View key={ride.id || ride._id}>
                {renderAvailableRide({ item: ride })}
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No shared rides available
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Try requesting a new shared ride and we will match you with
                other riders
              </Text>
            </View>
          )}
        </>
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
  infoBanner: {
    backgroundColor: COLORS.infoLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.info,
  },
  infoBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.info,
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  searchButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  requestButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  requestButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  rideCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rideCardHeader: {
    marginBottom: 12,
  },
  rideRouteInfo: {
    flex: 1,
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
  routeText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  participantsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  participantAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  noParticipantsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  seatsText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  fareSection: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fareLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  fareRegular: {
    fontSize: 14,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  fareShared: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  savingsRow: {
    marginTop: 4,
    backgroundColor: COLORS.successLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  joinButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  // Active shared ride styles
  activeRideCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  activeRideTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  activeStatusBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  activeStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.success,
  },
  activeRouteSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  participantsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  participantDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  participantDetailAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  participantDetailAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  participantDetailInfo: {
    flex: 1,
  },
  participantDetailName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  participantDetailRoute: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  activeFareSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
  activeFareLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  activeFareValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },
  activeSavings: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginTop: 4,
  },
  leaveButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  leaveButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '600',
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
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

export default SharedRideScreen;
