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
import { Project } from '../types';

const FormsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState<{ [key: string]: boolean }>({});

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
      const questionList = Array.isArray(questions) ? questions : questions.results || [];

      Alert.alert(
        'Form Questions',
        questionList.length > 0
          ? `This form has ${questionList.length} question${questionList.length !== 1 ? 's' : ''}`
          : 'This form has no questions yet',
        [{ text: 'OK' }]
      );
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
                    iconColor="#ffffff"
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

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <IconButton icon="file-document-outline" size={16} iconColor="#64c8ff" />
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
              <IconButton icon="arrow-right" size={16} iconColor="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4b1e85" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading projects...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
          iconColor="#64c8ff"
          placeholderTextColor="rgba(255, 255, 255, 0.5)"
          theme={{
            colors: {
              primary: '#4b1e85',
              onSurface: '#ffffff',
              outline: 'rgba(75, 30, 133, 0.5)',
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
            tintColor="#4b1e85"
            colors={["#4b1e85"]}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
  },
  // Header Styles
  header: {
    position: 'relative',
    backgroundColor: '#1a1a3a',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
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
    backgroundColor: '#4b1e85',
  },
  title: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 28,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  // Search Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
    elevation: 0,
  },
  searchInput: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#ffffff',
    fontSize: 20,
    marginBottom: 8,
  },
  statusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  syncedChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  syncedChipText: {
    color: '#4caf50',
    fontSize: 11,
    fontWeight: '600',
  },
  pendingChip: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.4)',
  },
  pendingChipText: {
    color: '#ff9800',
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    backgroundColor: 'rgba(75, 30, 133, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#1a1a3a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  menuItemText: {
    color: '#ffffff',
  },
  menuDivider: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  // Card Actions
  cardActions: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryButton: {
    backgroundColor: '#4b1e85',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonText: {
    color: '#ffffff',
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
    backgroundColor: 'rgba(75, 30, 133, 0.2)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(75, 30, 133, 0.4)',
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 24,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
});

export default React.memo(FormsScreen);