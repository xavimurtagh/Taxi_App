import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import useGovernanceStore from '../../store/governanceStore';
import ProposalCard from '../../components/ProposalCard';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'passed', label: 'Passed' },
  { key: 'rejected', label: 'Rejected' },
];

const CATEGORIES = ['Operations', 'Pricing', 'Safety', 'Community', 'Technology', 'Other'];

const ProposalsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Operations');

  const {
    proposals,
    fetchProposals,
    createProposal,
    setActiveProposal,
    isLoading,
  } = useGovernanceStore();

  useEffect(() => {
    fetchProposals().catch(() => {});
  }, []);

  const filteredProposals = proposals.filter((p) => {
    const status = p.status?.toLowerCase();
    if (activeTab === 'active') return status === 'active' || status === 'voting';
    if (activeTab === 'passed') return status === 'passed' || status === 'approved';
    if (activeTab === 'rejected') return status === 'rejected' || status === 'failed';
    return true;
  });

  const handleProposalPress = (proposal) => {
    setActiveProposal(proposal);
    navigation.navigate('Voting', { proposal });
  };

  const handleCreateProposal = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your proposal.');
      return;
    }
    if (!newDescription.trim()) {
      Alert.alert('Error', 'Please enter a description for your proposal.');
      return;
    }

    try {
      await createProposal({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewCategory('Operations');
      Alert.alert('Success', 'Your proposal has been created.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create proposal.');
    }
  };

  const renderProposalItem = ({ item }) => (
    <TouchableOpacity onPress={() => handleProposalPress(item)}>
      <ProposalCard proposal={item} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{'\u2696'}</Text>
      <Text style={styles.emptyTitle}>No proposals</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'active'
          ? 'No active proposals at the moment. Create one to get started!'
          : `No ${activeTab} proposals to show.`}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Proposals List */}
      {isLoading && proposals.length === 0 ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={filteredProposals}
          keyExtractor={(item) => item.id || item._id || String(Math.random())}
          renderItem={renderProposalItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshing={isLoading}
          onRefresh={fetchProposals}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Create Proposal FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create Proposal Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Proposal</Text>
            <TouchableOpacity
              onPress={handleCreateProposal}
              disabled={isLoading}
            >
              <Text style={[styles.modalSubmit, isLoading && styles.textDisabled]}>
                Submit
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.formInput}
                placeholder="What is your proposal about?"
                placeholderTextColor={COLORS.textLight}
                value={newTitle}
                onChangeText={setNewTitle}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.categoryContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      newCategory === cat && styles.categoryChipSelected,
                    ]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        newCategory === cat && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Describe your proposal in detail..."
                placeholderTextColor={COLORS.textLight}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: COLORS.successLight,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: COLORS.textOnPrimary,
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubmit: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  textDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  formTextarea: {
    minHeight: 120,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  categoryChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.successLight,
  },
  categoryChipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: COLORS.primary,
  },
});

export default ProposalsScreen;
