import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import useGovernanceStore from '../../store/governanceStore';

const CATEGORY_COLORS = {
  Operations: COLORS.info,
  Pricing: COLORS.secondary,
  Safety: COLORS.error,
  Community: COLORS.primary,
  Technology: '#9C27B0',
  Other: COLORS.textSecondary,
};

const VotingScreen = ({ route }) => {
  const proposal = route.params?.proposal;
  const {
    activeProposal,
    hasVoted,
    castVote,
    fetchResults,
    isLoading,
  } = useGovernanceStore();

  const [submitting, setSubmitting] = useState(false);

  const proposalData = activeProposal || proposal;
  const proposalId = proposalData?.id || proposalData?._id;
  const userVote = hasVoted[proposalId];

  useEffect(() => {
    if (proposalId) {
      fetchResults(proposalId).catch(() => {});
    }
  }, [proposalId]);

  const handleVote = async (vote) => {
    if (userVote) {
      Alert.alert('Already Voted', 'You have already cast your vote on this proposal.');
      return;
    }

    Alert.alert(
      'Confirm Vote',
      `Are you sure you want to vote "${vote}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await castVote(proposalId, vote);
              Alert.alert('Vote Cast', 'Your vote has been recorded.');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to cast vote.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const votesFor = proposalData?.votesFor || proposalData?.votes?.for || 0;
  const votesAgainst = proposalData?.votesAgainst || proposalData?.votes?.against || 0;
  const totalVotes = votesFor + votesAgainst;
  const forPercentage = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 50;
  const quorum = proposalData?.quorum || 100;
  const quorumProgress = totalVotes > 0 ? Math.min((totalVotes / quorum) * 100, 100) : 0;

  const getTimeRemaining = () => {
    if (!proposalData?.endsAt && !proposalData?.deadline) return 'No deadline set';
    const end = new Date(proposalData.endsAt || proposalData.deadline);
    const now = new Date();
    const diff = end - now;
    if (diff <= 0) return 'Voting ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h remaining`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  if (!proposalData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const categoryColor = CATEGORY_COLORS[proposalData.category] || COLORS.textSecondary;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Category Badge */}
      <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20' }]}>
        <Text style={[styles.categoryText, { color: categoryColor }]}>
          {proposalData.category || 'General'}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>{proposalData.title}</Text>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          By {proposalData.author?.firstName || proposalData.authorName || 'Community Member'}
        </Text>
        <Text style={styles.metaDot}>{'\u00B7'}</Text>
        <Text style={styles.metaText}>{getTimeRemaining()}</Text>
      </View>

      {/* Description */}
      <View style={styles.descriptionCard}>
        <Text style={styles.descriptionText}>
          {proposalData.description || 'No description provided.'}
        </Text>
      </View>

      {/* Vote Progress */}
      <View style={styles.voteSection}>
        <Text style={styles.sectionTitle}>Vote Results</Text>

        <View style={styles.voteBar}>
          <View
            style={[
              styles.voteBarFor,
              { width: `${forPercentage}%` },
            ]}
          />
          <View
            style={[
              styles.voteBarAgainst,
              { width: `${100 - forPercentage}%` },
            ]}
          />
        </View>

        <View style={styles.voteCountsRow}>
          <View style={styles.voteCount}>
            <View style={[styles.voteDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.voteCountLabel}>For</Text>
            <Text style={styles.voteCountValue}>{votesFor}</Text>
          </View>
          <View style={styles.voteCount}>
            <View style={[styles.voteDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.voteCountLabel}>Against</Text>
            <Text style={styles.voteCountValue}>{votesAgainst}</Text>
          </View>
        </View>
      </View>

      {/* Quorum */}
      <View style={styles.quorumSection}>
        <View style={styles.quorumHeader}>
          <Text style={styles.sectionTitle}>Quorum Progress</Text>
          <Text style={styles.quorumPercent}>{Math.round(quorumProgress)}%</Text>
        </View>
        <View style={styles.quorumBar}>
          <View
            style={[
              styles.quorumBarFill,
              { width: `${quorumProgress}%` },
            ]}
          />
        </View>
        <Text style={styles.quorumText}>
          {totalVotes} of {quorum} votes needed for quorum
        </Text>
      </View>

      {/* Vote Buttons */}
      {userVote ? (
        <View style={styles.votedContainer}>
          <Text style={styles.votedText}>
            You voted: <Text style={styles.votedValue}>{userVote}</Text>
          </Text>
        </View>
      ) : (
        <View style={styles.voteButtons}>
          <TouchableOpacity
            style={[styles.voteButton, styles.voteForButton]}
            onPress={() => handleVote('for')}
            disabled={submitting}
          >
            <Text style={styles.voteForText}>
              {submitting ? 'Submitting...' : 'Vote For'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, styles.voteAgainstButton]}
            onPress={() => handleVote('against')}
            disabled={submitting}
          >
            <Text style={styles.voteAgainstText}>Vote Against</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, styles.abstainButton]}
            onPress={() => handleVote('abstain')}
            disabled={submitting}
          >
            <Text style={styles.abstainText}>Abstain</Text>
          </TouchableOpacity>
        </View>
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
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  metaDot: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginHorizontal: 8,
  },
  descriptionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  voteSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  voteBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  voteBarFor: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  voteBarAgainst: {
    backgroundColor: COLORS.error,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  voteCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voteCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  voteCountLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  voteCountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  quorumSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  quorumHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quorumPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quorumBar: {
    height: 8,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  quorumBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  quorumText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  voteButtons: {
    gap: 12,
  },
  voteButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  voteForButton: {
    backgroundColor: COLORS.primary,
  },
  voteAgainstButton: {
    backgroundColor: COLORS.errorLight,
  },
  abstainButton: {
    backgroundColor: COLORS.surfaceVariant,
  },
  voteForText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  voteAgainstText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
  abstainText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  votedContainer: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  votedText: {
    fontSize: 16,
    color: COLORS.text,
  },
  votedValue: {
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'capitalize',
  },
});

export default VotingScreen;
