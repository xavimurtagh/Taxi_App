import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

const CATEGORY_COLORS = {
  Operations: COLORS.info,
  Pricing: COLORS.secondary,
  Safety: COLORS.error,
  Community: COLORS.primary,
  Technology: '#9C27B0',
  Other: COLORS.textSecondary,
};

const ProposalCard = ({ proposal }) => {
  if (!proposal) return null;

  const votesFor = proposal.votesFor || proposal.votes?.for || 0;
  const votesAgainst = proposal.votesAgainst || proposal.votes?.against || 0;
  const totalVotes = votesFor + votesAgainst;
  const forPercentage = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;
  const categoryColor = CATEGORY_COLORS[proposal.category] || COLORS.textSecondary;

  const getTimeRemaining = () => {
    if (!proposal.endsAt && !proposal.deadline) return '';
    const end = new Date(proposal.endsAt || proposal.deadline);
    const now = new Date();
    const diff = end - now;
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const getStatusColor = () => {
    const status = proposal.status?.toLowerCase();
    if (status === 'passed' || status === 'approved') return COLORS.primary;
    if (status === 'rejected' || status === 'failed') return COLORS.error;
    return COLORS.info;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: categoryColor + '20' },
          ]}
        >
          <Text style={[styles.categoryText, { color: categoryColor }]}>
            {proposal.category || 'General'}
          </Text>
        </View>
        {getTimeRemaining() !== '' && (
          <Text style={styles.timeRemaining}>{getTimeRemaining()}</Text>
        )}
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {proposal.title}
      </Text>

      {/* Vote Bar */}
      <View style={styles.voteBar}>
        <View
          style={[styles.voteBarFor, { width: `${forPercentage}%` }]}
        />
        <View
          style={[styles.voteBarAgainst, { width: `${100 - forPercentage}%` }]}
        />
      </View>

      {/* Vote Counts */}
      <View style={styles.voteCountsRow}>
        <Text style={styles.voteCountFor}>
          {votesFor} for
        </Text>
        <Text style={styles.voteCountAgainst}>
          {votesAgainst} against
        </Text>
      </View>

      {/* Status */}
      {proposal.status && (
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor() },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor() },
            ]}
          >
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
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
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeRemaining: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  voteBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  voteBarFor: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  voteBarAgainst: {
    backgroundColor: COLORS.error + '60',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  voteCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  voteCountFor: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  voteCountAgainst: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProposalCard;
