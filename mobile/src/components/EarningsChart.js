import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';

const EarningsChart = ({ data = [] }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data to display</Text>
      </View>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const maxBarHeight = 120;

  return (
    <View style={styles.container}>
      <View style={styles.barsContainer}>
        {data.map((item, index) => {
          const barHeight = Math.max(
            (item.amount / maxAmount) * maxBarHeight,
            4
          );
          const isHighest = item.amount === maxAmount;

          return (
            <View key={index} style={styles.barWrapper}>
              {/* Amount label */}
              <Text style={styles.barAmount}>
                {item.amount > 0 ? `$${Math.round(item.amount)}` : ''}
              </Text>

              {/* Bar */}
              <View style={styles.barBackground}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: isHighest
                        ? COLORS.primary
                        : COLORS.primaryLight + '80',
                    },
                  ]}
                />
              </View>

              {/* Label */}
              <Text style={styles.barLabel}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  emptyContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barAmount: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  barBackground: {
    width: '70%',
    height: 120,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    fontWeight: '500',
  },
});

export default EarningsChart;
