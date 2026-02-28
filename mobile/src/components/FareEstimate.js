import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';

const FareEstimate = ({ estimate }) => {
  if (!estimate) return null;

  const total = estimate.total || estimate.fare || 0;
  const baseFare = estimate.breakdown?.base || estimate.baseFare || 2.5;
  const distanceFare = estimate.breakdown?.distance || estimate.distanceFare || 0;
  const timeFare = estimate.breakdown?.time || estimate.timeFare || 0;
  const surge = estimate.breakdown?.surge || estimate.surge || 0;
  const platformFee = estimate.breakdown?.platformFee || total * 0.05;

  return (
    <View style={styles.container}>
      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Estimated Fare</Text>
        <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
      </View>

      {/* Breakdown */}
      <View style={styles.breakdown}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Base fare</Text>
          <Text style={styles.breakdownValue}>{formatCurrency(baseFare)}</Text>
        </View>

        {distanceFare > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Distance</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrency(distanceFare)}
            </Text>
          </View>
        )}

        {timeFare > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Time</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrency(timeFare)}
            </Text>
          </View>
        )}

        {surge > 0 && (
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, styles.surgeLabel]}>
              Surge pricing
            </Text>
            <Text style={[styles.breakdownValue, styles.surgeValue]}>
              +{formatCurrency(surge)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Platform fee info */}
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Platform fee (5%)</Text>
          <Text style={styles.breakdownValue}>
            {formatCurrency(platformFee)}
          </Text>
        </View>

        <View style={styles.driverShareRow}>
          <Text style={styles.driverShareIcon}>{'\u2713'}</Text>
          <Text style={styles.driverShareText}>95% goes to your driver</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  breakdownValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  surgeLabel: {
    color: COLORS.secondary,
  },
  surgeValue: {
    color: COLORS.secondary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  driverShareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  driverShareIcon: {
    color: COLORS.primary,
    fontSize: 12,
    marginRight: 6,
    fontWeight: '700',
  },
  driverShareText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

export default FareEstimate;
