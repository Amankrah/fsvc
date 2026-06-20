import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';
import { UserNotification, NotificationsResponse } from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface NotificationBellProps {
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToInvitation?: (projectId: string, notificationId: string) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigateToProject, onNavigateToInvitation }) => {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showReadSection, setShowReadSection] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response: NotificationsResponse = await apiService.getNotifications();
      setNotifications(response.notifications || []);
      setUnreadCount(response.unread_count || 0);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Auto-expand read section when there are no unread notifications
  useEffect(() => {
    const hasUnread = notifications.some(n => !n.is_read);
    if (!hasUnread && notifications.length > 0) {
      setShowReadSection(true);
    }
  }, [notifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setProcessingId(notificationId);
      await apiService.markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await apiService.markAllNotificationsAsRead();
      await loadNotifications();
    } catch (error: any) {
      console.error('Error marking all as read:', error);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleViewInvitation = (notification: UserNotification) => {
    if (!notification.related_project_id) return;
    if (onNavigateToInvitation) {
      setShowPanel(false);
      onNavigateToInvitation(notification.related_project_id, notification.id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'urgent': return colors.status.error;
      case 'high': return colors.status.warning;
      case 'medium': return colors.primary.main;
      default: return colors.border.medium;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'team_invitation': return 'account-plus-outline';
      case 'project_update': return 'folder-edit-outline';
      case 'response_received': return 'clipboard-check-outline';
      default: return 'bell-outline';
    }
  };

  const renderNotificationRow = (notification: UserNotification) => {
    const isTeamInvite = notification.type === 'team_invitation';
    const isUnread = !notification.is_read;
    const isProcessing = processingId === notification.id;
    const dotColor = getPriorityDot(notification.priority);
    const typeIcon = getTypeIcon(notification.type);

    // Tapping an invite row goes straight to the invite screen instead of just marking read
    const handleRowPress = () => {
      if (isTeamInvite && !notification.is_expired) {
        handleViewInvitation(notification);
      } else if (isUnread && !isProcessing) {
        handleMarkAsRead(notification.id);
      }
    };

    return (
      <TouchableOpacity
        key={notification.id}
        style={[styles.notifRow, isUnread && styles.notifRowUnread]}
        onPress={handleRowPress}
        activeOpacity={0.75}
      >
        {/* Left accent / unread indicator */}
        <View style={[styles.notifAccent, { backgroundColor: isUnread ? dotColor : 'transparent' }]} />

        {/* Icon tile */}
        <View style={[styles.notifIconTile, { backgroundColor: dotColor + '18' }]}>
          <Icon source={typeIcon} size={18} color={dotColor} />
        </View>

        {/* Content */}
        <View style={styles.notifContent}>
          <View style={styles.notifTopRow}>
            <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.notifTime}>{formatDate(notification.created_at)}</Text>
          </View>

          <Text style={styles.notifMessage} numberOfLines={2}>
            {notification.message}
          </Text>

          {/* Priority badge */}
          {notification.priority !== 'low' && (
            <View style={styles.notifMeta}>
              <View style={[styles.priorityPill, { backgroundColor: dotColor + '18' }]}>
                <View style={[styles.priorityDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.priorityText, { color: dotColor }]}>
                  {notification.priority}
                </Text>
              </View>
            </View>
          )}

          {/* Invitation action — always visible for pending invites, read or not */}
          {isTeamInvite && !notification.is_expired && (
            <TouchableOpacity
              style={styles.viewInviteBtn}
              onPress={() => handleViewInvitation(notification)}
              activeOpacity={0.8}
            >
              <Icon source="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewInviteBtnText}>View Invitation</Text>
            </TouchableOpacity>
          )}

          {notification.is_expired && (
            <Text style={styles.expiredText}>⚠ This invitation has expired</Text>
          )}
        </View>

        {/* Processing spinner or unread dot */}
        <View style={styles.notifRight}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.primary.main} />
          ) : isUnread ? (
            <View style={[styles.unreadDot, { backgroundColor: dotColor }]} />
          ) : (
            <Icon source="check" size={14} color={colors.border.medium} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Bell button */}
      <TouchableOpacity
        style={styles.bellBtn}
        onPress={() => { setShowPanel(true); loadNotifications(); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon source="bell-outline" size={22} color={colors.text.secondary} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Notification panel — bottom sheet */}
      <Modal
        visible={showPanel}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPanel(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPanel(false)} />
          <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Panel header */}
            <View style={styles.panelHeader}>
              <View style={styles.panelTitleRow}>
                <View style={styles.panelTitleAccent} />
                <Text style={styles.panelTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.panelActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllBtn}
                    onPress={handleMarkAllAsRead}
                    disabled={markingAll}
                    activeOpacity={0.75}
                  >
                    {markingAll ? (
                      <ActivityIndicator size="small" color={colors.primary.main} />
                    ) : (
                      <Text style={styles.markAllText}>Mark all read</Text>
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowPanel(false)}
                  style={styles.closeBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon source="close" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Body */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <Text style={styles.loadingText}>Loading notifications…</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconTile}>
                  <Icon source="bell-outline" size={32} color={colors.border.medium} />
                </View>
                <Text style={styles.emptyTitle}>All caught up</Text>
                <Text style={styles.emptySubtext}>
                  You'll be notified here for project invitations and updates
                </Text>
              </View>
            ) : (() => {
              const unread = notifications.filter(n => !n.is_read);
              const read = notifications.filter(n => n.is_read);
              return (
                <ScrollView
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* ── Unread section ── */}
                  {unread.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <View style={styles.sectionDot} />
                        <Text style={styles.sectionTitle}>UNREAD</Text>
                        <View style={styles.sectionBadge}>
                          <Text style={styles.sectionBadgeText}>{unread.length}</Text>
                        </View>
                      </View>
                      {unread.map(renderNotificationRow)}
                    </>
                  )}

                  {/* ── Read section ── */}
                  {read.length > 0 && (
                    <>
                      <TouchableOpacity
                        style={styles.sectionHeader}
                        onPress={() => setShowReadSection(prev => !prev)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.sectionDot, styles.sectionDotRead]} />
                        <Text style={[styles.sectionTitle, styles.sectionTitleRead]}>READ</Text>
                        <View style={[styles.sectionBadge, styles.sectionBadgeRead]}>
                          <Text style={[styles.sectionBadgeText, styles.sectionBadgeTextRead]}>{read.length}</Text>
                        </View>
                        <View style={styles.sectionChevron}>
                          <Icon
                            source={showReadSection ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.text.tertiary}
                          />
                        </View>
                      </TouchableOpacity>
                      {showReadSection && read.map(renderNotificationRow)}
                    </>
                  )}

                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // ── Bell button
  bellBtn: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 9,
    color: '#fff',
    lineHeight: 13,
  },

  // ── Modal
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 61, 43, 0.5)',
  },
  panel: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    height: SCREEN_HEIGHT * 0.80,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.medium,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // ── Panel header
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelTitleAccent: {
    width: 4,
    height: 22,
    backgroundColor: colors.primary.main,
    borderRadius: 2,
  },
  panelTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  unreadBadge: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.round,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: '#fff',
  },
  panelActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  markAllBtn: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    minWidth: 36,
    alignItems: 'center',
  },
  markAllText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },
  closeBtn: {
    padding: 2,
  },

  // ── List
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },

  // ── Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.background.subtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
  },
  sectionDotRead: {
    backgroundColor: colors.border.medium,
  },
  sectionTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.primary.main,
    flex: 1,
  },
  sectionTitleRead: {
    color: colors.text.tertiary,
  },
  sectionBadge: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.round,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  sectionBadgeRead: {
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  sectionBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: '#fff',
  },
  sectionBadgeTextRead: {
    color: colors.text.tertiary,
  },
  sectionChevron: {
    marginLeft: spacing.xs,
  },

  // ── Notification row
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.paper,
  },
  notifRowUnread: {
    backgroundColor: colors.primary.surface + '60',
  },
  notifAccent: {
    width: 3,
    alignSelf: 'stretch',
    marginRight: spacing.sm,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  notifIconTile: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: 3,
  },
  notifTitle: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  notifTitleUnread: {
    fontFamily: 'DMSans-Bold',
    color: colors.text.primary,
  },
  notifTime: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flexShrink: 0,
  },
  notifMessage: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  notifMeta: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  priorityText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  viewInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: 2,
  },
  viewInviteBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: '#fff',
  },
  expiredText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.status.warning,
    fontStyle: 'italic',
    marginTop: 2,
  },
  notifRight: {
    marginLeft: spacing.xs,
    paddingTop: 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Loading / empty
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIconTile: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },
  emptySubtext: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationBell;
