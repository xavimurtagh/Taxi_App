import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { get as apiGet, post } from '../../services/api';

const TABS = [
  { key: 'find', label: 'Find a Shared Ride' },
  { key: 'my', label: 'My Shared Rides' },
];

const RideSharingScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('find');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [mySharedRides, setMySharedRides] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMyRides, setIsLoadingMyRides] = useState(false);
  const [joiningRideId, setJoiningRideId] = useState(null);

  useEffect(() => {
    if (activeTab === 'my') {
      fetchMySharedRides();
    }
  }, [activeTab]);

  const fetchMySharedRides = async () => {
    setIsLoadingMyRides(true);
    try {
      const response = await apiGet('/rides/shared/my');
      const rides = response.data.rides || response.data || [];
      setMySharedRides(rides);
    } catch (err) {
      Alert.alert('Error', 'Failed to load your shared rides.');
    } finally {
      setIsLoadingMyRides(false);
    }
  };

  const handleSearch = async () => {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert('Missing info', 'Please enter both pickup and dropoff locations.');
      return;
    }

    setIsSearching(true);
    try {
      const response = await post('/rides/shared/search', {
        pickup: { address: pickupAddress.trim() },
        dropoff: { address: dropoffAddress.trim() },
      });
      const results = response.data.rides || response.data || [];
      setSearchResults(results);
      if (results.length === 0) {
        Alert.alert('No Results', 'No compatible shared rides found. Try adjusting your route.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to search for shared rides.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoinRide = async (rideId) => {
    setJoiningRideId(rideId);
    try {
      await post(`/rides/shared/${rideId}/join`);
      Alert.alert('Success', 'You have joined the shared ride!');
      // Remove from search results and refresh my rides
      setSearchResults((prev) =>
        prev.filter((r) => (r.id || r._id) !== rideId)
      );
      if (activeTab === 'my') {
        fetchMySharedRides();
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to join ride.');
    } finally {
      setJoiningRideId(null);
    }
  };

  const renderSearchResult = ({ item }) => {
    const rideId = item.id || item._id;
    const passengers = item.passengers || [];
    const maxPassengers = item.maxPassengers || 4;
    const estimatedFare = item.fareEstimate || item.fare || 0;
    const savings = item.savings || item.estimatedSavings || 0;

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideCardHeader}>
          <View style={styles.routeContainer}>
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
        </View>

        <View style={styles.rideCardDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Passengers</Text>
            <Text style={styles.detailValue}>
              {passengers.length}/{maxPassengers}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Your Fare</Text>
            <Text style={styles.detailValuePrimary}>
              {formatCurrency(estimatedFare)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>You Save</Text>
            <Text style={styles.detailValueSavings}>
              {formatCurrency(savings)}
            </Text>
          </View>
        </View>

        {item.departureTime && (
          <Text style={styles.departureTime}>
            Departing: {new Date(item.departureTime).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.joinButton,
            joiningRideId === rideId && styles.buttonDisabled,
          ]}
          onPress={() => handleJoinRide(rideId)}
          disabled={joiningRideId === rideId}
        >
          {joiningRideId === rideId ? (
            <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
          ) : (
            <Text style={styles.joinButtonText}>Join Ride</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderMyRide = ({ item }) => {
    const passengers = item.passengers || [];
    const totalFare = item.totalFare || item.fare || 0;

    return (
      <View style={styles.rideCard}>
        <View style={styles.rideCardHeader}>
          <View style={styles.routeContainer}>
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
          <View
            style={[
              styles.statusBadge,
              item.status === 'active' && styles.statusBadgeActive,
              item.status === 'completed' && styles.statusBadgeCompleted,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                item.status === 'active' && styles.statusBadgeTextActive,
                item.status === 'completed' && styles.statusBadgeTextCompleted,
              ]}
            >
              {(item.status || 'pending').charAt(0).toUpperCase() +
                (item.status || 'pending').slice(1)}
            </Text>
          </View>
        </View>

        {/* Participants */}
        <View style={styles.participantsSection}>
          <Text style={styles.participantsTitle}>
            Participants ({passengers.length})
          </Text>
          {passengers.map((passenger, index) => (
            <View key={passenger.id || passenger._id || index} style={styles.participantRow}>
              <View style={styles.participantAvatar}>
                <Text style={styles.participantAvatarText}>
                  {(passenger.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.participantName} numberOfLines={1}>
                {passenger.name || 'Passenger'}
              </Text>
              {passenger.fareShare != null && (
                <Text style={styles.participantFare}>
                  {formatCurrency(passenger.fareShare)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Fare Split Breakdown */}
        <View style={styles.fareSplitSection}>
          <View style={styles.fareSplitRow}>
            <Text style={styles.fareSplitLabel}>Total Fare</Text>
            <Text style={styles.fareSplitValue}>
              {formatCurrency(totalFare)}
            </Text>
          </View>
          <View style={styles.fareSplitRow}>
            <Text style={styles.fareSplitLabel}>Your Share</Text>
            <Text style={styles.fareSplitValuePrimary}>
              {formatCurrency(
                item.myShare ||
                  (passengers.length > 0
                    ? totalFare / passengers.length
                    : totalFare)
              )}
            </Text>
          </View>
          {item.savings > 0 && (
            <View style={styles.fareSplitRow}>
              <Text style={styles.fareSplitLabel}>You Saved</Text>
              <Text style={styles.fareSplitValueSavings}>
                {formatCurrency(item.savings)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderFindTab = () => (
    <View style={styles.tabContent}>
      {/* Search Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Route</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <View style={[styles.locationDot, styles.pickupDot]} />
            <TextInput
              style={styles.locationInput}
              placeholder="Pickup location"
              placeholderTextColor={COLORS.textLight}
              value={pickupAddress}
              onChangeText={setPickupAddress}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.inputRow}>
            <View style={[styles.locationDot, styles.dropoffDot]} />
            <TextInput
              style={styles.locationInput}
              placeholder="Dropoff location"
              placeholderTextColor={COLORS.textLight}
              value={dropoffAddress}
              onChangeText={setDropoffAddress}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.searchButton, isSearching && styles.buttonDisabled]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color={COLORS.textOnPrimary} />
          ) : (
            <Text style={styles.searchButtonText}>Search Shared Rides</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results */}
      {searchResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Available Rides ({searchResults.length})
          </Text>
          {searchResults.map((ride, index) => (
            <View key={ride.id || ride._id || index}>
              {renderSearchResult({ item: ride })}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderMyTab = () => {
    if (isLoadingMyRides) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your shared rides...</Text>
        </View>
      );
    }

    if (mySharedRides.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No shared rides yet</Text>
          <Text style={styles.emptySubtext}>
            Search and join a shared ride to get started
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            My Shared Rides ({mySharedRides.length})
          </Text>
          {mySharedRides.map((ride, index) => (
            <View key={ride.id || ride._id || index}>
              {renderMyRide({ item: ride })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Tab Selector */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'find' ? renderFindTab() : renderMyTab()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 40,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabContent: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: COLORS.primary,
  },
  dropoffDot: {
    backgroundColor: COLORS.error,
  },
  locationInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.surfaceVariant,
    marginLeft: 38,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  searchButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  rideCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  routeContainer: {
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
  routeAddress: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  rideCardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
    marginBottom: 12,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  detailValuePrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  detailValueSavings: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.success,
  },
  departureTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: COLORS.warningLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginLeft: 8,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.successLight,
  },
  statusBadgeCompleted: {
    backgroundColor: COLORS.infoLight,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.warning,
  },
  statusBadgeTextActive: {
    color: COLORS.success,
  },
  statusBadgeTextCompleted: {
    color: COLORS.info,
  },
  participantsSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
    marginBottom: 12,
  },
  participantsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  participantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  participantAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  participantName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  participantFare: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  fareSplitSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
  fareSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fareSplitLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  fareSplitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  fareSplitValuePrimary: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fareSplitValueSavings: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 4,
  },
});

export default RideSharingScreen;
