import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { api } from '../../services/api';

const DISPUTE_TYPES = [
  { id: 'safety', label: 'Safety Concern' },
  { id: 'fraud', label: 'Fraud' },
  { id: 'behavior', label: 'Inappropriate Behavior' },
  { id: 'fare', label: 'Fare Dispute' },
  { id: 'discrimination', label: 'Discrimination' },
  { id: 'damage', label: 'Property Damage' },
  { id: 'other', label: 'Other' },
];

const STATUS_COLORS = {
  submitted: '#F9A825',
  panel_assigned: '#1565C0',
  under_review: '#1565C0',
  decision_made: '#2E7D32',
  appealed: '#E65100',
  appeal_review: '#E65100',
  final: '#424242',
  closed: '#9E9E9E',
};

export default function DisputesScreen({ navigation }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);

  const [form, setForm] = useState({
    rideId: '',
    defendantId: '',
    disputeType: 'behavior',
    title: '',
    description: '',
  });

  const fetchDisputes = useCallback(async () => {
    try {
      const response = await api.get('/disputes');
      setDisputes(response.data.disputes || []);
    } catch (err) {
      console.log('Failed to fetch disputes:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const createDispute = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    try {
      await api.post('/disputes', form);
      Alert.alert('Submitted', 'Your dispute has been filed and a review panel will be assigned.');
      setShowCreate(false);
      setForm({ rideId: '', defendantId: '', disputeType: 'behavior', title: '', description: '' });
      fetchDisputes();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create dispute');
    }
  };

  const renderDispute = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelectedDispute(item)}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] || '#9E9E9E' }]}>
          <Text style={styles.badgeText}>{item.status.replace(/_/g, ' ')}</Text>
        </View>
        <Text style={styles.cardType}>{item.disputeType}</Text>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      {item.outcome && (
        <Text style={[styles.outcome, {
          color: item.outcome === 'upheld' ? '#2E7D32' : item.outcome === 'dismissed' ? '#C62828' : '#E65100'
        }]}>
          Outcome: {item.outcome}
        </Text>
      )}
      <Text style={styles.cardDate}>
        Filed {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Disputes</Text>
      <Text style={styles.subtitle}>
        Fair resolution through community peer review
      </Text>

      <FlatList
        data={disputes}
        keyExtractor={(item) => item.id}
        renderItem={renderDispute}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No disputes filed</Text>
            <Text style={styles.emptySubtext}>
              If you have an issue with a ride, you can file a dispute and
              a panel of community members will review it.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDisputes(); }} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>+ File Dispute</Text>
      </TouchableOpacity>

      {/* Create dispute modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelBtn}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>File a Dispute</Text>
            <TouchableOpacity onPress={createDispute}>
              <Text style={styles.submitBtn}>Submit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Dispute Type</Text>
          <View style={styles.typeRow}>
            {DISPUTE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeChip, form.disputeType === t.id && styles.typeChipActive]}
                onPress={() => setForm({ ...form, disputeType: t.id })}
              >
                <Text style={[styles.typeChipText, form.disputeType === t.id && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of the issue"
            value={form.title}
            onChangeText={(t) => setForm({ ...form, title: t })}
          />

          <Text style={styles.label}>Ride ID (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Paste ride ID if applicable"
            value={form.rideId}
            onChangeText={(t) => setForm({ ...form, rideId: t })}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe what happened in detail..."
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          <Text style={styles.infoText}>
            A panel of 5 verified community members will be randomly selected to review
            your dispute. All parties will have the opportunity to present evidence.
          </Text>
        </View>
      </Modal>

      {/* Dispute detail modal */}
      <Modal visible={!!selectedDispute} animationType="slide" presentationStyle="pageSheet">
        {selectedDispute && (
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedDispute(null)}>
                <Text style={styles.cancelBtn}>Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Dispute Detail</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={[styles.badge, { backgroundColor: STATUS_COLORS[selectedDispute.status], alignSelf: 'flex-start', marginBottom: 12 }]}>
              <Text style={styles.badgeText}>{selectedDispute.status.replace(/_/g, ' ')}</Text>
            </View>

            <Text style={styles.detailTitle}>{selectedDispute.title}</Text>
            <Text style={styles.detailType}>Type: {selectedDispute.disputeType}</Text>
            <Text style={styles.detailDesc}>{selectedDispute.description}</Text>

            {selectedDispute.outcome && (
              <View style={styles.outcomeBox}>
                <Text style={styles.outcomeLabel}>Decision</Text>
                <Text style={styles.outcomeValue}>{selectedDispute.outcome}</Text>
                {selectedDispute.resolution && (
                  <Text style={styles.resolution}>{selectedDispute.resolution}</Text>
                )}
              </View>
            )}

            {selectedDispute.status === 'decision_made' && (
              <TouchableOpacity
                style={styles.appealBtn}
                onPress={() => {
                  Alert.prompt?.('Appeal', 'Reason for appeal:',
                    async (reason) => {
                      try {
                        await api.post(`/disputes/${selectedDispute.id}/appeal`, { reason });
                        Alert.alert('Appealed', 'A new review panel will be assigned.');
                        setSelectedDispute(null);
                        fetchDisputes();
                      } catch (err) {
                        Alert.alert('Error', err.response?.data?.error || 'Appeal failed');
                      }
                    }
                  ) || Alert.alert('Appeal', 'Appeal functionality available on iOS');
                }}
              >
                <Text style={styles.appealBtnText}>Appeal Decision</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  cardType: { fontSize: 12, color: COLORS.textLight },
  cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.textLight, marginBottom: 8 },
  outcome: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  cardDate: { fontSize: 11, color: '#999' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textLight },
  emptySubtext: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  fab: { position: 'absolute', bottom: 24, right: 16, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modal: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  cancelBtn: { fontSize: 15, color: COLORS.textLight },
  submitBtn: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fafafa' },
  textArea: { height: 140 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f0' },
  typeChipActive: { backgroundColor: COLORS.primary },
  typeChipText: { fontSize: 13, color: COLORS.text },
  typeChipTextActive: { color: '#fff' },
  infoText: { fontSize: 12, color: '#999', marginTop: 20, lineHeight: 18, textAlign: 'center' },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  detailType: { fontSize: 13, color: COLORS.textLight, marginBottom: 12 },
  detailDesc: { fontSize: 15, color: COLORS.text, lineHeight: 22, marginBottom: 20 },
  outcomeBox: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 16 },
  outcomeLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textLight, marginBottom: 4 },
  outcomeValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, textTransform: 'capitalize' },
  resolution: { fontSize: 14, color: COLORS.text, marginTop: 8, lineHeight: 20 },
  appealBtn: { backgroundColor: '#E65100', borderRadius: 12, padding: 16, alignItems: 'center' },
  appealBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
