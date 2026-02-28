import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency, formatDate, formatRating } from '../../utils/formatters';
import useRideStore from '../../store/rideStore';
import RideCard from '../../components/RideCard';

const RideHistoryScreen = () => {
  const { rideHistory, fetchRideHistory, isLoading } = useRideStore();
  const [selectedRide, setSelectedRide] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchRideHistory().catch(() => {});
  }, []);

  const handleRidePress = (ride) => {
    setSelectedRide(ride);
    setShowDetail(true);
  };

  const renderRideItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleRidePress(item)}>
      <RideCard ride={item} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{'\u{1F698}'}</Text>
      <Text style={styles.emptyTitle}>No rides yet</Text>
      <Text style={styles.emptySubtitle}>
        Your ride history will appear here after your first trip.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading && rideHistory.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={rideHistory}
          keyExtractor={(item) => item.id || item._id || String(Math.random())}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshing={isLoading}
          onRefresh={fetchRideHistory}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Ride Detail Modal */}
      <Modal
        visible={showDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Ride Details</Text>
            <TouchableOpacity onPress={() => setShowDetail(false)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>

          {selectedRide && (
            <View style={styles.modalContent}>
              {/* Date */}
              <Text style={styles.detailDate}>
                {formatDate(selectedRide.createdAt || selectedRide.date)}
              </Text>

              {/* Route */}
              <View style={styles.routeSection}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, styles.pickupDot]} />
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeLabel}>Pickup</Text>
                    <Text style={styles.routeAddress}>
                      {selectedRide.pickup?.address || 'Pickup location'}
                    </Text>
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, styles.dropoffDot]} />
                  <View style={styles.routeInfo}>
                    <Text style={styles.routeLabel}>Dropoff</Text>
                    <Text style={styles.routeAddress}>
                      {selectedRide.dropoff?.address || 'Dropoff location'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Fare Breakdown */}
              <View style={styles.fareSection}>
                <Text style={styles.fareSectionTitle}>Fare Breakdown</Text>

                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Base fare</Text>
                  <Text style={styles.fareValue}>
                    {formatCurrency(selectedRide.fareBreakdown?.base || 2.5)}
                  </Text>
                </View>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Distance</Text>
                  <Text style={styles.fareValue}>
                    {formatCurrency(selectedRide.fareBreakdown?.distance || 5.0)}
                  </Text>
                </View>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Time</Text>
                  <Text style={styles.fareValue}>
                    {formatCurrency(selectedRide.fareBreakdown?.time || 2.0)}
                  </Text>
                </View>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Platform fee (5%)</Text>
                  <Text style={styles.fareValue}>
                    {formatCurrency(selectedRide.fareBreakdown?.platformFee || 0.48)}
                  </Text>
                </View>
                <View style={[styles.fareLine, styles.fareTotal]}>
                  <Text style={styles.fareTotalLabel}>Total</Text>
                  <Text style={styles.fareTotalValue}>
                    {formatCurrency(selectedRide.fare || selectedRide.total || 9.98)}
                  </Text>
                </View>
              </View>

              {/* Driver Info */}
              {selectedRide.driver && (
                <View style={styles.driverSection}>
                  <Text style={styles.fareSectionTitle}>Driver</Text>
                  <View style={styles.driverRow}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>
                        {(selectedRide.driver.firstName || 'D')[0]}
                      </Text>
                    </View>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>
                        {selectedRide.driver.firstName} {selectedRide.driver.lastName}
                      </Text>
                      <Text style={styles.driverRating}>
                        {formatRating(selectedRide.driver.rating)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Rating Given */}
              {selectedRide.rating && (
                <View style={styles.ratingSection}>
                  <Text style={styles.fareSectionTitle}>Your Rating</Text>
                  <Text style={styles.ratingStars}>
                    {'★'.repeat(selectedRide.rating)}
                    {'☆'.repeat(5 - selectedRide.rating)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  detailDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  routeSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: COLORS.primary,
  },
  dropoffDot: {
    backgroundColor: COLORS.error,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  routeAddress: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '500',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 4,
  },
  fareSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  fareSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  fareLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  fareLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  fareValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  fareTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
    paddingTop: 12,
  },
  fareTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  fareTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  driverSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverRating: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  ratingSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
  },
  ratingStars: {
    fontSize: 24,
    color: COLORS.star,
  },
});

export default RideHistoryScreen;
