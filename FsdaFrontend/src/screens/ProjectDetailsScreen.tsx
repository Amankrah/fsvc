import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Button,
  IconButton,
  Divider,
  List,
  Avatar,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiService from '../services/api';
import { Project } from '../types';

type RootStackParamList = {
  Dashboard: undefined;
  ProjectDetails: { projectId: string };
  Forms: { projectId: string };
  DataCollection: { projectId: string; projectName: string };
  Responses: { projectId: string; projectName: string };
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

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const data = await apiService.getProject(projectId);
      setProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
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

  const menuItems = [
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
      title: 'Analytics',
      description: 'View insights and analytics (Coming Soon)',
      icon: 'chart-box-outline',
      route: 'Analytics' as keyof RootStackParamList,
      color: '#03dac6',
      disabled: true,
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
});

export default React.memo(ProjectDetailsScreen);