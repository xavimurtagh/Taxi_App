import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';
import { formatRating, formatDuration } from '../utils/formatters';

const DriverCard = ({ driver }) => {
  if (!driver) return null;

  const initials = `${(driver.firstName || 'D')[0]}${(driver.lastName || '')[0] || ''}`;
  const vehicleInfo = driver.vehicle
    ? `${driver.vehicle.color || ''} ${driver.vehicle.make || ''} ${driver.vehicle.model || ''}`.trim()
    : null;
  const plateNumber = driver.vehicle?.plateNumber || driver.plateNumber;

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.name}>
          {driver.firstName} {driver.lastName?.[0] || ''}.
        </Text>
        <Text style={styles.rating}>{formatRating(driver.rating || 0)}</Text>
        {vehicleInfo && (
          <Text style={styles.vehicle} numberOfLines={1}>
            {vehicleInfo}
          </Text>
        )}
      </View>

      {/* Right Side: Plate + ETA */}
      <View style={styles.rightContainer}>
        {plateNumber && (
          <View style={styles.plateBadge}>
            <Text style={styles.plateText}>{plateNumber}</Text>
          </View>
        )}
        {driver.eta != null && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>{formatDuration(driver.eta)}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  rating: {
    fontSize: 13,
    color: COLORS.star,
    marginBottom: 2,
  },
  vehicle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  plateBadge: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  plateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
  },
  etaContainer: {
    alignItems: 'center',
  },
  etaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  etaLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
});

export default DriverCard;
