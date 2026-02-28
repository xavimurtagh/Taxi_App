import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { api } from '../../services/api';

export default function ElectionScreen() {
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [moderators, setModerators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNominate, setShowNominate] = useState(false);
  const [statement, setStatement] = useState('');
  const [hasVoted, setHasVoted] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [electionRes, moderatorsRes] = await Promise.all([
        api.get('/moderation/elections/active').catch(() => ({ data: { election: null } })),
        api.get('/moderation/moderators').catch(() => ({ data: { moderators: [] } })),
      ]);

      const activeElection = electionRes.data.election;
      setElection(activeElection);
      setModerators(moderatorsRes.data.moderators || []);

      if (activeElection) {
        const detailRes = await api.get(`/moderation/elections/${activeElection.id}`);
        setCandidates(detailRes.data.candidates || []);
      }
    } catch (err) {
      console.log('Failed to fetch election data:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nominate = async () => {
    if (!statement.trim() || statement.trim().length < 20) {
      Alert.alert('Error', 'Please write a statement of at least 20 characters explaining why you should be a moderator.');
      return;
    }
    try {
      await api.post(`/moderation/elections/${election.id}/nominate`, { statement: statement.trim() });
      Alert.alert('Nominated', 'Your nomination has been submitted!');
      setShowNominate(false);
      setStatement('');
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Nomination failed');
    }
  };

  const vote = async (candidateId) => {
    try {
      await api.post(`/moderation/elections/${election.id}/vote`, { candidateId });
      Alert.alert('Voted', 'Your vote has been recorded.');
      setHasVoted(true);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Vote failed');
    }
  };

  const getTimeRemaining = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  const renderCandidate = ({ item }) => (
    <View style={styles.candidateCard}>
      <View style={styles.candidateHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.firstName || '?')[0]}</Text>
        </View>
        <View style={styles.candidateInfo}>
          <Text style={styles.candidateName}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.candidateRating}>Rating: {item.ratingAvg || '5.0'} | Rides: {item.rideCount || 0}</Text>
        </View>
        {item.elected && (
          <View style={styles.electedBadge}>
            <Text style={styles.electedText}>Elected</Text>
          </View>
        )}
      </View>
      <Text style={styles.candidateStatement}>{item.statement}</Text>
      <View style={styles.candidateFooter}>
        <Text style={styles.voteCount}>{item.votesReceived || 0} votes</Text>
        {election?.status === 'voting' && !hasVoted && (
          <TouchableOpacity
            style={styles.voteBtn}
            onPress={() => Alert.alert(
              'Vote',
              `Vote for ${item.firstName}? You can only vote once.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Vote', onPress: () => vote(item.id) },
              ]
            )}
          >
            <Text style={styles.voteBtnText}>Vote</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Moderators</Text>
      <Text style={styles.subtitle}>
        Moderators are elected by the community to help maintain a safe and fair platform.
      </Text>

      {/* Active moderators */}
      {moderators.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Moderators</Text>
          {moderators.map((mod) => (
            <View key={mod.id} style={styles.modCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(mod.firstName || '?')[0]}</Text>
              </View>
              <View style={styles.modInfo}>
                <Text style={styles.modName}>{mod.firstName} {mod.lastName}</Text>
                <Text style={styles.modTerm}>
                  Term ends: {new Date(mod.termEnd).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Active election */}
      {election ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {election.status === 'nominations' ? 'Nominations Open' : 'Voting in Progress'}
          </Text>
          <View style={styles.electionCard}>
            <Text style={styles.electionTitle}>{election.title}</Text>
            {election.description && (
              <Text style={styles.electionDesc}>{election.description}</Text>
            )}
            <Text style={styles.electionMeta}>
              Seats: {election.seatsAvailable} |{' '}
              {election.status === 'nominations'
                ? `Nominations close: ${getTimeRemaining(election.nominationsEnd)}`
                : `Voting closes: ${getTimeRemaining(election.votingEnds)}`
              }
            </Text>

            {election.status === 'nominations' && (
              <TouchableOpacity
                style={styles.nominateBtn}
                onPress={() => setShowNominate(!showNominate)}
              >
                <Text style={styles.nominateBtnText}>
                  {showNominate ? 'Cancel' : 'Nominate Yourself'}
                </Text>
              </TouchableOpacity>
            )}

            {showNominate && (
              <View style={styles.nominateForm}>
                <Text style={styles.label}>Your statement</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Why should the community elect you as a moderator? What experience do you bring?"
                  value={statement}
                  onChangeText={setStatement}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.submitBtn} onPress={nominate}>
                  <Text style={styles.submitBtnText}>Submit Nomination</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>
            Candidates ({candidates.length})
          </Text>
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.id}
            renderItem={renderCandidate}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No candidates yet. Be the first to nominate!</Text>
            }
            scrollEnabled={false}
          />
        </View>
      ) : (
        <View style={styles.noElection}>
          <Text style={styles.noElectionText}>No active election</Text>
          <Text style={styles.noElectionSubtext}>
            Moderator elections are held periodically. Check back soon!
          </Text>
        </View>
      )}

      {refreshing && <ActivityIndicator style={{ marginTop: 10 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 20, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  modCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modInfo: { flex: 1 },
  modName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  modTerm: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  electionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  electionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  electionDesc: { fontSize: 14, color: COLORS.textLight, marginBottom: 8, lineHeight: 20 },
  electionMeta: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  nominateBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  nominateBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  nominateForm: { marginTop: 12 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  textArea: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 14, height: 100, backgroundColor: '#fafafa' },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  candidateCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  candidateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  candidateInfo: { flex: 1, marginLeft: 0 },
  candidateName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  candidateRating: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  candidateStatement: { fontSize: 14, color: COLORS.text, lineHeight: 20, marginBottom: 10 },
  candidateFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  voteCount: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  voteBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  voteBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  electedBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  electedText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  noElection: { alignItems: 'center', paddingVertical: 40 },
  noElectionText: { fontSize: 16, fontWeight: '600', color: COLORS.textLight },
  noElectionSubtext: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 8 },
  emptyText: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', paddingVertical: 20 },
});
