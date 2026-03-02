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
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => {
    if (activeTab === 'my') {
      loadMySharedRides();
    }
  }, [activeTab]);

  const loadMySharedRides = async () => {
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
        Alert.alert('No rides found', 'No compatible shared rides are available right now.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to search for shared rides.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleJoinRide = async (rideId) => {
    setJoiningId(rideId);
    try {
      await post(`/rides/shared/${rideId}/join`);
      Alert.alert('Success', 'You have joined the shared ride!');
      // Remove from search results and refresh my rides
      setSearchResults((prev) =>
        prev.filter((r) => (r.id || r._id) !== rideId)
      );
      if (activeTab === 'my') {
        loadMySharedRides();
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to join ride.');
    } finally {
      setJoiningId(null);
    }
  };

  const renderSearchResult = ({ item }) => {
    const rideId = item.id || item._id;
    const passengers = item.passengers || [];
    const maxPassengers = item.maxPassengers || 4;
    const farePerPerson = item.farePerPerson || item.fare;
    const originalFare = item.originalFare || item.estimatedFare;
    const savings = originalFare && farePerPerson
      ? originalFare - farePerPerson
      : item.savings || 0;

    return (
      <View style={styles.rideCard}>
        {/* Route */}
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

        {/* Details */}
        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Passengers</Text>
            <Text style={styles.detailValue}>
              {passengers.length}/{maxPassengers}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Your Fare</Text>
            <Text style={styles.detailValuePrimary}>
              {formatCurrency(farePerPerson)}
            </Text>
          </View>
          {savings > 0 && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>You Save</Text>
              <Text style={styles.savingsValue}>
                {formatCurrency(savings)}
              </Text>
            </View>
          )}
        </View>

        {/* Departure time if available */}
        {item.departureTime && (
          <Text style={styles.departureText}>
            Departs: {new Date(item.departureTime).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </Text>
        )}

        {/* Join Button */}
        <TouchableOpacity
          style={[styles.joinButton, joiningId === rideId && styles.buttonDisabled]}
          onPress={() => handleJoinRide(rideId)}
          disabled={joiningId === rideId}
        >
          {joiningId === rideId ? (
            <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
          ) : (
            <Text style={styles.joinButtonText}>Join Ride</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderMySharedRide = ({ item }) => {
    const rideId = item.id || item._id;
    const passengers = item.passengers || [];
    const farePerPerson = item.farePerPerson || item.fare;
    const totalFare = item.totalFare || item.fare;

    return (
      <View style={styles.rideCard}>
        {/* Route */}
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
              <Text style={styles.participantName}>
                {passenger.name || 'Passenger'}
              </Text>
              {passenger.isMe && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>You</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Fare Split Breakdown */}
        <View style={styles.fareSplitSection}>
          <Text style={styles.fareSplitTitle}>Fare Breakdown</Text>
          <View style={styles.fareSplitRow}>
            <Text style={styles.fareSplitLabel}>Total Ride Fare</Text>
            <Text style={styles.fareSplitValue}>
              {formatCurrency(totalFare)}
            </Text>
          </View>
          <View style={styles.fareSplitRow}>
            <Text style={styles.fareSplitLabel}>Split Between</Text>
            <Text style={styles.fareSplitValue}>
              {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.fareSplitDivider} />
          <View style={styles.fareSplitRow}>
            <Text style={styles.fareSplitLabelBold}>Your Share</Text>
            <Text style={styles.fareSplitValueBold}>
              {formatCurrency(farePerPerson)}
            </Text>
          </View>
        </View>

        {/* Status */}
        <View style={styles.rideStatusContainer}>
          <View
            style={[
              styles.statusBadge,
              item.status === 'in_progress' && styles.statusBadgeActive,
              item.status === 'completed' && styles.statusBadgeCompleted,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                item.status === 'in_progress' && styles.statusBadgeTextActive,
                item.status === 'completed' && styles.statusBadgeTextCompleted,
              ]}
            >
              {item.status === 'in_progress'
                ? 'In Progress'
                : item.status === 'completed'
                ? 'Completed'
                : item.status
                  ? item.status.charAt(0).toUpperCase() + item.status.slice(1)
                  : 'Active'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFindTab = () => (
    <View style={styles.tabContent}>
      {/* Search Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search for Shared Rides</Text>
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
          <View style={styles.inputDivider} />
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
            <Text style={styles.searchButtonText}>Search Rides</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Available Rides ({searchResults.length})
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
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

      {activeTab === 'find' ? (
        <FlatList
          ListHeaderComponent={renderFindTab}
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={(item, index) =>
            item.id || item._id || `result-${index}`
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !isSearching && searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  Search for shared rides near you
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  Enter your pickup and dropoff to find compatible rides
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={mySharedRides}
          renderItem={renderMySharedRide}
          keyExtractor={(item, index) =>
            item.id || item._id || `my-${index}`
          }
          contentContainerStyle={styles.listContent}
          refreshing={isLoadingMyRides}
          onRefresh={loadMySharedRides}
          ListEmptyComponent={
            !isLoadingMyRides ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No shared rides yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Join a shared ride to save on fares
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabContent: {},
  listContent: {
    paddingBottom: 40,
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
  inputDivider: {
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
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  routeContainer: {
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
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
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
  savingsValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.success,
  },
  departureText: {
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
    fontSize: 15,
    fontWeight: '700',
  },
  participantsSection: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceVariant,
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
    marginBottom: 8,
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
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
  },
  youBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  fareSplitSection: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  fareSplitTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  fareSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fareSplitLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  fareSplitValue: {
    fontSize: 13,
    color: COLORS.text,
  },
  fareSplitDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  fareSplitLabelBold: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  fareSplitValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rideStatusContainer: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.infoLight,
  },
  statusBadgeCompleted: {
    backgroundColor: COLORS.surfaceVariant,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  statusBadgeTextActive: {
    color: COLORS.info,
  },
  statusBadgeTextCompleted: {
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default RideSharingScreen;
