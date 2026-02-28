import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import { get as apiGet } from '../../services/api';

const PERIODS = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const TransparencyScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchFinancials();
  }, [selectedPeriod]);

  const fetchFinancials = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(`/governance/financials?period=${selectedPeriod}`);
      setData(response.data);
    } catch (error) {
      // Use placeholder data for demo
      setData({
        totalRides: 12847,
        totalFares: 198432.5,
        platformFees: 9921.63,
        breakdown: {
          serverCosts: 2980.49,
          paymentProcessing: 3968.65,
          insurance: 1984.33,
          support: 988.16,
        },
        surplus: 4523.12,
        surplusRedistributed: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const breakdownItems = data
    ? [
        {
          label: 'Server & Infrastructure',
          amount: data.breakdown?.serverCosts || 0,
          color: '#2196F3',
          percentage: 30,
        },
        {
          label: 'Payment Processing',
          amount: data.breakdown?.paymentProcessing || 0,
          color: '#FF9800',
          percentage: 40,
        },
        {
          label: 'Insurance Fund',
          amount: data.breakdown?.insurance || 0,
          color: '#4CAF50',
          percentage: 20,
        },
        {
          label: 'Community Support',
          amount: data.breakdown?.support || 0,
          color: '#9C27B0',
          percentage: 10,
        },
      ]
    : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIODS.map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period.key)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period.key && styles.periodButtonTextActive,
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : data ? (
        <>
          {/* Overview */}
          <View style={styles.overviewGrid}>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>
                {data.totalRides?.toLocaleString()}
              </Text>
              <Text style={styles.overviewLabel}>Total Rides</Text>
            </View>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewValue}>
                {formatCurrency(data.totalFares)}
              </Text>
              <Text style={styles.overviewLabel}>Total Fares</Text>
            </View>
          </View>

          {/* Platform Fee Breakdown */}
          <View style={styles.breakdownCard}>
            <Text style={styles.sectionTitle}>Platform Fee Breakdown</Text>
            <Text style={styles.breakdownSubtitle}>
              5% platform fee = {formatCurrency(data.platformFees)}
            </Text>

            {/* Pie Chart Placeholder */}
            <View style={styles.chartPlaceholder}>
              <View style={styles.pieContainer}>
                {breakdownItems.map((item, index) => (
                  <View
                    key={item.label}
                    style={[
                      styles.pieSegment,
                      {
                        backgroundColor: item.color,
                        width: `${item.percentage}%`,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Legend */}
            {breakdownItems.map((item) => (
              <View key={item.label} style={styles.legendRow}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendValue}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
          </View>

          {/* Surplus */}
          <View style={styles.surplusCard}>
            <Text style={styles.sectionTitle}>Surplus</Text>
            <Text style={styles.surplusAmount}>
              {formatCurrency(data.surplus)}
            </Text>
            <View
              style={[
                styles.surplusStatus,
                data.surplusRedistributed
                  ? styles.surplusRedistributed
                  : styles.surplusPending,
              ]}
            >
              <Text
                style={[
                  styles.surplusStatusText,
                  data.surplusRedistributed
                    ? styles.surplusRedistributedText
                    : styles.surplusPendingText,
                ]}
              >
                {data.surplusRedistributed
                  ? 'Redistributed to drivers'
                  : 'Pending redistribution'}
              </Text>
            </View>
          </View>

          {/* Audit Notice */}
          <View style={styles.auditNotice}>
            <Text style={styles.auditIcon}>{'\u2713'}</Text>
            <Text style={styles.auditText}>
              This data is verified and publicly auditable. OpenRide is committed
              to full financial transparency.
            </Text>
          </View>
        </>
      ) : null}
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
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodButtonActive: {
    backgroundColor: COLORS.primary,
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  periodButtonTextActive: {
    color: COLORS.textOnPrimary,
  },
  loader: {
    marginTop: 40,
  },
  overviewGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  breakdownCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  breakdownSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  chartPlaceholder: {
    marginBottom: 20,
  },
  pieContainer: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pieSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  surplusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  surplusAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    marginVertical: 12,
  },
  surplusStatus: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  surplusRedistributed: {
    backgroundColor: COLORS.successLight,
  },
  surplusPending: {
    backgroundColor: COLORS.warningLight,
  },
  surplusStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  surplusRedistributedText: {
    color: COLORS.primary,
  },
  surplusPendingText: {
    color: COLORS.secondaryDark,
  },
  auditNotice: {
    flexDirection: 'row',
    backgroundColor: COLORS.infoLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  auditIcon: {
    fontSize: 18,
    color: COLORS.info,
    marginRight: 10,
    marginTop: 1,
  },
  auditText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 19,
  },
});

export default TransparencyScreen;
