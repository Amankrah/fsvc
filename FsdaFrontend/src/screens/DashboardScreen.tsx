import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
  Switch,
  Divider,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';
import ProjectCard from '../components/ProjectCard';
import NotificationBell from '../components/NotificationBell';
import { Project, RespondentType, CommodityType, PartnerOrganization } from '../types';

type RootStackParamList = {
  Dashboard: { editProjectId?: string };
  ProjectDetails: { projectId: string };
  AcceptInvitation: { projectId: string; notificationId: string };
  Forms: undefined;
  Analytics: { projectId: string };
  Members: { projectId: string };
  Sync: { projectId: string };
};

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
type DashboardRouteProp = RouteProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const route = useRoute<DashboardRouteProp>();
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
  const [hasPartners, setHasPartners] = useState(false);
  const [selectedRespondents, setSelectedRespondents] = useState<RespondentType[]>([]);
  const [selectedCommodities, setSelectedCommodities] = useState<CommodityType[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [partnerOrganizations, setPartnerOrganizations] = useState<PartnerOrganization[]>([]);
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Edit Project Dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Predefined options
  const RESPONDENT_TYPES: RespondentType[] = ['farmers', 'processors', 'retailers_food_vendors', 'local_consumers', 'government'];
  const COMMODITY_TYPES: CommodityType[] = ['cocoa', 'maize', 'palm_oil', 'groundnut', 'honey'];
  const COUNTRY_OPTIONS = ['Ghana', 'Nigeria', 'Kenya', 'Tanzania', 'Uganda', 'Ethiopia', 'South Africa', 'Senegal', 'Mali', 'Burkina Faso', 'Other'];

  // Stats
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalQuestions: 0, // User's own QuestionBank templates (private to each user)
    totalResponses: 0, // Actually counts respondents, not individual responses
    totalMembers: 0,
  });

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiService.getProjects();
      const projectList = Array.isArray(data) ? data : data.results || [];
      setProjects(projectList);
      setFilteredProjects(projectList);

      // Load QuestionBank count from dashboard stats endpoint (more efficient and accurate)
      const dashboardStats = await apiService.getDashboardStats();
      const questionBankCount = dashboardStats.questionbank_templates || 0;
      
      // Debug logging to verify we're getting the correct count
      console.log('QuestionBank count from dashboard_stats:', questionBankCount);

      // Calculate stats
      const totalResponses = projectList.reduce((sum: number, p: Project) => sum + (p.response_count || 0), 0); // response_count now returns respondents count
      const totalMembers = projectList.reduce((sum: number, p: Project) => sum + (p.team_members_count || 1), 0);

      setStats({
        totalProjects: projectList.length,
        totalQuestions: questionBankCount, // User's own QuestionBank templates only
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

  // Search for users to add as partners
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiService.searchUsers(query);
      setSearchResults(response.users || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(partnerSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [partnerSearchQuery, searchUsers]);

  const handleOpenEditDialog = useCallback((project: Project) => {
    setEditingProject(project);
    setNewProjectName(project.name);
    setNewProjectDescription(project.description || '');
    setHasPartners(project.has_partners || false);
    setPartnerOrganizations(project.partner_organizations || []);
    setSelectedRespondents(project.targeted_respondents || []);
    setSelectedCommodities(project.targeted_commodities || []);
    setSelectedCountries(project.targeted_countries || []);
    setShowEditDialog(true);
  }, []);

  // Handle navigation from ProjectDetails to open edit dialog
  useEffect(() => {
    const editProjectId = route.params?.editProjectId;
    if (editProjectId && projects.length > 0) {
      const projectToEdit = projects.find(p => p.id === editProjectId);
      if (projectToEdit) {
        handleOpenEditDialog(projectToEdit);
        // Clear the parameter after opening dialog to prevent reopening on re-render
        navigation.setParams({ editProjectId: undefined });
      }
    }
  }, [route.params?.editProjectId, projects, handleOpenEditDialog, navigation]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      const newProject = await apiService.createProject({
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        has_partners: hasPartners,
        partner_organizations: partnerOrganizations.length > 0 ? partnerOrganizations : undefined,
      });

      setProjects((prev) => [newProject, ...prev]);
      setNewProjectName('');
      setNewProjectDescription('');
      setHasPartners(false);
      setPartnerOrganizations([]);
      setPartnerSearchQuery('');
      setSearchResults([]);
      setSelectedPartner(null);
      setSelectedRespondents([]);
      setSelectedCommodities([]);
      setSelectedCountries([]);
      setShowCreateDialog(false);
    } catch (error: any) {
      console.error('Error creating project:', error);
      alert(error.response?.data?.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  }, [newProjectName, newProjectDescription, hasPartners, partnerOrganizations]);

  const handleAddPartner = useCallback(() => {
    if (selectedPartner) {
      // Check if partner already added
      const alreadyAdded = partnerOrganizations.some(
        p => p.user_id === selectedPartner.id
      );

      if (alreadyAdded) {
        alert('This user has already been added as a partner');
        return;
      }

      setPartnerOrganizations([...partnerOrganizations, {
        user_id: selectedPartner.id,
        name: selectedPartner.full_name || selectedPartner.username,
        contact_email: selectedPartner.email,
        username: selectedPartner.username,
        institution: selectedPartner.institution
      }]);
      setSelectedPartner(null);
      setPartnerSearchQuery('');
      setSearchResults([]);
    }
  }, [selectedPartner, partnerOrganizations]);

  const handleRemovePartner = useCallback((index: number) => {
    const updated = [...partnerOrganizations];
    updated.splice(index, 1);
    setPartnerOrganizations(updated);
  }, [partnerOrganizations]);

  const toggleRespondent = useCallback((respondent: RespondentType) => {
    setSelectedRespondents(prev =>
      prev.includes(respondent) ? prev.filter(r => r !== respondent) : [...prev, respondent]
    );
  }, []);

  const toggleCommodity = useCallback((commodity: CommodityType) => {
    setSelectedCommodities(prev =>
      prev.includes(commodity) ? prev.filter(c => c !== commodity) : [...prev, commodity]
    );
  }, []);

  const toggleCountry = useCallback((country: string) => {
    setSelectedCountries(prev =>
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  }, []);

  const handleUpdateProject = useCallback(async () => {
    if (!editingProject || !newProjectName.trim()) return;

    setIsUpdating(true);
    try {
      const updatedProject = await apiService.updateProject(editingProject.id, {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        has_partners: hasPartners,
        partner_organizations: partnerOrganizations.length > 0 ? partnerOrganizations : undefined,
      });

      setProjects((prev) => prev.map(p => p.id === editingProject.id ? updatedProject : p));
      setNewProjectName('');
      setNewProjectDescription('');
      setHasPartners(false);
      setPartnerOrganizations([]);
      setPartnerSearchQuery('');
      setSearchResults([]);
      setSelectedPartner(null);
      setSelectedRespondents([]);
      setSelectedCommodities([]);
      setSelectedCountries([]);
      setEditingProject(null);
      setShowEditDialog(false);
    } catch (error: any) {
      console.error('Error updating project:', error);
      alert(error.response?.data?.message || 'Failed to update project');
    } finally {
      setIsUpdating(false);
    }
  }, [editingProject, newProjectName, newProjectDescription, hasPartners, partnerOrganizations]);

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
          <ProjectCard project={item} onPress={handleProjectPress} onEditPress={handleOpenEditDialog} />
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
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)} style={styles.createDialog}>
          <Dialog.Title>Create New Project</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogContent}>
                <TextInput
                  label="Project Name *"
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

                <Divider style={styles.divider} />

                <View style={styles.switchContainer}>
                  <View style={styles.switchLabelContainer}>
                    <Text variant="titleMedium">Collaborate with Partners</Text>
                    <Text variant="bodySmall" style={styles.switchDescription}>
                      Enable if partner organizations will collaborate on this project. Partners will be invited as team members with access to their own questions only.
                    </Text>
                  </View>
                  <Switch value={hasPartners} onValueChange={setHasPartners} />
                </View>

                {hasPartners && (
                  <View style={styles.partnersSection}>
                    <Text variant="labelLarge" style={styles.sectionLabel}>Partner Organizations</Text>
                    <Text variant="bodySmall" style={styles.sectionDescription}>
                      Search for registered users to add as partners
                    </Text>
                    <TextInput
                      label="Search Users"
                      value={partnerSearchQuery}
                      onChangeText={setPartnerSearchQuery}
                      mode="outlined"
                      style={styles.dialogInput}
                      placeholder="Search by name, username, or email..."
                      right={isSearching ? <TextInput.Icon icon={() => <ActivityIndicator size={20} />} /> : undefined}
                    />
                    {searchResults.length > 0 && (
                      <View style={styles.searchResultsContainer}>
                        {searchResults.map((user) => (
                          <TouchableOpacity
                            key={user.id}
                            style={[
                              styles.searchResultItem,
                              selectedPartner?.id === user.id && styles.searchResultItemSelected
                            ]}
                            onPress={() => setSelectedPartner(user)}
                          >
                            <View style={styles.searchResultContent}>
                              <Text variant="bodyLarge" style={styles.searchResultName}>
                                {user.full_name}
                              </Text>
                              <Text variant="bodySmall" style={styles.searchResultDetails}>
                                @{user.username} • {user.email}
                              </Text>
                              {user.institution && (
                                <Text variant="bodySmall" style={styles.searchResultInstitution}>
                                  {user.institution}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {partnerSearchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                      <Text variant="bodySmall" style={styles.noResultsText}>
                        No users found
                      </Text>
                    )}
                    <Button
                      mode="contained"
                      onPress={handleAddPartner}
                      disabled={!selectedPartner}
                      style={styles.addPartnerButton}
                      icon="plus"
                    >
                      Add Selected Partner
                    </Button>
                    {partnerOrganizations.length > 0 && (
                      <View style={styles.partnersList}>
                        {partnerOrganizations.map((partner, index) => (
                          <Chip
                            key={index}
                            onClose={() => handleRemovePartner(index)}
                            style={styles.partnerChip}
                          >
                            {partner.name}
                          </Chip>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
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

        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)} style={styles.createDialog}>
          <Dialog.Title>Edit Project</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogContent}>
                <TextInput
                  label="Project Name *"
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  mode="outlined"
                  style={styles.dialogInput}
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

                <Divider style={styles.divider} />

                <View style={styles.switchContainer}>
                  <View style={styles.switchLabelContainer}>
                    <Text variant="titleMedium">Collaborate with Partners</Text>
                    <Text variant="bodySmall" style={styles.switchDescription}>
                      Enable if this project involves partner organizations
                    </Text>
                  </View>
                  <Switch value={hasPartners} onValueChange={setHasPartners} />
                </View>

                {hasPartners && (
                  <View style={styles.partnersSection}>
                    <Text variant="labelLarge" style={styles.sectionLabel}>Partner Organizations</Text>
                    <Text variant="bodySmall" style={styles.sectionDescription}>
                      Search for registered users to add as partners
                    </Text>
                    <TextInput
                      label="Search Users"
                      value={partnerSearchQuery}
                      onChangeText={setPartnerSearchQuery}
                      mode="outlined"
                      style={styles.dialogInput}
                      placeholder="Search by name, username, or email..."
                      right={isSearching ? <TextInput.Icon icon={() => <ActivityIndicator size={20} />} /> : undefined}
                    />
                    {searchResults.length > 0 && (
                      <View style={styles.searchResultsContainer}>
                        {searchResults.map((user) => (
                          <TouchableOpacity
                            key={user.id}
                            style={[
                              styles.searchResultItem,
                              selectedPartner?.id === user.id && styles.searchResultItemSelected
                            ]}
                            onPress={() => setSelectedPartner(user)}
                          >
                            <View style={styles.searchResultContent}>
                              <Text variant="bodyLarge" style={styles.searchResultName}>
                                {user.full_name}
                              </Text>
                              <Text variant="bodySmall" style={styles.searchResultDetails}>
                                @{user.username} • {user.email}
                              </Text>
                              {user.institution && (
                                <Text variant="bodySmall" style={styles.searchResultInstitution}>
                                  {user.institution}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {partnerSearchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                      <Text variant="bodySmall" style={styles.noResultsText}>
                        No users found
                      </Text>
                    )}
                    <Button
                      mode="contained"
                      onPress={handleAddPartner}
                      disabled={!selectedPartner}
                      style={styles.addPartnerButton}
                      icon="plus"
                    >
                      Add Selected Partner
                    </Button>
                    {partnerOrganizations.length > 0 && (
                      <View style={styles.partnersList}>
                        {partnerOrganizations.map((partner, index) => (
                          <Chip
                            key={index}
                            onClose={() => handleRemovePartner(index)}
                            style={styles.partnerChip}
                          >
                            {partner.name}
                          </Chip>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowEditDialog(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button
              onPress={handleUpdateProject}
              loading={isUpdating}
              disabled={isUpdating || !newProjectName.trim()}
            >
              Update
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
  createDialog: {
    maxHeight: '90%',
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
  },
  dialogContent: {
    paddingHorizontal: 24,
  },
  dialogInput: {
    marginBottom: 12,
  },
  divider: {
    marginVertical: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchDescription: {
    color: '#6c757d',
    marginTop: 4,
  },
  sectionLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  sectionDescription: {
    color: '#6c757d',
    marginBottom: 12,
  },
  helperText: {
    color: '#6c757d',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  partnersSection: {
    marginTop: 12,
  },
  partnerInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  partnerInput: {
    flex: 1,
  },
  addPartnerButton: {
    marginBottom: 12,
  },
  partnersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  partnerChip: {
    marginBottom: 4,
  },
  searchResultsContainer: {
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchResultItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  searchResultContent: {
    gap: 4,
  },
  searchResultName: {
    fontWeight: '600',
    color: '#212121',
  },
  searchResultDetails: {
    color: '#757575',
  },
  searchResultInstitution: {
    color: '#9e9e9e',
    fontStyle: 'italic',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#9e9e9e',
    marginVertical: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectionChip: {
    marginBottom: 4,
  },
});

export default React.memo(DashboardScreen);