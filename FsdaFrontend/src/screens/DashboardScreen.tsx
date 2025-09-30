import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Text,
  FAB,
  Portal,
  Dialog,
  TextInput,
  Button,
  Surface,
  IconButton,
  Searchbar,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';
import ProjectCard from '../components/ProjectCard';
import NotificationBell from '../components/NotificationBell';
import { Project } from '../types';

type RootStackParamList = {
  Dashboard: undefined;
  ProjectDetails: { projectId: string };
  AcceptInvitation: { projectId: string; notificationId: string };
  Forms: undefined;
  Analytics: { projectId: string };
  Members: { projectId: string };
  Sync: { projectId: string };
};

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const { user } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'synced' | 'pending' | 'error'>('all');

  // Create Project Dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalQuestions: 0,
    totalResponses: 0, // Actually counts respondents, not individual responses
    totalMembers: 0,
  });

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiService.getProjects();
      const projectList = Array.isArray(data) ? data : data.results || [];
      setProjects(projectList);
      setFilteredProjects(projectList);

      // Calculate stats
      const totalQuestions = projectList.reduce((sum: number, p: Project) => sum + (p.question_count || 0), 0);
      const totalResponses = projectList.reduce((sum: number, p: Project) => sum + (p.response_count || 0), 0); // response_count now returns respondents count
      const totalMembers = projectList.reduce((sum: number, p: Project) => sum + (p.team_members_count || 1), 0);

      setStats({
        totalProjects: projectList.length,
        totalQuestions,
        totalResponses,
        totalMembers,
      });
    } catch (error: any) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Filter projects
  useEffect(() => {
    let filtered = projects;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((p) => p.sync_status === filterStatus);
    }

    setFilteredProjects(filtered);
  }, [searchQuery, filterStatus, projects]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const newProject = await apiService.createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
      });

      setProjects((prev) => [newProject, ...prev]);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateDialog(false);
    } catch (error: any) {
      console.error('Error creating project:', error);
      alert(error.response?.data?.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  }, [newProjectName, newProjectDescription]);

  const handleProjectPress = useCallback(
    (project: Project) => {
      navigation.navigate('ProjectDetails', { projectId: project.id });
    },
    [navigation]
  );

  const handleNavigateToProject = useCallback(
    (projectId: string) => {
      navigation.navigate('ProjectDetails', { projectId });
    },
    [navigation]
  );

  const handleNavigateToInvitation = useCallback(
    (projectId: string, notificationId: string) => {
      navigation.navigate('AcceptInvitation', { projectId, notificationId });
    },
    [navigation]
  );

  const renderStatCard = (icon: string, label: string, value: number, color: string) => (
    <Surface style={[styles.statCard, { borderLeftColor: color }]} elevation={2}>
      <IconButton icon={icon} size={32} iconColor={color} />
      <View style={styles.statContent}>
        <Text variant="headlineMedium" style={styles.statValue}>
          {value}
        </Text>
        <Text variant="bodyMedium" style={styles.statLabel}>
          {label}
        </Text>
      </View>
    </Surface>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.welcomeSection}>
          <Text variant="headlineMedium" style={styles.welcomeText}>
            Welcome back, {user?.first_name || user?.username}! 👋
          </Text>
          <Text variant="bodyMedium" style={styles.subtitleText}>
            Manage your research projects and collaborate with your team
          </Text>
        </View>
        <NotificationBell 
          onNavigateToProject={handleNavigateToProject}
          onNavigateToInvitation={handleNavigateToInvitation}
        />
      </View>

      <View style={styles.statsGrid}>
        {renderStatCard('folder-outline', 'Projects', stats.totalProjects, '#6200ee')}
        {renderStatCard('file-document-outline', 'Questions', stats.totalQuestions, '#03dac6')}
        {renderStatCard('account-outline', 'Respondents', stats.totalResponses, '#ff6f00')}
        {renderStatCard('account-group-outline', 'Members', stats.totalMembers, '#00bcd4')}
      </View>

      <View style={styles.quickActions}>
        <Text variant="titleMedium" style={styles.quickActionsTitle}>
          Quick Actions
        </Text>
        <View style={styles.quickActionsButtons}>
          <Button
            mode="outlined"
            icon="file-document-edit"
            onPress={() => navigation.navigate('Forms')}
            style={styles.quickActionButton}
          >
            Build Forms
          </Button>
          <Button
            mode="outlined"
            icon="chart-bar"
            onPress={() => {
              if (projects.length > 0) {
                navigation.navigate('Analytics', { projectId: projects[0].id });
              }
            }}
            style={styles.quickActionButton}
          >
            Analytics
          </Button>
        </View>
      </View>

      <View style={styles.controlsSection}>
        <Searchbar
          placeholder="Search projects..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <View style={styles.filterChips}>
          <Chip
            selected={filterStatus === 'all'}
            onPress={() => setFilterStatus('all')}
            style={styles.chip}
          >
            All
          </Chip>
          <Chip
            selected={filterStatus === 'synced'}
            onPress={() => setFilterStatus('synced')}
            style={styles.chip}
          >
            Synced
          </Chip>
          <Chip
            selected={filterStatus === 'pending'}
            onPress={() => setFilterStatus('pending')}
            style={styles.chip}
          >
            Pending
          </Chip>
          <Chip
            selected={filterStatus === 'error'}
            onPress={() => setFilterStatus('error')}
            style={styles.chip}
          >
            Error
          </Chip>
        </View>
      </View>

      <Text variant="titleLarge" style={styles.sectionTitle}>
        Your Projects ({filteredProjects.length})
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconButton icon="folder-plus-outline" size={80} iconColor="#ccc" />
      <Text variant="titleLarge" style={styles.emptyTitle}>
        No Projects Yet
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Create your first project to start collecting research data
      </Text>
      <Button
        mode="contained"
        onPress={() => setShowCreateDialog(true)}
        style={styles.emptyButton}
        icon="plus"
      >
        Create Project
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectCard project={item} onPress={handleProjectPress} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={filteredProjects.length === 0 ? styles.emptyList : undefined}
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowCreateDialog(true)}
        label="New Project"
      />

      <Portal>
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)}>
          <Dialog.Title>Create New Project</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Project Name"
              value={newProjectName}
              onChangeText={setNewProjectName}
              mode="outlined"
              style={styles.dialogInput}
              autoFocus
            />
            <TextInput
              label="Description (Optional)"
              value={newProjectDescription}
              onChangeText={setNewProjectDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCreateDialog(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              onPress={handleCreateProject}
              loading={isCreating}
              disabled={isCreating || !newProjectName.trim()}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  welcomeSection: {
    flex: 1,
    marginRight: 16,
  },
  welcomeText: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212529',
    fontSize: 28,
  },
  subtitleText: {
    color: '#6c757d',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statContent: {
    marginLeft: 12,
  },
  statValue: {
    fontWeight: 'bold',
    fontSize: 24,
    color: '#212529',
  },
  statLabel: {
    color: '#6c757d',
    fontSize: 14,
    marginTop: 2,
  },
  quickActions: {
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#212529',
    fontSize: 18,
  },
  quickActionsButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
  },
  controlsSection: {
    marginBottom: 24,
  },
  searchBar: {
    marginBottom: 12,
    elevation: 2,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    marginRight: 0,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212529',
    fontSize: 18,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#212529',
    fontSize: 20,
  },
  emptyText: {
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  dialogInput: {
    marginBottom: 12,
  },
});

export default React.memo(DashboardScreen);