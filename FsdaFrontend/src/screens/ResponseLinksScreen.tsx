import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Share,
  Alert,
  TouchableOpacity,
  Text,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import apiService from '../services/api';
import { ResponseLink } from '../types';
import { colors, typography, borderRadius, spacing } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const ResponseLinksScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [links, setLinks] = useState<ResponseLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLink, setSelectedLink] = useState<ResponseLink | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getResponseLinks();
      const linksData = Array.isArray(response) ? response : (response?.results || []);
      setLinks(linksData);
    } catch (error) {
      console.error('Error loading links:', error);
      Alert.alert('Error', 'Failed to load response links');
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLinks();
    setRefreshing(false);
  }, [loadLinks]);

  const handleShareLink = async (link: ResponseLink) => {
    try {
      await Share.share({
        message: `${link.title || 'Survey'}\n\n${link.description || 'Please complete this survey'}\n\n${link.share_url}`,
        url: link.share_url,
        title: link.title || 'Survey Link',
      });
    } catch (error) {
      console.error('Error sharing link:', error);
    }
  };

  const handleDeactivate = async (link: ResponseLink) => {
    try {
      await apiService.deactivateResponseLink(link.id);
      Alert.alert('Success', 'Link deactivated successfully');
      loadLinks();
    } catch (error) {
      console.error('Error deactivating link:', error);
      Alert.alert('Error', 'Failed to deactivate link');
    }
  };

  const handleExtend = async (link: ResponseLink, days: number) => {
    try {
      await apiService.extendResponseLink(link.id, days);
      Alert.alert('Success', `Link extended by ${days} days`);
      setShowExtendDialog(false);
      loadLinks();
    } catch (error) {
      console.error('Error extending link:', error);
      Alert.alert('Error', 'Failed to extend link expiration');
    }
  };

  const handleDelete = async (link: ResponseLink) => {
    try {
      await apiService.deleteResponseLink(link.id);
      Alert.alert('Success', 'Link deleted successfully');
      setShowDeleteDialog(false);
      loadLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      Alert.alert('Error', 'Failed to delete link');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (link: ResponseLink) => {
    if (!link.is_valid) return colors.status.error;
    if (link.statistics.days_until_expiration <= 1) return colors.status.warning;
    return colors.status.success;
  };

  const getStatusText = (link: ResponseLink) => {
    if (!link.is_active) return 'Inactive';
    if (link.is_expired) return 'Expired';
    if (link.response_count >= link.max_responses && link.max_responses > 0) return 'Full';
    return 'Active';
  };

  const getAccentColor = (link: ResponseLink) => {
    if (!link.is_valid) return colors.status.error;
    if (link.statistics.days_until_expiration <= 1) return colors.status.warning;
    return colors.primary.main;
  };

  // ── Totals for hero pills ──────────────────────────────────────────────────
  const totalViews = links.reduce((s, l) => s + (l.access_count || 0), 0);
  const totalResponses = links.reduce((s, l) => s + (l.response_count || 0), 0);
  const activeCount = links.filter((l) => l.is_valid).length;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Icon source="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerMeta}>
              <Text style={styles.headerTitle}>Web Links</Text>
              <Text style={styles.headerSub}>Share surveys via public URL</Text>
            </View>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading links…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* ── Hero header ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Icon source="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle}>Web Links</Text>
            <Text style={styles.headerSub}>Share surveys via public URL</Text>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Icon source="refresh" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        {/* Stat pills */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillValue}>{activeCount}</Text>
            <Text style={styles.pillLabel}>ACTIVE</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillValue}>{totalViews}</Text>
            <Text style={styles.pillLabel}>VIEWS</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillValue}>{totalResponses}</Text>
            <Text style={styles.pillLabel}>RESPONSES</Text>
          </View>
        </View>
      </View>

      {/* ── List ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary.main]} />}
        showsVerticalScrollIndicator={false}
      >
        {links.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon source="link-variant" size={44} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Links Yet</Text>
            <Text style={styles.emptyBody}>
              Create shareable links to collect responses without requiring the mobile app.
            </Text>
          </View>
        ) : (
          links.map((link) => {
            const accent = getAccentColor(link);
            const statusText = getStatusText(link);
            const statusColor = getStatusColor(link);
            const isExpiredOrInactive = !link.is_valid;

            return (
              <View key={link.id} style={styles.card}>
                {/* Left accent bar */}
                <View style={[styles.accentBar, { backgroundColor: accent }]} />

                <View style={styles.cardBody}>
                  {/* Title row */}
                  <View style={styles.titleRow}>
                    <View style={styles.titleMeta}>
                      <Text style={styles.linkTitle} numberOfLines={1}>
                        {link.title || 'Untitled Survey'}
                      </Text>
                      <Text style={styles.projectName} numberOfLines={1}>
                        {link.project_name}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                  </View>

                  {/* Description */}
                  {link.description ? (
                    <Text style={styles.description} numberOfLines={2}>{link.description}</Text>
                  ) : null}

                  {/* Tag chips */}
                  {(link.respondent_type_display || link.commodity_display || link.country_display) && (
                    <View style={styles.tagRow}>
                      {link.respondent_type_display ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>👤 {link.respondent_type_display}</Text>
                        </View>
                      ) : null}
                      {link.commodity_display ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>📦 {link.commodity_display}</Text>
                        </View>
                      ) : null}
                      {link.country_display ? (
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>📍 {link.country_display}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Stats row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={[styles.statValue, { color: accent }]}>
                        {link.response_count}/{link.remaining_responses === null ? '∞' : link.max_responses}
                      </Text>
                      <Text style={styles.statLabel}>RESPONSES</Text>
                    </View>
                    <View style={[styles.statItem, styles.statBorder]}>
                      <Text style={styles.statValue}>{link.access_count}</Text>
                      <Text style={styles.statLabel}>VIEWS</Text>
                    </View>
                    <View style={[styles.statItem, styles.statBorder]}>
                      <Text style={styles.statValue}>
                        {link.statistics.response_rate.toFixed(0)}%
                      </Text>
                      <Text style={styles.statLabel}>RATE</Text>
                    </View>
                    <View style={[styles.statItem, styles.statBorder]}>
                      <Text style={[
                        styles.statValue,
                        link.statistics.days_until_expiration <= 3 && { color: colors.status.warning },
                        link.statistics.days_until_expiration <= 0 && { color: colors.status.error },
                      ]}>
                        {link.statistics.days_until_expiration}d
                      </Text>
                      <Text style={styles.statLabel}>LEFT</Text>
                    </View>
                  </View>

                  {/* Dates */}
                  <Text style={styles.dateText}>Created {formatDate(link.created_at)}</Text>

                  {/* Action buttons */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtnPrimary, isExpiredOrInactive && styles.actionBtnDisabled]}
                      onPress={() => handleShareLink(link)}
                      disabled={isExpiredOrInactive}
                      activeOpacity={0.8}
                    >
                      <Icon source="share-variant" size={14} color="#fff" />
                      <Text style={styles.actionBtnPrimaryText}>Share</Text>
                    </TouchableOpacity>

                    {link.is_valid ? (
                      <TouchableOpacity
                        style={styles.actionBtnOutlined}
                        onPress={() => { setSelectedLink(link); setShowExtendDialog(true); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionBtnOutlinedText}>Extend</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.actionBtnGreen}
                        onPress={() => { setSelectedLink(link); setShowExtendDialog(true); }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionBtnGreenText}>Extend</Text>
                      </TouchableOpacity>
                    )}

                    {link.is_active ? (
                      <TouchableOpacity
                        style={styles.actionBtnGhost}
                        onPress={() => handleDeactivate(link)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionBtnGhostText}>Deactivate</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => { setSelectedLink(link); setShowDeleteDialog(true); }}
                      activeOpacity={0.7}
                    >
                      <Icon source="delete" size={17} color={colors.status.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => Alert.alert('Info', 'Create a link from the Data Collection or Forms screen')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* ── Delete confirmation modal ── */}
      <Modal
        visible={showDeleteDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Delete Link?</Text>
            <Text style={styles.dialogBody}>
              This will permanently delete this response link. This action cannot be undone.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setShowDeleteDialog(false)} activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogDestructive}
                onPress={() => selectedLink && handleDelete(selectedLink)}
                activeOpacity={0.8}
              >
                <Text style={styles.dialogDestructiveText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Extend modal ── */}
      <Modal
        visible={showExtendDialog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExtendDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24 }]}>
            <View style={styles.handleBar} />
            <Text style={styles.sheetTitle}>Extend Expiration</Text>
            <Text style={styles.sheetBody}>Choose how many days to extend the link:</Text>

            {[7, 30, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={styles.extendOption}
                onPress={() => selectedLink && handleExtend(selectedLink, days)}
                activeOpacity={0.7}
              >
                <View style={styles.extendOptionLeft}>
                  <Text style={styles.extendDays}>{days} Days</Text>
                  <Text style={styles.extendDesc}>
                    {days === 7 ? 'One week extension' : days === 30 ? 'One month extension' : 'Three months extension'}
                  </Text>
                </View>
                <Icon source="chevron-right" size={18} color={colors.primary.main} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.cancelSheetBtn} onPress={() => setShowExtendDialog(false)} activeOpacity={0.7}>
              <Text style={styles.cancelSheetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  pillValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 18,
    color: '#fff',
  },
  pillLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 9,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },

  // ── Loading / empty ──────────────────────────────────────────────────────
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginTop: 14,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  accentBar: {
    width: 4,
    backgroundColor: colors.primary.main,
  },
  cardBody: {
    flex: 1,
    padding: 12,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  titleMeta: {
    flex: 1,
  },
  linkTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  projectName: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
  },

  description: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 8,
    lineHeight: 18,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    color: colors.primary.main,
  },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.background.subtle,
    paddingTop: 8,
    marginBottom: 6,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statBorder: {
    borderLeftWidth: 1,
    borderLeftColor: colors.background.subtle,
  },
  statValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 9,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 1,
  },

  dateText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 10,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.background.subtle,
    paddingTop: 10,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
    gap: 5,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnPrimaryText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: 11,
    color: '#fff',
  },
  actionBtnOutlined: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  actionBtnOutlinedText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 11,
    color: colors.text.secondary,
  },
  actionBtnGreen: {
    backgroundColor: colors.primary.surface,
    borderWidth: 1,
    borderColor: colors.primary.muted,
    borderRadius: borderRadius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  actionBtnGreenText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: 11,
    color: colors.primary.main,
  },
  actionBtnGhost: {
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  actionBtnGhostText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: colors.text.secondary,
  },
  deleteBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.status.errorSurface,
    backgroundColor: colors.status.errorSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── FAB ──────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 26,
    color: '#fff',
    lineHeight: 30,
  },

  // ── Modals ────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 61, 43, 0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    padding: 24,
  },
  dialogTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginBottom: 10,
  },
  dialogBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dialogCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dialogCancelText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  dialogDestructive: {
    backgroundColor: colors.status.errorSurface,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dialogDestructiveText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.sm,
    color: colors.status.error,
  },

  // ── Extend bottom sheet ───────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.medium,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.primary.dark,
    marginBottom: 6,
  },
  sheetBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  extendOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  extendOptionLeft: {
    flex: 1,
  },
  extendDays: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  extendDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  cancelSheetBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelSheetText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
});

export default React.memo(ResponseLinksScreen);
