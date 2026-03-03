import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import useFeedbackStore from '../../store/feedbackStore';

const FEEDBACK_TYPES = [
  { key: 'bug', label: 'Bug Report', icon: '\u26A0' },
  { key: 'feature_request', label: 'Feature Request', icon: '\u2728' },
  { key: 'ux_feedback', label: 'UX Feedback', icon: '\u270D' },
  { key: 'general', label: 'General', icon: '\u2709' },
];

const SEVERITY_OPTIONS = [
  { key: 'critical', label: 'Critical', color: COLORS.error },
  { key: 'high', label: 'High', color: COLORS.secondary },
  { key: 'medium', label: 'Medium', color: COLORS.warning },
  { key: 'low', label: 'Low', color: COLORS.info },
];

const STATUS_COLORS = {
  new: COLORS.info,
  acknowledged: COLORS.secondary,
  in_progress: COLORS.primary,
  resolved: COLORS.success,
  wont_fix: COLORS.textSecondary,
};

const FeedbackScreen = () => {
  const [activeTab, setActiveTab] = useState('submit');
  const [type, setType] = useState('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const {
    feedbackItems,
    isLoading,
    pagination,
    submitFeedback,
    fetchMyFeedback,
    voteFeedback,
  } = useFeedbackStore();

  useEffect(() => {
    if (activeTab === 'history') {
      fetchMyFeedback(1).catch(() => {});
    }
  }, [activeTab]);

  const getDeviceInfo = () => ({
    os: Platform.OS,
    osVersion: Platform.Version,
    screenWidth: Dimensions.get('window').width,
    screenHeight: Dimensions.get('window').height,
  });

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your feedback.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Description', 'Please describe your feedback.');
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        type,
        title: title.trim(),
        description: description.trim(),
        severity: type === 'bug' ? severity : 'medium',
        platform: Platform.OS,
        device_info: getDeviceInfo(),
      });
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
      setTitle('');
      setDescription('');
      setSeverity('medium');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (id) => {
    try {
      await voteFeedback(id);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to vote.');
    }
  };

  const loadMore = () => {
    if (!isLoading && pagination.page < pagination.totalPages) {
      fetchMyFeedback(pagination.page + 1).catch(() => {});
    }
  };

  const renderSubmitForm = () => (
    <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
      {/* Feedback Type */}
      <Text style={styles.label}>What kind of feedback?</Text>
      <View style={styles.typeRow}>
        {FEEDBACK_TYPES.map((ft) => (
          <TouchableOpacity
            key={ft.key}
            style={[styles.typeChip, type === ft.key && styles.typeChipActive]}
            onPress={() => setType(ft.key)}
          >
            <Text style={styles.typeIcon}>{ft.icon}</Text>
            <Text
              style={[
                styles.typeLabel,
                type === ft.key && styles.typeLabelActive,
              ]}
            >
              {ft.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        placeholder="Brief summary..."
        placeholderTextColor={COLORS.textLight}
        value={title}
        onChangeText={setTitle}
        maxLength={255}
      />

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder={
          type === 'bug'
            ? 'Steps to reproduce, expected vs actual behavior...'
            : 'Describe your idea or feedback in detail...'
        }
        placeholderTextColor={COLORS.textLight}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      {/* Severity (bugs only) */}
      {type === 'bug' && (
        <>
          <Text style={styles.label}>Severity</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.severityChip,
                  { borderColor: s.color },
                  severity === s.key && { backgroundColor: s.color },
                ]}
                onPress={() => setSeverity(s.key)}
              >
                <Text
                  style={[
                    styles.severityLabel,
                    severity === s.key && styles.severityLabelActive,
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Device Info */}
      <View style={styles.deviceInfoCard}>
        <Text style={styles.deviceInfoTitle}>Device Info (auto-collected)</Text>
        <Text style={styles.deviceInfoText}>
          {Platform.OS} {Platform.Version} — {Dimensions.get('window').width}x
          {Dimensions.get('window').height}
        </Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.textOnPrimary} />
        ) : (
          <Text style={styles.submitBtnText}>Submit Feedback</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderFeedbackItem = ({ item }) => {
    const statusColor = STATUS_COLORS[item.status] || COLORS.textSecondary;
    const typeInfo = FEEDBACK_TYPES.find((ft) => ft.key === item.type);
    const voteCount = item.metadata?.voteCount || 0;

    return (
      <View style={styles.feedbackCard}>
        <View style={styles.feedbackHeader}>
          <Text style={styles.feedbackIcon}>{typeInfo?.icon || '\u25CF'}</Text>
          <View style={styles.feedbackHeaderText}>
            <Text style={styles.feedbackTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.feedbackMeta}>
              {typeInfo?.label} — {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>
              {(item.status || 'new').replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.feedbackDesc} numberOfLines={3}>
          {item.description}
        </Text>
        {item.adminNotes ? (
          <View style={styles.adminNotesBox}>
            <Text style={styles.adminNotesLabel}>Admin response:</Text>
            <Text style={styles.adminNotesText}>{item.adminNotes}</Text>
          </View>
        ) : null}
        {item.type === 'feature_request' && (
          <TouchableOpacity
            style={styles.voteBtn}
            onPress={() => handleVote(item.id)}
          >
            <Text style={styles.voteBtnText}>
              {'\u25B2'} {voteCount}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderHistory = () => (
    <FlatList
      data={feedbackItems}
      keyExtractor={(item) => item.id}
      renderItem={renderFeedbackItem}
      contentContainerStyle={styles.historyList}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={
        !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\u2709'}</Text>
            <Text style={styles.emptyText}>No feedback submitted yet</Text>
            <Text style={styles.emptySubtext}>
              Switch to the Submit tab to share your thoughts
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        isLoading ? (
          <ActivityIndicator style={{ padding: 20 }} color={COLORS.primary} />
        ) : null
      }
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'submit' && styles.tabActive]}
          onPress={() => setActiveTab('submit')}
        >
          <Text
            style={[styles.tabText, activeTab === 'submit' && styles.tabTextActive]}
          >
            Submit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text
            style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}
          >
            My Feedback
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'submit' ? renderSubmitForm() : renderHistory()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: 15, fontWeight: '500', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  tabContent: { flex: 1, padding: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  typeIcon: { fontSize: 14, marginRight: 6 },
  typeLabel: { fontSize: 13, color: COLORS.text },
  typeLabelActive: { color: COLORS.textOnPrimary, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  severityLabel: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  severityLabelActive: { color: COLORS.textOnPrimary, fontWeight: '700' },
  deviceInfoCard: { marginTop: 20, backgroundColor: COLORS.surfaceVariant, padding: 12, borderRadius: 8 },
  deviceInfoTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  deviceInfoText: { fontSize: 12, color: COLORS.textSecondary },
  submitBtn: { marginTop: 24, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.textOnPrimary, fontSize: 16, fontWeight: '700' },
  historyList: { padding: 16 },
  feedbackCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  feedbackHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  feedbackIcon: { fontSize: 20, marginRight: 10, marginTop: 2 },
  feedbackHeaderText: { flex: 1 },
  feedbackTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  feedbackMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  statusText: { fontSize: 10, fontWeight: '700', color: COLORS.textOnPrimary, textTransform: 'capitalize' },
  feedbackDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 10, lineHeight: 18 },
  adminNotesBox: { marginTop: 10, backgroundColor: COLORS.infoLight, padding: 10, borderRadius: 8 },
  adminNotesLabel: { fontSize: 11, fontWeight: '700', color: COLORS.info, marginBottom: 2 },
  adminNotesText: { fontSize: 13, color: COLORS.text },
  voteBtn: {
    marginTop: 10, alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1, borderColor: COLORS.border,
  },
  voteBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, opacity: 0.3, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
});

export default FeedbackScreen;
