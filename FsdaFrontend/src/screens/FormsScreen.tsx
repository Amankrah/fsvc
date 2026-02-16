import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  IconButton,
  Searchbar,
  ActivityIndicator,
  Menu,
  Divider,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiService from '../services/api';
import { Project, Question } from '../types';
import { colors } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FormsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState<{ [key: string]: boolean }>({});
  const [ownershipFilter, setOwnershipFilter] = useState<'all' | 'owner' | 'partner'>('all');

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [])
  );

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjects();
      const projectList = Array.isArray(data) ? data : data.results || [];
      setProjects(projectList);
      setFilteredProjects(projectList);
    } catch (error: any) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(
        (project) =>
          project.name.toLowerCase().includes(query.toLowerCase()) ||
          (project.description && project.description.toLowerCase().includes(query.toLowerCase()))
      );
      setFilteredProjects(filtered);
    }
  };

  const openMenu = (projectId: string) => {
    setMenuVisible({ ...menuVisible, [projectId]: true });
  };

  const closeMenu = (projectId: string) => {
    setMenuVisible({ ...menuVisible, [projectId]: false });
  };

  const handleViewQuestions = async (projectId: string) => {
    try {
      const questions = await apiService.getQuestions(projectId);
      const questionList: Question[] = Array.isArray(questions) ? questions : questions.results || [];

      const ownerQuestions = questionList.filter(q => q.is_owner_question !== false);
      const partnerQuestions = questionList.filter(q => q.is_owner_question === false);

      const message = questionList.length > 0
        ? `Total: ${questionList.length} question${questionList.length !== 1 ? 's' : ''}\n` +
        `Owner: ${ownerQuestions.length}\n` +
        `Partner: ${partnerQuestions.length}`
        : 'This form has no questions yet';

      Alert.alert('Form Questions', message, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load questions');
    }
    closeMenu(projectId);
  };

  const handleEditForm = (project: Project) => {
    closeMenu(project.id);
    navigation.navigate('FormBuilder', {
      projectId: project.id,
      projectName: project.name,
    });
  };

  const renderProjectCard = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={styles.cardWrapper}
      activeOpacity={0.95}
      onPress={() => handleEditForm(item)}>
      <View style={styles.card}>
        <View style={styles.cardOverlay} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <Text variant="titleLarge" style={styles.projectName}>
                {item.name}
              </Text>
              <View style={styles.statusChips}>
                {item.sync_status === 'synced' && (
                  <View style={styles.syncedChip}>
                    <Text style={styles.syncedChipText}>✓ Synced</Text>
                  </View>
                )}
                {item.sync_status === 'pending' && (
                  <View style={styles.pendingChip}>
                    <Text style={styles.pendingChipText}>⏳ Pending</Text>
                  </View>
                )}
                {item.has_partners && (
                  <View style={styles.partnersChip}>
                    <Text style={styles.partnersChipText}>🤝 Partners</Text>
                  </View>
                )}
              </View>
            </View>
            <Menu
              visible={menuVisible[item.id] || false}
              onDismiss={() => closeMenu(item.id)}
              contentStyle={styles.menuContent}
              anchor={
                <TouchableOpacity
                  style={styles.menuButton}
                  onPress={() => openMenu(item.id)}>
                  <IconButton
                    icon="dots-vertical"
                    size={20}
                    iconColor={colors.text.primary}
                  />
                </TouchableOpacity>
              }>
              <Menu.Item
                leadingIcon="eye"
                onPress={() => handleViewQuestions(item.id)}
                title="View Questions"
                titleStyle={styles.menuItemText}
              />
              <Divider style={styles.menuDivider} />
              <Menu.Item
                leadingIcon="pencil"
                onPress={() => handleEditForm(item)}
                title="Edit Form"
                titleStyle={styles.menuItemText}
              />
            </Menu>
          </View>

          {item.description && (
            <Text variant="bodyMedium" style={styles.description}>
              {item.description}
            </Text>
          )}

          {(item.targeted_respondents || item.targeted_commodities) && (
            <View style={styles.targetingInfo}>
              {item.targeted_respondents && item.targeted_respondents.length > 0 && (
                <View style={styles.targetingRow}>
                  <Text variant="bodySmall" style={styles.targetingLabel}>Respondents:</Text>
                  <Text variant="bodySmall" style={styles.targetingValue}>
                    {item.targeted_respondents.slice(0, 3).join(', ')}
                    {item.targeted_respondents.length > 3 && ` +${item.targeted_respondents.length - 3} more`}
                  </Text>
                </View>
              )}
              {item.targeted_commodities && item.targeted_commodities.length > 0 && (
                <View style={styles.targetingRow}>
                  <Text variant="bodySmall" style={styles.targetingLabel}>Commodities:</Text>
                  <Text variant="bodySmall" style={styles.targetingValue}>
                    {item.targeted_commodities.slice(0, 3).join(', ')}
                    {item.targeted_commodities.length > 3 && ` +${item.targeted_commodities.length - 3} more`}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <IconButton icon="file-document-outline" size={16} iconColor={colors.primary.light} />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statNumber}>{item.question_count || 0}</Text>
                <Text style={styles.statLabel}>questions</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <IconButton icon="clipboard-list-outline" size={16} iconColor="#00c851" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statNumber}>{item.response_count || 0}</Text>
                <Text style={styles.statLabel}>responses</Text>
              </View>
            </View>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <IconButton icon="account-group" size={16} iconColor="#ff6b6b" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statNumber}>{item.team_members_count || 0}</Text>
                <Text style={styles.statLabel}>members</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleEditForm(item)}>
              <Text style={styles.primaryButtonText}>Build Form</Text>
              <IconButton icon="arrow-right" size={16} iconColor={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ScreenWrapper style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading projects...
        </Text>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerContent}>
          <Text variant="headlineMedium" style={styles.title}>
            Forms & Questionnaires
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Build and manage data collection forms
          </Text>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search projects..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.primary.light}
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          theme={{
            colors: {
              primary: colors.primary.main,
              onSurface: colors.text.primary,
              outline: colors.border.medium,
            },
          }}
        />
      </View>

      <FlatList
        data={filteredProjects}
        renderItem={renderProjectCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
            colors={[colors.primary.main]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
            </View>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No Projects Found
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term'
                : 'Create a project from the Projects screen to start building forms'}
            </Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background.default,
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  // Header Styles
  header: {
    position: 'relative',
    backgroundColor: colors.background.paper,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    zIndex: 2,
  },
  headerDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary.main,
  },
  title: {
    fontWeight: 'bold',
    color: colors.text.primary,
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  // Search Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: colors.primary.faint,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
    elevation: 0,
  },
  searchInput: {
    color: colors.text.primary,
  },
  // List Styles
  listContainer: {
    padding: 16,
    paddingTop: 8,
  },
  // Modern Card Styles
  cardWrapper: {
    marginBottom: 16,
  },
  card: {
    position: 'relative',
    backgroundColor: colors.primary.faint,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 24,
  },
  cardContent: {
    padding: 20,
    zIndex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  projectName: {
    fontWeight: 'bold',
    color: colors.text.primary,
    fontSize: 20,
    marginBottom: 8,
  },
  statusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  syncedChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  syncedChipText: {
    color: colors.status.success,
    fontSize: 11,
    fontWeight: '600',
  },
  pendingChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pendingChipText: {
    color: colors.status.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  partnersChip: {
    backgroundColor: 'rgba(67, 56, 202, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
  },
  partnersChipText: {
    color: colors.primary.light,
    fontSize: 11,
    fontWeight: '600',
  },
  targetingInfo: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  targetingRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  targetingLabel: {
    color: colors.text.secondary,
    fontWeight: '600',
    marginRight: 8,
  },
  targetingValue: {
    color: colors.text.primary,
    flex: 1,
  },
  menuButton: {
    backgroundColor: colors.primary.muted,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  menuItemText: {
    color: colors.text.primary,
  },
  menuDivider: {
    backgroundColor: colors.border.light,
  },
  description: {
    color: colors.text.secondary,
    marginBottom: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  // Stats Styles
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    backgroundColor: colors.background.subtle,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statNumber: {
    color: colors.text.primary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  // Card Actions
  cardActions: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  primaryButton: {
    backgroundColor: colors.primary.main,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonText: {
    color: colors.primary.contrast,
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Empty State Styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    marginTop: 64,
  },
  emptyIconContainer: {
    backgroundColor: colors.primary.faint,
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.primary.muted,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 24,
  },
  emptySubtitle: {
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
});

export default React.memo(FormsScreen);