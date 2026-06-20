import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
} from 'react-native';
import {
  Text,
  Portal,
  Dialog,
  TextInput,
  Button,
  Searchbar,
  Chip,
  Switch,
  Divider,
  Icon,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import apiService from '../services/api';
import ProjectCard from '../components/ProjectCard';
import StatPill from '../components/StatPill';
import NotificationBell from '../components/NotificationBell';
import { SkeletonProjectCard } from '../components/Skeleton';
import { Project, RespondentType, CommodityType, PartnerOrganization } from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { offlineProjectCache, networkMonitor, syncManager } from '../services';
import { useToast } from '../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';

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
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { width: windowWidth } = useWindowDimensions();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'synced' | 'pending' | 'error'>('all');
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const [fabPressed, setFabPressed] = useState(false);

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
      // Check network connection
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Online: Fetch from server and cache
        try {
          const data = await apiService.getProjects();
          const projectList = Array.isArray(data) ? data : data.results || [];

          // Log project count and first project structure
          console.log('📋 Total projects to cache:', projectList.length);
          if (projectList.length > 0) {
            console.log('📋 First project keys:', Object.keys(projectList[0]));
            console.log('📋 Sample project targeted fields:', {
              targeted_respondents: projectList[0].targeted_respondents,
              targeted_commodities: projectList[0].targeted_commodities,
              targeted_countries: projectList[0].targeted_countries,
            });
          }

          // Cache projects for offline use
          await offlineProjectCache.cacheProjects(projectList);

          setProjects(projectList);
          setFilteredProjects(projectList);
          setIsOfflineMode(false);

          // Calculate stats from project data (consistent with offline path)
          const totalResponses = projectList.reduce((sum: number, p: Project) => sum + (p.response_count || 0), 0);
          const totalMembers = projectList.reduce((sum: number, p: Project) => sum + (p.team_members_count || 1), 0);
          const totalQuestions = projectList.reduce((sum: number, p: Project) => sum + (p.question_count || 0), 0);

          setStats({
            totalProjects: projectList.length,
            totalQuestions,
            totalResponses,
            totalMembers,
          });
        } catch (error: any) {
          // Network error - fall back to cache
          console.log('Network error, falling back to cached projects');
          const cachedProjects = await offlineProjectCache.getProjects();

          if (cachedProjects.length > 0) {
            setProjects(cachedProjects);
            setFilteredProjects(cachedProjects);
            setIsOfflineMode(true);

            // Calculate stats from cached data
            const totalResponses = cachedProjects.reduce((sum, p) => sum + (p.response_count || 0), 0);
            const totalMembers = cachedProjects.reduce((sum, p) => sum + (p.team_members_count || 1), 0);
            const totalQuestions = cachedProjects.reduce((sum, p) => sum + (p.question_count || 0), 0);

            setStats({
              totalProjects: cachedProjects.length,
              totalQuestions,
              totalResponses,
              totalMembers,
            });
          } else {
            console.error('No cached projects available');
          }
        }
      } else {
        // Offline: Load from cache
        console.log('Offline mode - loading cached projects');
        const cachedProjects = await offlineProjectCache.getProjects();

        if (cachedProjects.length > 0) {
          setProjects(cachedProjects);
          setFilteredProjects(cachedProjects);
          setIsOfflineMode(true);

          // Calculate stats from cached data
          const totalResponses = cachedProjects.reduce((sum, p) => sum + (p.response_count || 0), 0);
          const totalMembers = cachedProjects.reduce((sum, p) => sum + (p.team_members_count || 1), 0);
          const totalQuestions = cachedProjects.reduce((sum, p) => sum + (p.question_count || 0), 0);

          setStats({
            totalProjects: cachedProjects.length,
            totalQuestions,
            totalResponses,
            totalMembers,
          });
        } else {
          console.warn('No cached projects found. Need to sync first while online.');
        }
      }
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
      showToast({ message: error.response?.data?.message || 'Failed to create project', variant: 'error' });
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
        showToast({ message: 'This user has already been added as a partner', variant: 'warning' });
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
      const updateData = {
        name: newProjectName.trim(),
        description: newProjectDescription.trim() || undefined,
        has_partners: hasPartners,
        partner_organizations: partnerOrganizations.length > 0 ? partnerOrganizations : undefined,
      };

      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Online: Update via API
        const updatedProject = await apiService.updateProject(editingProject.id, updateData);

        // Update local state
        setProjects((prev) => prev.map(p => p.id === editingProject.id ? updatedProject : p));

        // Update offline cache
        await offlineProjectCache.updateProject(updatedProject);

        console.log('✓ Project updated online and cache updated');
      } else {
        // Offline: Queue for sync and update local cache
        console.log('📴 Offline - queuing project update for sync');

        // Create optimistic update
        const optimisticUpdate = {
          ...editingProject,
          ...updateData,
        };

        // Update local state immediately
        setProjects((prev) => prev.map(p => p.id === editingProject.id ? optimisticUpdate : p));

        // Update offline cache
        await offlineProjectCache.updateProject(optimisticUpdate);

        // Queue for sync when back online
        await syncManager.queueOperation(
          'projects',
          editingProject.id,
          'update',
          updateData,
          10 // High priority
        );

        console.log('✓ Project queued for sync and cache updated');
      }

      // Clear form
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
      showToast({ message: error.response?.data?.message || 'Failed to update project', variant: 'error' });
    } finally {
      setIsUpdating(false);
    }
  }, [editingProject, newProjectName, newProjectDescription, hasPartners, partnerOrganizations]);

  const handleProjectPress = useCallback(
    (project: Project) => {
      if (project.membership_status === 'pending') {
        Alert.alert(
          'Invitation Pending',
          `You've been invited to "${project.name}" but haven't accepted yet.\n\nOpen your notifications (bell icon) to accept or decline the invitation.`,
          [{ text: 'OK' }]
        );
        return;
      }
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

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const renderHeader = () => (
    <View>
      {/* ── Green hero band ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.primary.dark, colors.primary.main]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
      >
        {/* Top row: greeting + actions */}
        <View style={styles.heroTop}>
          <View style={styles.heroGreeting}>
            <Text style={styles.heroGreetLine}>
              {getGreeting()}, {user?.first_name || user?.username} 👋
            </Text>
            <Text style={styles.heroSub}>Your research projects</Text>
          </View>
          <View style={styles.heroActions}>
            <NotificationBell
              onNavigateToProject={handleNavigateToProject}
              onNavigateToInvitation={handleNavigateToInvitation}
            />
          </View>
        </View>

        {/* Offline banner */}
        {isOfflineMode && (
          <View style={styles.offlineBanner}>
            <Icon source="wifi-off" size={16} color={colors.status.warning} />
            <Text style={styles.offlineBannerText}>Offline — showing cached data</Text>
          </View>
        )}

        {/* Stat pills — flex row on wide screens, scrollable on narrow */}
        {Platform.OS === 'web' && windowWidth >= 600 ? (
          <View style={styles.pillsRowFlex}>
            <StatPill icon="folder-outline"        value={stats.totalProjects}  label="Projects"    onDark fill />
            <StatPill icon="file-document-outline" value={stats.totalQuestions} label="Questions"   onDark fill />
            <StatPill icon="account-outline"       value={stats.totalResponses} label="Respondents" onDark fill />
            <StatPill icon="account-group-outline" value={stats.totalMembers}   label="Members"     onDark fill />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsRow}
          >
            <StatPill icon="folder-outline"        value={stats.totalProjects}  label="Projects"    onDark />
            <StatPill icon="file-document-outline" value={stats.totalQuestions} label="Questions"   onDark />
            <StatPill icon="account-outline"       value={stats.totalResponses} label="Respondents" onDark />
            <StatPill icon="account-group-outline" value={stats.totalMembers}   label="Members"     onDark />
          </ScrollView>
        )}
      </LinearGradient>

      {/* ── Search + filters ────────────────────────────────────────────── */}
      <View style={styles.controls}>
        <Searchbar
          placeholder="Search projects…"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          elevation={0}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'synced', 'pending', 'error'] as const).map((s) => (
            <Chip
              key={s}
              selected={filterStatus === s}
              onPress={() => setFilterStatus(s)}
              style={[styles.chip, filterStatus === s && styles.chipActive]}
              textStyle={filterStatus === s ? styles.chipTextActive : styles.chipText}
              compact
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* ── Section header ──────────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Your Projects ({filteredProjects.length})</Text>
      </View>

      {/* ── Loading skeletons ────────────────────────────────────────────── */}
      {isLoading && (
        <View>
          <SkeletonProjectCard />
          <SkeletonProjectCard />
          <SkeletonProjectCard />
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <Icon source="folder-plus-outline" size={40} color={colors.primary.main} />
      </View>
      <Text style={styles.emptyTitle}>No Projects Yet</Text>
      <Text style={styles.emptyBody}>
        Create your first project to start collecting and analysing research data.
      </Text>
      <TouchableOpacity
        style={styles.emptyBtn}
        onPress={() => setShowCreateDialog(true)}
        activeOpacity={0.82}
      >
        <Icon source="plus" size={18} color="#fff" />
        <Text style={styles.emptyBtnLabel}>Create Project</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={isLoading ? [] : filteredProjects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectCard project={item} onPress={handleProjectPress} onEditPress={handleOpenEditDialog} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary.main]}
          />
        }
        contentContainerStyle={!isLoading && filteredProjects.length === 0 ? styles.emptyList : styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 8 }, fabPressed && styles.fabActive]}
        onPress={() => setShowCreateDialog(true)}
        onPressIn={() => setFabPressed(true)}
        onPressOut={() => setFabPressed(false)}
        activeOpacity={1}
      >
        <Icon source="plus" size={18} color={fabPressed ? '#fff' : colors.primary.dark} />
        <Text style={[styles.fabLabel, fabPressed && styles.fabLabelActive]}>New Project</Text>
      </TouchableOpacity>

      <Portal>
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)} style={styles.createDialog}>
          <View style={styles.dialogTitleRow}>
            <View style={styles.dialogTitleAccent} />
            <Text style={styles.dialogTitleText}>Create New Project</Text>
          </View>
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
          <View style={styles.dialogActionRow}>
            <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowCreateDialog(false)} disabled={isCreating}>
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogPrimaryBtn, (isCreating || !newProjectName.trim()) && styles.dialogBtnDisabled]}
              onPress={handleCreateProject}
              disabled={isCreating || !newProjectName.trim()}
            >
              {isCreating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.dialogPrimaryText}>Create Project</Text>}
            </TouchableOpacity>
          </View>
        </Dialog>

        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)} style={styles.createDialog}>
          <View style={styles.dialogTitleRow}>
            <View style={styles.dialogTitleAccent} />
            <Text style={styles.dialogTitleText}>Edit Project</Text>
          </View>
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
          <View style={styles.dialogActionRow}>
            <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowEditDialog(false)} disabled={isUpdating}>
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dialogPrimaryBtn, (isUpdating || !newProjectName.trim()) && styles.dialogBtnDisabled]}
              onPress={handleUpdateProject}
              disabled={isUpdating || !newProjectName.trim()}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.dialogPrimaryText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Layout
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },

  // ── Hero band
  hero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heroGreeting: {
    flex: 1,
    marginRight: spacing.md,
  },
  heroGreetLine: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  heroSub: {
    fontFamily: 'Fraunces-Regular',
    fontSize: typography.fontSize.md,
    color: 'rgba(255,255,255,0.7)',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(217,119,6,0.15)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
  },
  offlineBannerText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.status.warning,
  },
  pillsRow: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  pillsRowFlex: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },

  // ── Controls
  controls: {
    backgroundColor: colors.background.paper,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchBar: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    height: 44,
  },
  searchInput: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
  },
  filterRow: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chip: {
    borderRadius: borderRadius.round,
  },
  chipActive: {
    backgroundColor: colors.primary.surface,
  },
  chipText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  chipTextActive: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },

  // ── Section row
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.2,
  },

  // ── Empty state
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.huge,
  },
  emptyIllustration: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyBtnLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    // Ghost/outline state (idle — transparent so content behind shows through)
    backgroundColor: 'rgba(10, 61, 43, 0.08)',
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
    borderColor: colors.primary.dark,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.primary.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  fabActive: {
    // Solid state (pressed)
    backgroundColor: colors.primary.dark,
    borderColor: colors.primary.dark,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  fabLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.primary.dark,
  },
  fabLabelActive: {
    color: '#fff',
  },

  // ── Dialogs
  createDialog: {
    maxHeight: '90%',
    borderRadius: borderRadius.xxl,
    backgroundColor: colors.background.paper,
    overflow: 'hidden',
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  dialogTitleAccent: {
    width: 4,
    height: 26,
    backgroundColor: colors.primary.main,
    borderRadius: 2,
  },
  dialogTitleText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
    paddingLeft: spacing.md,
  },
  dialogActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  dialogPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogPrimaryText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  dialogBtnDisabled: {
    opacity: 0.45,
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
    color: colors.text.secondary,
    marginTop: 4,
  },
  sectionLabel: {
    marginBottom: 8,
    fontWeight: '600',
  },
  sectionDescription: {
    color: colors.text.secondary,
    marginBottom: 12,
  },
  helperText: {
    color: colors.text.secondary,
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
    borderColor: colors.border.medium,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: colors.background.paper,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchResultItemSelected: {
    backgroundColor: colors.primary.light + '20',
  },
  searchResultContent: {
    gap: 4,
  },
  searchResultName: {
    fontWeight: '600',
    color: colors.text.primary,
  },
  searchResultDetails: {
    color: colors.text.secondary,
  },
  searchResultInstitution: {
    color: colors.text.disabled,
    fontStyle: 'italic',
  },
  noResultsText: {
    textAlign: 'center',
    color: colors.text.disabled,
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