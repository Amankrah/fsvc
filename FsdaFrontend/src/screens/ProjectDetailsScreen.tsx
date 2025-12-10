import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  IconButton,
  Divider,
  List,
  Avatar,
  FAB,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiService from '../services/api';
import { Project } from '../types';
import { offlineProjectCache, networkMonitor } from '../services';

type RootStackParamList = {
  Dashboard: { editProjectId?: string };
  ProjectDetails: { projectId: string };
  Forms: { projectId: string };
  DataCollection: { projectId: string; projectName: string };
  Responses: { projectId: string; projectName: string };
  ResponseLinks: { projectId: string; projectName: string };
  BundleCompletion: { projectId: string; projectName: string };
  Analytics: { projectId: string };
  Members: { projectId: string };
  Sync: { projectId: string };
};

type ProjectDetailsRouteProp = RouteProp<RootStackParamList, 'ProjectDetails'>;
type ProjectDetailsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProjectDetails'>;

const ProjectDetailsScreen: React.FC = () => {
  const route = useRoute<ProjectDetailsRouteProp>();
  const navigation = useNavigation<ProjectDetailsNavigationProp>();
  const { projectId } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      // Check network connection
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Online: Fetch from server
        try {
          const data = await apiService.getProject(projectId);
          setProject(data);
          setIsOfflineMode(false);

          // Update cache with latest project data
          await offlineProjectCache.updateProject(data);
        } catch (error) {
          // Network error - fall back to cache
          console.log('Network error, falling back to cached project');
          const cachedProject = await offlineProjectCache.getProject(projectId);

          if (cachedProject) {
            setProject(cachedProject);
            setIsOfflineMode(true);
          } else {
            console.error('No cached project available');
            Alert.alert(
              'No Data Available',
              'This project is not cached for offline use. Please sync while online first.'
            );
          }
        }
      } else {
        // Offline: Load from cache
        console.log('Offline mode - loading cached project');
        const cachedProject = await offlineProjectCache.getProject(projectId);

        if (cachedProject) {
          setProject(cachedProject);
          setIsOfflineMode(true);
        } else {
          console.warn('No cached project found. Need to sync first while online.');
          Alert.alert(
            'Offline Mode',
            'This project is not available offline. Please connect to the internet to load it.'
          );
        }
      }
    } catch (error) {
      console.error('Error loading project:', error);
      Alert.alert('Error', 'Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !project) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  interface MenuItem {
    title: string;
    description: string;
    icon: string;
    route: keyof RootStackParamList;
    color: string;
    requiresName?: boolean;
    disabled?: boolean;
  }

  const menuItems: MenuItem[] = [
    {
      title: 'Build Forms & Questionnaires',
      description: 'Create and manage data collection forms',
      icon: 'file-document-edit-outline',
      route: 'Forms' as keyof RootStackParamList,
      color: '#6200ee',
    },
    {
      title: 'Collect Data',
      description: 'Fill out survey forms and collect responses',
      icon: 'clipboard-text-outline',
      route: 'DataCollection' as keyof RootStackParamList,
      color: '#4caf50',
      requiresName: true,
    },
    {
      title: 'View Responses',
      description: 'Review submitted responses and export data',
      icon: 'table-eye',
      route: 'Responses' as keyof RootStackParamList,
      color: '#ff9800',
      requiresName: true,
    },
    {
      title: 'Response Links',
      description: 'Share surveys via web links and track submissions',
      icon: 'link-variant',
      route: 'ResponseLinks' as keyof RootStackParamList,
      color: '#9c27b0',
      requiresName: true,
    },
    {
      title: 'Bundle Completion Stats',
      description: 'Track completion rates for question bundles',
      icon: 'checkbox-multiple-marked-outline',
      route: 'BundleCompletion' as keyof RootStackParamList,
      color: '#4CAF50',
      requiresName: true,
    },
    {
      title: 'Analytics',
      description: 'View descriptive statistics and data insights',
      icon: 'chart-box-outline',
      route: 'Analytics' as keyof RootStackParamList,
      color: '#03dac6',
    },
    {
      title: 'Project Members',
      description: 'Manage team members and collaborators',
      icon: 'account-group-outline',
      route: 'Members' as keyof RootStackParamList,
      color: '#00bcd4',
    },
    {
      title: 'Sync & Backup',
      description: 'Sync data with cloud and manage offline access',
      icon: 'cloud-sync-outline',
      route: 'Sync' as keyof RootStackParamList,
      color: '#ff6f00',
    },
  ];

  const handleEditProject = () => {
    navigation.navigate('Dashboard', { editProjectId: projectId });
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerContent}>
            <Avatar.Text
              size={64}
              label={project.name.substring(0, 2).toUpperCase()}
              style={{ backgroundColor: '#6200ee' }}
            />
            <View style={styles.headerText}>
              <Text variant="headlineMedium" style={styles.projectName}>
                {project.name}
              </Text>
              {project.description && (
                <Text variant="bodyMedium" style={styles.description}>
                  {project.description}
                </Text>
              )}
            </View>
            <IconButton
              icon="pencil"
              size={24}
              onPress={handleEditProject}
              style={styles.editIconButton}
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text variant="titleLarge">{project.question_count || 0}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Questions
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.stat}>
              <Text variant="titleLarge">{project.response_count || 0}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Respondents
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.stat}>
              <Text variant="titleLarge">{project.team_members_count || 1}</Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Members
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {isOfflineMode && (
        <Card style={styles.offlineBanner}>
          <Card.Content style={styles.offlineBannerContent}>
            <IconButton icon="wifi-off" size={20} iconColor="#ff9800" />
            <Text variant="bodyMedium" style={styles.offlineBannerText}>
              Offline Mode - Showing cached data
            </Text>
          </Card.Content>
        </Card>
      )}

      <View style={styles.menuSection}>
        <Text variant="titleLarge" style={styles.sectionTitle}>
          Project Tools
        </Text>

        {menuItems.map((item, index) => (
          <Card
            key={index}
            style={[styles.menuCard, item.disabled && styles.disabledCard]}
            onPress={
              item.disabled
                ? undefined
                : () => {
                    const params: any = { projectId };
                    if (item.requiresName) {
                      params.projectName = project.name;
                    }
                    navigation.navigate(item.route, params);
                  }
            }
          >
            <Card.Content style={styles.menuCardContent}>
              <IconButton icon={item.icon} size={40} iconColor={item.color} />
              <View style={styles.menuText}>
                <Text variant="titleMedium" style={styles.menuTitle}>
                  {item.title}
                </Text>
                <Text variant="bodySmall" style={styles.menuDescription}>
                  {item.description}
                </Text>
              </View>
              <IconButton icon="chevron-right" />
            </Card.Content>
          </Card>
        ))}
      </View>

      <Button
        mode="outlined"
        icon="arrow-left"
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        Back to Dashboard
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 16,
    backgroundColor: 'white',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerText: {
    marginLeft: 16,
    flex: 1,
  },
  projectName: {
    fontWeight: 'bold',
  },
  description: {
    color: '#666',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  divider: {
    height: 40,
    width: 1,
  },
  offlineBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff3e0',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  offlineBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  offlineBannerText: {
    flex: 1,
    color: '#e65100',
    marginLeft: 8,
  },
  menuSection: {
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  menuCard: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  disabledCard: {
    opacity: 0.6,
  },
  menuCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    marginLeft: 8,
  },
  menuTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  menuDescription: {
    color: '#666',
  },
  backButton: {
    margin: 16,
    marginTop: 8,
  },
  editIconButton: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});

export default React.memo(ProjectDetailsScreen);