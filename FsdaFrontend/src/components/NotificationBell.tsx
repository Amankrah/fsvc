import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  IconButton,
  Badge,
  Portal,
  Dialog,
  Button,
  Card,
  Chip,
  ActivityIndicator,
  Surface,
} from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';
import { UserNotification, NotificationsResponse } from '../types';
import { colors } from '../constants/theme';

interface NotificationBellProps {
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToInvitation?: (projectId: string, notificationId: string) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigateToProject, onNavigateToInvitation }) => {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processingNotifications, setProcessingNotifications] = useState<Set<string>>(new Set());

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

    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await apiService.markNotificationAsRead(notificationId);
      await loadNotifications();
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      await loadNotifications();
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleViewInvitation = async (notification: UserNotification) => {
    if (!notification.related_project_id) return;

    // Navigate to AcceptInvitationScreen to see project details and accept/decline
    if (onNavigateToInvitation) {
      setShowDialog(false);
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
    return date.toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return colors.status.error;
      case 'high': return colors.status.warning;
      case 'medium': return colors.primary.light;
      case 'low': return colors.text.disabled;
      default: return colors.primary.light;
    }
  };

  const renderNotificationItem = (notification: UserNotification) => {
    const isProcessing = processingNotifications.has(notification.id);
    const isTeamInvitation = notification.type === 'team_invitation';

    return (
      <Card
        key={notification.id}
        style={[
          styles.notificationCard,
          notification.is_read ? styles.readCard : styles.unreadCard
        ]}
        onPress={() => !notification.is_read && handleMarkAsRead(notification.id)}
      >
        <Card.Content>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationMeta}>
              <Chip
                mode="flat"
                style={[styles.priorityChip, { backgroundColor: getPriorityColor(notification.priority) + '20' }]}
                textStyle={{ color: getPriorityColor(notification.priority) }}
                compact
              >
                {notification.priority}
              </Chip>
              <Text variant="bodySmall" style={styles.timeText}>
                {formatDate(notification.created_at)}
              </Text>
            </View>
            {!notification.is_read && <View style={styles.unreadDot} />}
          </View>

          <Text variant="titleMedium" style={styles.notificationTitle}>
            {notification.title}
          </Text>

          <Text variant="bodyMedium" style={styles.notificationMessage}>
            {notification.message}
          </Text>

          {isTeamInvitation && !notification.is_read && !notification.is_expired && (
            <View style={styles.invitationActions}>
              <Button
                mode="contained"
                onPress={() => handleViewInvitation(notification)}
                style={styles.viewInvitationButton}
                compact
                icon="eye"
              >
                View Invitation
              </Button>
            </View>
          )}

          {notification.is_expired && (
            <Text variant="bodySmall" style={styles.expiredText}>
              ⚠️ This invitation has expired
            </Text>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <>
      <View style={styles.bellContainer}>
        <IconButton
          icon="bell"
          size={24}
          iconColor={colors.text.secondary}
          onPress={() => setShowDialog(true)}
        />
        {unreadCount > 0 && (
          <Badge style={styles.badge} size={20}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </View>

      <Portal>
        <Dialog
          visible={showDialog}
          onDismiss={() => setShowDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>
            Notifications {unreadCount > 0 && `(${unreadCount} unread)`}
          </Dialog.Title>

          <Dialog.Content style={styles.dialogContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Loading notifications...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyLarge" style={styles.emptyText}>
                  No notifications yet
                </Text>
                <Text variant="bodyMedium" style={styles.emptySubtext}>
                  You'll receive notifications for project invitations and updates here
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
                {notifications.map(renderNotificationItem)}
              </ScrollView>
            )}
          </Dialog.Content>

          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setShowDialog(false)}>Close</Button>
            {unreadCount > 0 && (
              <Button onPress={handleMarkAllAsRead} mode="contained">
                Mark All Read
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.status.error,
  },
  dialog: {
    backgroundColor: colors.background.elevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
    maxHeight: '80%',
  },
  dialogTitle: {
    color: colors.text.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  dialogContent: {
    paddingHorizontal: 0,
    maxHeight: 500,
  },
  dialogActions: {
    backgroundColor: colors.background.subtle,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.text.secondary,
    marginTop: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  notificationsList: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  notificationCard: {
    marginBottom: 12,
    borderWidth: 1,
  },
  unreadCard: {
    backgroundColor: colors.primary.faint,
    borderColor: colors.border.light,
  },
  readCard: {
    backgroundColor: colors.background.subtle,
    borderColor: colors.border.light,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityChip: {
    height: 24,
  },
  timeText: {
    color: colors.text.secondary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.light,
  },
  notificationTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    color: colors.text.primary,
    marginBottom: 12,
  },
  invitationActions: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  viewInvitationButton: {
    backgroundColor: colors.primary.main,
  },
  expiredText: {
    color: colors.status.warning,
    fontStyle: 'italic',
    marginTop: 8,
  },
});

export default NotificationBell;
