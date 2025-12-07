import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Share, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  FAB,
  Chip,
  IconButton,
  Portal,
  Dialog,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import apiService from '../services/api';
import { ResponseLink } from '../types';

const ResponseLinksScreen: React.FC = () => {
  const navigation = useNavigation();

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
      // Handle both array responses and paginated responses
      const linksData = Array.isArray(response) ? response : (response?.results || []);
      setLinks(linksData);
    } catch (error) {
      console.error('Error loading links:', error);
      Alert.alert('Error', 'Failed to load response links');
      setLinks([]); // Set empty array on error
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
        title: link.title || 'Survey Link'
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (link: ResponseLink) => {
    if (!link.is_valid) return '#f44336';
    if (link.statistics.days_until_expiration <= 1) return '#ff9800';
    return '#4caf50';
  };

  const getStatusText = (link: ResponseLink) => {
    if (!link.is_active) return 'Inactive';
    if (link.is_expired) return 'Expired';
    if (link.response_count >= link.max_responses && link.max_responses > 0) return 'Full';
    return 'Active';
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>Loading links...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          iconColor="#ffffff"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.headerContent}>
          <Text variant="headlineMedium" style={styles.title}>Response Links</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Share surveys via web link
          </Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {links.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="headlineSmall" style={styles.emptyTitle}>No Links Yet</Text>
              <Text variant="bodyMedium" style={styles.emptyText}>
                Create shareable links to collect responses without requiring the mobile app.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          links.map((link) => (
            <Card key={link.id} style={styles.linkCard}>
              <Card.Content>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.titleSection}>
                    <Text variant="titleMedium" style={styles.linkTitle}>
                      {link.title || 'Untitled Survey'}
                    </Text>
                    <Chip
                      icon={link.is_valid ? 'check-circle' : 'alert-circle'}
                      style={[styles.statusChip, { backgroundColor: getStatusColor(link) + '20' }]}
                      textStyle={{ color: getStatusColor(link), fontSize: 11 }}
                    >
                      {getStatusText(link)}
                    </Chip>
                  </View>
                </View>

                {/* Description */}
                {link.description && (
                  <Text variant="bodyMedium" style={styles.description}>
                    {link.description}
                  </Text>
                )}

                {/* Project */}
                <Text variant="bodySmall" style={styles.projectName}>
                  Project: {link.project_name}
                </Text>

                {/* Tags for Respondent Type, Commodity, Country */}
                {(link.respondent_type_display || link.commodity_display || link.country_display) && (
                  <View style={styles.tagsContainer}>
                    {link.respondent_type_display && (
                      <Chip
                        icon="account"
                        style={styles.tag}
                        textStyle={styles.tagText}
                        compact
                      >
                        {link.respondent_type_display}
                      </Chip>
                    )}
                    {link.commodity_display && (
                      <Chip
                        icon="package-variant"
                        style={styles.tag}
                        textStyle={styles.tagText}
                        compact
                      >
                        {link.commodity_display}
                      </Chip>
                    )}
                    {link.country_display && (
                      <Chip
                        icon="map-marker"
                        style={styles.tag}
                        textStyle={styles.tagText}
                        compact
                      >
                        {link.country_display}
                      </Chip>
                    )}
                  </View>
                )}

                <Divider style={styles.divider} />

                {/* Statistics */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Responses</Text>
                    <Text variant="titleMedium" style={styles.statValue}>
                      {link.response_count}/{link.max_responses || '∞'}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Views</Text>
                    <Text variant="titleMedium" style={styles.statValue}>
                      {link.access_count}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Rate</Text>
                    <Text variant="titleMedium" style={styles.statValue}>
                      {link.statistics.response_rate.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Expires</Text>
                    <Text variant="titleMedium" style={styles.statValue}>
                      {link.statistics.days_until_expiration}d
                    </Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                {/* Timestamps */}
                <View style={styles.timestampsRow}>
                  <Text variant="bodySmall" style={styles.timestamp}>
                    Created: {formatDate(link.created_at)}
                  </Text>
                  {link.last_accessed_at && (
                    <Text variant="bodySmall" style={styles.timestamp}>
                      Last access: {formatDate(link.last_accessed_at)}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Button
                    mode="contained"
                    icon="share-variant"
                    onPress={() => handleShareLink(link)}
                    style={styles.actionButton}
                    disabled={!link.is_valid}
                  >
                    Share
                  </Button>
                  {link.is_valid && (
                    <Button
                      mode="outlined"
                      icon="clock-plus"
                      onPress={() => {
                        setSelectedLink(link);
                        setShowExtendDialog(true);
                      }}
                      style={styles.actionButton}
                    >
                      Extend
                    </Button>
                  )}
                  {link.is_active && (
                    <Button
                      mode="text"
                      icon="cancel"
                      onPress={() => handleDeactivate(link)}
                      style={styles.actionButton}
                    >
                      Deactivate
                    </Button>
                  )}
                  <IconButton
                    icon="delete"
                    iconColor="#f44336"
                    size={20}
                    onPress={() => {
                      setSelectedLink(link);
                      setShowDeleteDialog(true);
                    }}
                  />
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* FAB for creating new link */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          // Navigate to create link screen
          Alert.alert('Info', 'Create link from Data Collection or Forms screen');
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Link?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will permanently delete this response link. This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onPress={() => selectedLink && handleDelete(selectedLink)} textColor="#f44336">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Extend Dialog */}
        <Dialog visible={showExtendDialog} onDismiss={() => setShowExtendDialog(false)}>
          <Dialog.Title>Extend Expiration</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
              Extend link expiration by:
            </Text>
            <Button
              mode="outlined"
              onPress={() => selectedLink && handleExtend(selectedLink, 7)}
              style={{ marginBottom: 8 }}
            >
              7 Days
            </Button>
            <Button
              mode="outlined"
              onPress={() => selectedLink && handleExtend(selectedLink, 30)}
              style={{ marginBottom: 8 }}
            >
              30 Days
            </Button>
            <Button
              mode="outlined"
              onPress={() => selectedLink && handleExtend(selectedLink, 90)}
            >
              90 Days
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowExtendDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6200ea',
    paddingTop: 40,
    paddingBottom: 16,
    paddingHorizontal: 8,
    elevation: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  linkCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkTitle: {
    fontWeight: 'bold',
    flex: 1,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  description: {
    marginBottom: 8,
    color: '#666',
  },
  projectName: {
    color: '#666',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#e3f2fd',
  },
  tagText: {
    color: '#1976d2',
    fontSize: 11,
  },
  divider: {
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#6200ea',
  },
  timestampsRow: {
    gap: 4,
  },
  timestamp: {
    color: '#999',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 8,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  loadingText: {
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#6200ea',
  },
});

export default React.memo(ResponseLinksScreen);
