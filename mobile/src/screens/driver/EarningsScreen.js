import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { get as apiGet } from '../../services/api';
import EarningsChart from '../../components/EarningsChart';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

const EarningsScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [earnings, setEarnings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, [selectedPeriod]);

  const fetchEarnings = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet(`/driver/earnings?period=${selectedPeriod}`);
      const data = response.data;
      setEarnings(data.summary || data);
      setTransactions(data.transactions || []);
    } catch (error) {
      // Use placeholder data for demo
      setEarnings({
        total: 156.75,
        fares: 142.5,
        tips: 14.25,
        surplus: 3.5,
      });
      setTransactions([
        {
          id: '1',
          fare: 18.5,
          time: new Date().toISOString(),
          pickup: '123 Main St',
          dropoff: '456 Oak Ave',
        },
        {
          id: '2',
          fare: 12.0,
          time: new Date(Date.now() - 3600000).toISOString(),
          pickup: '789 Pine Rd',
          dropoff: '321 Elm St',
        },
        {
          id: '3',
          fare: 24.75,
          time: new Date(Date.now() - 7200000).toISOString(),
          pickup: 'Airport Terminal 2',
          dropoff: '555 Market St',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = [
    { label: 'Mon', amount: 45 },
    { label: 'Tue', amount: 62 },
    { label: 'Wed', amount: 38 },
    { label: 'Thu', amount: 71 },
    { label: 'Fri', amount: 89 },
    { label: 'Sat', amount: 105 },
    { label: 'Sun', amount: 56 },
  ];

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionRoute}>
          {item.pickup} {'\u2192'} {item.dropoff}
        </Text>
        <Text style={styles.transactionTime}>{formatDate(item.time)}</Text>
      </View>
      <Text style={styles.transactionFare}>{formatCurrency(item.fare)}</Text>
    </View>
  );

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
      ) : (
        <>
          {/* Total Earnings */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalAmount}>
              {formatCurrency(earnings?.total || 0)}
            </Text>
          </View>

          {/* Breakdown */}
          <View style={styles.breakdownCard}>
            <Text style={styles.sectionTitle}>Breakdown</Text>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownDot}>
                <View
                  style={[styles.dot, { backgroundColor: COLORS.primary }]}
                />
              </View>
              <Text style={styles.breakdownLabel}>Fare Earnings</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(earnings?.fares || 0)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownDot}>
                <View
                  style={[styles.dot, { backgroundColor: COLORS.secondary }]}
                />
              </View>
              <Text style={styles.breakdownLabel}>Tips</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(earnings?.tips || 0)}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownDot}>
                <View
                  style={[styles.dot, { backgroundColor: COLORS.info }]}
                />
              </View>
              <Text style={styles.breakdownLabel}>Surplus Redistribution</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(earnings?.surplus || 0)}
              </Text>
            </View>
          </View>

          {/* Chart */}
          {selectedPeriod !== 'today' && (
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>Daily Earnings</Text>
              <EarningsChart data={chartData} />
            </View>
          )}

          {/* Transactions */}
          <View style={styles.transactionsCard}>
            <Text style={styles.sectionTitle}>Recent Rides</Text>
            {transactions.length > 0 ? (
              transactions.map((item) => (
                <View key={item.id}>
                  {renderTransaction({ item })}
                </View>
              ))
            ) : (
              <Text style={styles.noTransactions}>
                No rides during this period.
              </Text>
            )}
          </View>
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
    paddingBottom: 32,
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
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  periodButtonTextActive: {
    color: COLORS.textOnPrimary,
  },
  loader: {
    marginTop: 40,
  },
  totalCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textOnPrimary,
    opacity: 0.8,
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
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
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownDot: {
    marginRight: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  transactionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionRoute: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  transactionTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  transactionFare: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  noTransactions: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default EarningsScreen;
