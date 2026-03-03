import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';
import useReferralStore from '../../store/referralStore';

const ReferralScreen = ({ navigation }) => {
  const [copied, setCopied] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const {
    referralCode,
    referrals,
    rewards,
    stats,
    isLoading,
    error,
    fetchReferralCode,
    applyCode,
    fetchReferrals,
    fetchRewards,
    claimReward,
    fetchStats,
    clearError,
  } = useReferralStore();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error]);

  const loadData = async () => {
    try {
      await Promise.all([
        fetchReferralCode(),
        fetchReferrals(),
        fetchRewards(),
        fetchStats(),
      ]);
    } catch (err) {
      // Individual errors are handled by the store
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await Clipboard.setStringAsync(
        typeof referralCode === 'string' ? referralCode : referralCode.code || ''
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy referral code.');
    }
  };

  const handleShare = async () => {
    const code =
      typeof referralCode === 'string'
        ? referralCode
        : referralCode?.code || '';
    if (!code) return;

    try {
      await Share.share({
        message: `Join OpenRide with my referral code: ${code}. Get a discount on your first ride!`,
        title: 'OpenRide Referral',
      });
    } catch (err) {
      // User cancelled or share failed silently
    }
  };

  const handleApplyCode = async () => {
    const code = inputCode.trim();
    if (!code) {
      Alert.alert('Missing Code', 'Please enter a referral code.');
      return;
    }

    setIsApplying(true);
    try {
      await applyCode(code);
      Alert.alert('Success', 'Referral code applied successfully!');
      setInputCode('');
      fetchStats().catch(() => {});
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to apply referral code.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClaimReward = (rewardId) => {
    Alert.alert('Claim Reward', 'Are you sure you want to claim this reward?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Claim',
        onPress: async () => {
          try {
            await claimReward(rewardId);
            Alert.alert('Success', 'Reward claimed successfully!');
            fetchStats().catch(() => {});
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to claim reward.');
          }
        },
      },
    ]);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'qualified':
      case 'rewarded':
        return { bg: COLORS.successLight, text: COLORS.success };
      case 'pending':
        return { bg: COLORS.warningLight, text: COLORS.warning };
      default:
        return { bg: COLORS.surfaceVariant, text: COLORS.textSecondary };
    }
  };

  const displayCode =
    typeof referralCode === 'string'
      ? referralCode
      : referralCode?.code || '---';

  const totalReferred = stats?.totalReferred || 0;
  const totalQualified = stats?.qualified || 0;
  const totalEarned = stats?.totalEarned || 0;

  if (isLoading && !referralCode && referrals.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading referral data...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Referral Code Card */}
      <View style={styles.codeCard}>
        <Text style={styles.codeCardTitle}>Your Referral Code</Text>
        <Text style={styles.codeText}>{displayCode}</Text>
        <Text style={styles.codeCardSubtext}>
          Share this code with friends and earn rewards
        </Text>
        <View style={styles.codeActions}>
          <TouchableOpacity
            style={[styles.codeButton, copied && styles.codeButtonCopied]}
            onPress={handleCopyCode}
          >
            <Text
              style={[
                styles.codeButtonText,
                copied && styles.codeButtonTextCopied,
              ]}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.codeButton, styles.shareButton]}
            onPress={handleShare}
          >
            <Text style={[styles.codeButtonText, styles.shareButtonText]}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Section */}
      <Text style={styles.sectionTitle}>Your Stats</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalReferred}</Text>
          <Text style={styles.statLabel}>Total Referred</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalQualified}</Text>
          <Text style={styles.statLabel}>Qualified</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.statValueEarned]}>
            {formatCurrency(totalEarned)}
          </Text>
          <Text style={styles.statLabel}>Total Earned</Text>
        </View>
      </View>

      {/* Referrals List */}
      {referrals.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your Referrals</Text>
          <View style={styles.listCard}>
            {referrals.map((referral, index) => {
              const referralId = referral.id || referral._id || index;
              const status = referral.status || 'pending';
              const badgeStyle = getStatusBadgeStyle(status);
              const name =
                referral.name ||
                referral.referredName ||
                referral.email ||
                'Anonymous';

              return (
                <View
                  key={referralId}
                  style={[
                    styles.referralItem,
                    index === referrals.length - 1 && styles.referralItemLast,
                  ]}
                >
                  <View style={styles.referralAvatar}>
                    <Text style={styles.referralAvatarText}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.referralInfo}>
                    <Text style={styles.referralName}>{name}</Text>
                    {referral.date && (
                      <Text style={styles.referralDate}>
                        Joined {referral.date}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badgeStyle.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: badgeStyle.text },
                      ]}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Rewards Section */}
      {rewards.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Available Rewards</Text>
          <View style={styles.listCard}>
            {rewards.map((reward, index) => {
              const rewardId = reward.id || reward._id || index;
              const claimed = reward.claimed || reward.redeemed;

              return (
                <View
                  key={rewardId}
                  style={[
                    styles.rewardItem,
                    index === rewards.length - 1 && styles.rewardItemLast,
                  ]}
                >
                  <View style={styles.rewardIcon}>
                    <Text style={styles.rewardIconText}>{'\u{1F381}'}</Text>
                  </View>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardTitle}>
                      {reward.title || reward.description || 'Referral Reward'}
                    </Text>
                    {reward.amount != null && (
                      <Text style={styles.rewardAmount}>
                        {formatCurrency(reward.amount)}
                      </Text>
                    )}
                  </View>
                  {claimed ? (
                    <View style={styles.claimedBadge}>
                      <Text style={styles.claimedBadgeText}>Claimed</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.claimButton}
                      onPress={() => handleClaimReward(rewardId)}
                    >
                      <Text style={styles.claimButtonText}>Claim</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {referrals.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No referrals yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Share your code above to start earning rewards
          </Text>
        </View>
      )}

      {/* Enter Referral Code */}
      <Text style={styles.sectionTitle}>Have a Referral Code?</Text>
      <View style={styles.applyCard}>
        <View style={styles.applyCodeContainer}>
          <TextInput
            style={styles.codeInput}
            placeholder="Enter referral code"
            placeholderTextColor={COLORS.textLight}
            value={inputCode}
            onChangeText={setInputCode}
            autoCapitalize="characters"
            maxLength={20}
          />
          <TouchableOpacity
            style={[
              styles.applyButton,
              (isApplying || !inputCode.trim()) && styles.applyButtonDisabled,
            ]}
            onPress={handleApplyCode}
            disabled={isApplying || !inputCode.trim()}
          >
            {isApplying ? (
              <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
            ) : (
              <Text style={styles.applyButtonText}>Apply</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  codeCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  codeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
    letterSpacing: 4,
    marginBottom: 8,
  },
  codeCardSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  codeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  codeButtonCopied: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  codeButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  codeButtonTextCopied: {
    color: COLORS.textOnPrimary,
  },
  shareButton: {
    backgroundColor: COLORS.textOnPrimary,
  },
  shareButtonText: {
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  statValueEarned: {
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  referralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  referralItemLast: {
    borderBottomWidth: 0,
  },
  referralAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  referralAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  referralInfo: {
    flex: 1,
  },
  referralName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  referralDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  rewardItemLast: {
    borderBottomWidth: 0,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardIconText: {
    fontSize: 18,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  rewardAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  claimedBadge: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  claimedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  availableBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  availableBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  claimButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  claimButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  applyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  applyCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  codeInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    marginRight: 8,
    letterSpacing: 1,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  applyButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default ReferralScreen;
