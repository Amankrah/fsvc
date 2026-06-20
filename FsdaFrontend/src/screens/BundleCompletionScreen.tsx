/**
 * BundleCompletionScreen
 * Shows completion statistics for question bundles (generation sets).
 * Owners can set per-member collection targets; all members see progress.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TextInput, Keyboard, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, SegmentedButtons, Portal, Dialog } from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import apiService from '../services/api';
import { showAlert } from '../utils/alert';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';

type RootStackParamList = {
  BundleCompletion: { projectId: string; projectName: string; mode?: 'project' | 'user'; isOwner?: boolean };
};

type BundleCompletionRouteProp = RouteProp<RootStackParamList, 'BundleCompletion'>;

interface MemberTarget {
  user_id: string;
  username: string;
  target_count: number;
}

interface BundleStats {
  respondent_type: string;
  commodity: string;
  country: string;
  total_questions: number;
  total_respondents: number;
  completed_respondents_count: number;
  completed_respondent_ids: string[];
  target_count: number | null;
  member_targets?: MemberTarget[];
}

interface TeamMember {
  id: string;
  user_id: string;
  username: string;
  email: string;
  role: string;
}

const bundleKey = (b: { respondent_type: string; commodity: string; country: string }) =>
  `${b.respondent_type}|${b.commodity || ''}|${b.country || ''}`;

const getTargetColor = (completed: number, target: number) => {
  const pct = target > 0 ? completed / target : 0;
  if (pct >= 1) return colors.status.success;
  if (pct >= 0.5) return colors.primary.main;
  return colors.status.warning;
};

const BundleCompletionScreen: React.FC = () => {
  const route = useRoute<BundleCompletionRouteProp>();
  const navigation = useNavigation();
  const { projectId, projectName, mode: initialMode = 'project', isOwner = false } = route.params;
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<'project' | 'user'>(initialMode);
  const [bundles, setBundles] = useState<BundleStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Team members (for owner target assignment)
  const [members, setMembers] = useState<TeamMember[]>([]);

  // Target dialog state (owner only)
  const [targetDialogVisible, setTargetDialogVisible] = useState(false);
  const [targetBundle, setTargetBundle] = useState<BundleStats | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState('');
  const [savingTarget, setSavingTarget] = useState(false);

  const loadBundleStats = async () => {
    try {
      setLoading(true);
      const data = viewMode === 'user'
        ? await apiService.getMyCollectionStats(projectId)
        : await apiService.getBundleCompletionStats(projectId);
      setBundles(data.bundles || []);
    } catch (error) {
      console.error('Error loading bundle stats:', error);
      showAlert('Error', 'Failed to load completion statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!isOwner) return;
    try {
      const data = await apiService.getProjectMembers(projectId);
      // team_members includes owner + members; extract user details
      const list: TeamMember[] = (data.team_members || []).map((m: any) => ({
        id: m.id,
        user_id: m.id,
        username: m.username,
        email: m.email || '',
        role: m.role,
      }));
      setMembers(list);
    } catch (err) {
      console.warn('Failed to load members for target assignment', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBundleStats();
    setRefreshing(false);
  };

  useEffect(() => {
    loadBundleStats();
  }, [projectId, viewMode]);

  useEffect(() => {
    loadMembers();
  }, [projectId, isOwner]);

  // ── Target dialog helpers ───────────────────────────────────────────────────

  const openTargetDialog = (bundle: BundleStats, memberId?: string, existingCount?: number) => {
    setTargetBundle(bundle);
    setSelectedMemberId(memberId || null);
    setTargetInput(existingCount ? String(existingCount) : '');
    setTargetDialogVisible(true);
  };

  const closeTargetDialog = () => {
    setTargetDialogVisible(false);
    setTargetBundle(null);
    setSelectedMemberId(null);
    setTargetInput('');
    Keyboard.dismiss();
  };

  const saveTarget = useCallback(async () => {
    if (!targetBundle || !selectedMemberId) {
      showAlert('Select Member', 'Please select a team member to assign the target to.');
      return;
    }
    const count = parseInt(targetInput, 10);
    if (isNaN(count) || count < 0) {
      showAlert('Invalid Target', 'Please enter a valid number (0 to remove).');
      return;
    }
    setSavingTarget(true);
    try {
      await apiService.updateCollectionTargets(projectId, [{
        respondent_type: targetBundle.respondent_type,
        commodity: targetBundle.commodity || '',
        country: targetBundle.country || '',
        assigned_to: selectedMemberId,
        target_count: count,
      }]);
      closeTargetDialog();
      // Reload to get fresh data
      await loadBundleStats();
    } catch (error) {
      console.error('Error saving target:', error);
      showAlert('Error', 'Failed to save target. Please try again.');
    } finally {
      setSavingTarget(false);
    }
  }, [targetInput, selectedMemberId, targetBundle, projectId]);

  // ── Summary calculations ────────────────────────────────────────────────────

  const bundlesWithTargets = bundles.filter(b => b.target_count != null && b.target_count > 0);
  const totalTarget = bundlesWithTargets.reduce((s, b) => s + (b.target_count || 0), 0);
  const totalCompleted = bundlesWithTargets.reduce((s, b) => s + b.completed_respondents_count, 0);
  const hasAnyTargets = bundlesWithTargets.length > 0;

  // ── Render bundle card ──────────────────────────────────────────────────────

  const renderBundleCard = ({ item }: { item: BundleStats }) => {
    const hasTarget = item.target_count != null && item.target_count > 0;
    const targetPct = hasTarget
      ? Math.min(100, Math.round((item.completed_respondents_count / item.target_count!) * 100))
      : null;
    const barColor = hasTarget
      ? getTargetColor(item.completed_respondents_count, item.target_count!)
      : colors.status.success;
    const completionPct = item.total_respondents > 0
      ? Math.round((item.completed_respondents_count / item.total_respondents) * 100)
      : 0;

    const memberTargets = item.member_targets || [];

    return (
      <Card style={styles.card}>
        <Card.Content>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.bundleInfo}>
              <Text variant="titleMedium" style={styles.respondentType}>
                {item.respondent_type}
              </Text>
              <View style={styles.tagsRow}>
                {item.commodity ? (
                  <Chip icon="leaf" style={styles.commodityChip} textStyle={styles.chipText}>
                    {item.commodity}
                  </Chip>
                ) : null}
                {item.country ? (
                  <Chip icon="map-marker" style={styles.countryChip} textStyle={styles.chipText}>
                    {item.country}
                  </Chip>
                ) : null}
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{item.total_questions}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.completedValue]}>
                {item.completed_respondents_count}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            {hasTarget ? (
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: barColor }]}>
                  {targetPct}%
                </Text>
                <Text style={styles.statLabel}>Of Target</Text>
              </View>
            ) : (
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{item.total_respondents}</Text>
                <Text style={styles.statLabel}>Respondents</Text>
              </View>
            )}
          </View>

          {/* Target progress bar */}
          {hasTarget && (
            <View style={{ marginTop: spacing.xs }}>
              <View style={styles.targetLabelRow}>
                <Text style={styles.targetLabelText}>
                  {item.completed_respondents_count} / {item.target_count} target
                </Text>
                {item.completed_respondents_count >= item.target_count! && (
                  <View style={styles.targetReachedBadge}>
                    <Icon source="check-circle" size={12} color={colors.status.success} />
                    <Text style={styles.targetReachedText}>Target reached</Text>
                  </View>
                )}
              </View>
              <View style={styles.completionBar}>
                <View
                  style={[
                    styles.completionFill,
                    { width: `${Math.min(100, targetPct || 0)}%`, backgroundColor: barColor },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Legacy bar (no target) */}
          {!hasTarget && item.completed_respondents_count > 0 && (
            <View style={styles.completionBar}>
              <View style={[styles.completionFill, { width: `${completionPct}%` }]} />
            </View>
          )}

          {/* Per-member target breakdown (project view) */}
          {viewMode === 'project' && memberTargets.length > 0 && (
            <View style={styles.memberTargetsSection}>
              <Text style={styles.memberTargetsTitle}>Member Targets</Text>
              {memberTargets.map((mt) => (
                <View key={mt.user_id} style={styles.memberTargetRow}>
                  <View style={styles.memberTargetInfo}>
                    <Icon source="account" size={14} color={colors.text.secondary} />
                    <Text style={styles.memberTargetName}>{mt.username}</Text>
                  </View>
                  <Text style={styles.memberTargetCount}>{mt.target_count}</Text>
                  {isOwner && (
                    <TouchableOpacity
                      onPress={() => openTargetDialog(item, mt.user_id, mt.target_count)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Icon source="pencil-outline" size={14} color={colors.primary.main} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Owner: add target button */}
          {isOwner && viewMode === 'project' && (
            <TouchableOpacity
              style={styles.addTargetBtn}
              onPress={() => openTargetDialog(item)}
            >
              <Icon source="plus-circle-outline" size={16} color={colors.primary.main} />
              <Text style={styles.addTargetText}>
                {memberTargets.length > 0 ? 'Add member target' : 'Set member target'}
              </Text>
            </TouchableOpacity>
          )}
        </Card.Content>
      </Card>
    );
  };

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.heroTitle}>Bundle Stats</Text>
          <Text style={styles.heroSubtitle}>{projectName}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading completion stats...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* Hero */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.heroNav}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="chevron-left" size={24} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>
          {viewMode === 'user' ? 'My Collection Stats' : 'Bundle Stats'}
        </Text>
        <Text style={styles.heroSubtitle}>{projectName}</Text>
      </View>

      <View style={styles.segmentedWrap}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={value => setViewMode(value as 'project' | 'user')}
          buttons={[
            { value: 'project', label: 'Project Stats', icon: 'chart-bar' },
            { value: 'user', label: 'My Stats', icon: 'account' },
          ]}
        />
      </View>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{bundles.length}</Text>
              <Text style={styles.summaryLabel}>Bundles</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.completedValue]}>
                {bundles.reduce((sum, b) => sum + b.completed_respondents_count, 0)}
              </Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            {hasAnyTargets ? (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: getTargetColor(totalCompleted, totalTarget) }]}>
                  {totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0}%
                </Text>
                <Text style={styles.summaryLabel}>Of Target</Text>
              </View>
            ) : (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {bundles.reduce((sum, b) => sum + b.total_questions, 0)}
                </Text>
                <Text style={styles.summaryLabel}>Questions</Text>
              </View>
            )}
          </View>
          {hasAnyTargets && (
            <View style={styles.summaryTargetRow}>
              <Text style={styles.summaryTargetText}>
                {totalCompleted} / {totalTarget} total target
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Bundles List */}
      {bundles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {viewMode === 'user' ? 'No collections found' : 'No question bundles found'}
          </Text>
          <Text style={styles.emptySubtext}>
            {viewMode === 'user'
              ? 'You haven\'t collected any data yet.'
              : 'Generate questions with respondent type, commodity, and country to see completion stats'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={bundles}
          renderItem={renderBundleCard}
          keyExtractor={(item, index) => `${item.respondent_type}-${item.commodity}-${item.country}-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary.main]} />
          }
        />
      )}

      {/* ── Set Target Dialog (Owner only) ─────────────────────────────────── */}
      <Portal>
        <Dialog visible={targetDialogVisible} onDismiss={closeTargetDialog} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Set Collection Target</Dialog.Title>
          <Dialog.Content>
            {targetBundle && (
              <View style={styles.dialogBundleLabel}>
                <Text style={styles.dialogBundleText}>
                  {targetBundle.respondent_type}
                  {targetBundle.commodity ? ` \u00B7 ${targetBundle.commodity}` : ''}
                  {targetBundle.country ? ` \u00B7 ${targetBundle.country}` : ''}
                </Text>
              </View>
            )}

            {/* Member picker */}
            <Text style={styles.dialogSectionLabel}>Assign to member</Text>
            <ScrollView style={styles.memberPickerScroll} showsVerticalScrollIndicator={false}>
              {members.map((m) => {
                const isSelected = selectedMemberId === m.user_id;
                return (
                  <TouchableOpacity
                    key={m.user_id}
                    style={[styles.memberPickerItem, isSelected && styles.memberPickerItemSelected]}
                    onPress={() => setSelectedMemberId(m.user_id)}
                    activeOpacity={0.7}
                  >
                    <Icon
                      source={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                      size={20}
                      color={isSelected ? colors.primary.main : colors.text.disabled}
                    />
                    <View style={styles.memberPickerInfo}>
                      <Text style={[styles.memberPickerName, isSelected && { color: colors.primary.main }]}>
                        {m.username}
                      </Text>
                      <Text style={styles.memberPickerRole}>{m.role}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Target count input */}
            <Text style={[styles.dialogSectionLabel, { marginTop: spacing.md }]}>Target count</Text>
            <TextInput
              style={styles.dialogInput}
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="number-pad"
              placeholder="e.g. 30"
              placeholderTextColor={colors.text.disabled}
            />
            <Text style={styles.dialogHint}>Enter 0 to remove an existing target</Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.dialogCancelBtn} onPress={closeTargetDialog}>
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogSaveBtn, savingTarget && { opacity: 0.6 }]}
              onPress={saveTarget}
              disabled={savingTarget}
            >
              {savingTarget
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.dialogSaveText}>Save Target</Text>}
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontFamily: 'DMSans-Regular', marginTop: spacing.md, color: colors.text.secondary, fontSize: typography.fontSize.sm },

  // Hero
  hero: { backgroundColor: colors.primary.dark, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  heroNav: { marginBottom: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.md, color: '#fff' },
  heroTitle: { fontFamily: 'Fraunces-Bold', fontSize: typography.fontSize.xxl, color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroSubtitle: { fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.65)' },
  segmentedWrap: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background.default },

  // Summary
  summaryCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.background.paper, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border.light, elevation: 0 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontFamily: 'Fraunces-Bold', fontSize: typography.fontSize.xxl, color: colors.text.primary, letterSpacing: -0.3 },
  summaryLabel: { fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryTargetRow: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light, alignItems: 'center' },
  summaryTargetText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.xs, color: colors.text.secondary },
  completedValue: { color: colors.status.success },

  // List
  listContent: { padding: spacing.md, paddingTop: spacing.xs, paddingBottom: 100 },

  // Card
  card: { marginBottom: spacing.md, backgroundColor: colors.background.paper, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.light, elevation: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  bundleInfo: { flex: 1 },
  respondentType: { fontFamily: 'Fraunces-Bold', color: colors.text.primary, fontSize: typography.fontSize.lg, letterSpacing: -0.2, marginBottom: spacing.xs },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  commodityChip: { backgroundColor: colors.status.successSurface, borderWidth: 1, borderColor: 'rgba(5, 150, 105, 0.3)' },
  countryChip: { backgroundColor: colors.status.infoSurface, borderWidth: 1, borderColor: 'rgba(37, 99, 235, 0.2)' },
  chipText: { fontFamily: 'DMSans-Medium', color: colors.text.secondary, fontSize: 11 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border.light },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { fontFamily: 'Fraunces-Bold', fontSize: typography.fontSize.xl, color: colors.text.primary, letterSpacing: -0.2 },
  statLabel: { fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.xs, color: colors.text.tertiary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Progress bar
  completionBar: { height: 6, backgroundColor: colors.border.light, borderRadius: 3, overflow: 'hidden', marginTop: spacing.xs },
  completionFill: { height: '100%', backgroundColor: colors.status.success, borderRadius: 3 },

  // Target label
  targetLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  targetLabelText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.xs, color: colors.text.secondary },
  targetReachedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  targetReachedText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.xs, color: colors.status.success },

  // Member targets breakdown
  memberTargetsSection: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light },
  memberTargetsTitle: { fontFamily: 'DMSans-Bold', fontSize: typography.fontSize.xs, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing.xs },
  memberTargetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: spacing.xs },
  memberTargetInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  memberTargetName: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.sm, color: colors.text.primary },
  memberTargetCount: { fontFamily: 'Fraunces-Bold', fontSize: typography.fontSize.md, color: colors.text.primary, marginRight: spacing.xs },

  // Add target button
  addTargetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.light, paddingVertical: 4 },
  addTargetText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.sm, color: colors.primary.main },

  // Dialog
  dialog: { borderRadius: borderRadius.xl, backgroundColor: colors.background.paper },
  dialogTitle: { fontFamily: 'Fraunces-Bold', fontSize: typography.fontSize.lg, color: colors.text.primary },
  dialogBundleLabel: { backgroundColor: colors.background.subtle, borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.md },
  dialogBundleText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.sm, color: colors.text.secondary },
  dialogSectionLabel: { fontFamily: 'DMSans-Bold', fontSize: typography.fontSize.xs, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing.xs },
  memberPickerScroll: { maxHeight: 200 },
  memberPickerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: borderRadius.sm },
  memberPickerItemSelected: { backgroundColor: colors.primary.surface },
  memberPickerInfo: { flex: 1 },
  memberPickerName: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.md, color: colors.text.primary },
  memberPickerRole: { fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.xs, color: colors.text.tertiary, textTransform: 'capitalize' },
  dialogInput: { height: 44, borderWidth: 1, borderColor: colors.border.default, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.md, color: colors.text.primary, backgroundColor: colors.background.subtle },
  dialogHint: { fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.xs, color: colors.text.disabled, marginTop: 4 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  dialogCancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border.default },
  dialogCancelText: { fontFamily: 'DMSans-Medium', fontSize: typography.fontSize.sm, color: colors.text.secondary },
  dialogSaveBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: borderRadius.sm, backgroundColor: colors.primary.main },
  dialogSaveText: { fontFamily: 'DMSans-Bold', fontSize: typography.fontSize.sm, color: '#fff' },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, paddingTop: 64 },
  emptyText: { fontFamily: 'Fraunces-Bold', fontSize: typography.fontSize.xl, color: colors.text.primary, letterSpacing: -0.3, marginBottom: spacing.sm, textAlign: 'center' },
  emptySubtext: { fontFamily: 'DMSans-Regular', fontSize: typography.fontSize.sm, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
});

export default BundleCompletionScreen;
