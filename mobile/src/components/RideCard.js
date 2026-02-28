import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RIDE_STATUSES } from '../utils/constants';
import { formatCurrency, formatDate } from '../utils/formatters';

const RideCard = ({ ride }) => {
  if (!ride) return null;

  const statusConfig = Object.values(RIDE_STATUSES).find(
    (s) => s.key === ride.status
  ) || { label: ride.status || 'Unknown', color: COLORS.textSecondary };

  const pickupAddress = ride.pickup?.address || 'Pickup';
  const dropoffAddress = ride.dropoff?.address || 'Dropoff';
  const date = ride.createdAt || ride.date;
  const fare = ride.fare || ride.total;
  const driverName = ride.driver
    ? `${ride.driver.firstName || ''} ${ride.driver.lastName || ''}`.trim()
    : null;
  const passengerName = ride.passenger
    ? `${ride.passenger.firstName || ''} ${ride.passenger.lastName || ''}`.trim()
    : null;
  const personName = driverName || passengerName;

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <Text style={styles.date}>{formatDate(date)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routeIcons}>
          <View style={styles.pickupDot} />
          <View style={styles.routeLine} />
          <View style={styles.dropoffDot} />
        </View>
        <View style={styles.routeAddresses}>
          <Text style={styles.address} numberOfLines={1}>
            {pickupAddress}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {dropoffAddress}
          </Text>
        </View>
      </View>

      {/* Footer Row */}
      <View style={styles.footerRow}>
        {personName ? (
          <Text style={styles.personName}>{personName}</Text>
        ) : (
          <View />
        )}
        <Text style={styles.fare}>{formatCurrency(fare)}</Text>
      </View>

      {/* Rating */}
      {ride.rating != null && (
        <View style={styles.ratingRow}>
          <Text style={styles.ratingStars}>
            {'★'.repeat(ride.rating)}
            {'☆'.repeat(5 - ride.rating)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  routeIcons: {
    alignItems: 'center',
    marginRight: 12,
    paddingVertical: 2,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
  },
  routeAddresses: {
    flex: 1,
    justifyContent: 'space-between',
  },
  address: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  fare: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  ratingRow: {
    marginTop: 8,
  },
  ratingStars: {
    fontSize: 14,
    color: COLORS.star,
  },
});

export default RideCard;
