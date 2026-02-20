import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Menu, IconButton, Text } from 'react-native-paper';
import { colors } from '../constants/theme';
import apiService from '../services/api';
import { Project } from '../types';

interface ProjectSelectorProps {
  currentProjectId: string;
  currentProjectName: string;
  onProjectChange: (projectId: string, projectName: string) => void;
  iconColor?: string;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  currentProjectId,
  onProjectChange,
  iconColor = colors.primary.contrast,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjects();
      const projectList = Array.isArray(data) ? data : data.results || [];
      setProjects(projectList);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setMenuVisible(false);
    if (project.id !== currentProjectId) {
      onProjectChange(project.id, project.name);
    }
  };

  return (
    <View style={styles.container}>
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <IconButton
            icon="swap-horizontal"
            iconColor={iconColor}
            size={20}
            onPress={() => setMenuVisible(true)}
          />
        }
        contentStyle={styles.menuContent}
      >
        <View style={styles.menuHeader}>
          <Text variant="labelSmall" style={styles.menuHeaderText}>
            Switch Project
          </Text>
        </View>
        {loading ? (
          <Menu.Item
            title="Loading projects..."
            disabled
            titleStyle={styles.menuItemTitle}
          />
        ) : projects.length === 0 ? (
          <Menu.Item
            title="No projects available"
            disabled
            titleStyle={styles.menuItemTitle}
          />
        ) : (
          projects.map((project) => (
            <Menu.Item
              key={project.id}
              onPress={() => handleProjectSelect(project)}
              title={`${project.name}${project.membership_status === 'pending' ? ' (Pending)' : ''}`}
              titleStyle={[
                styles.menuItemTitle,
                project.id === currentProjectId && styles.activeMenuItem,
              ]}
              leadingIcon={
                project.id === currentProjectId ? 'check-circle' : 'circle-outline'
              }
            />
          ))
        )}
      </Menu>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 8,
  },
  menuContent: {
    backgroundColor: colors.background.paper,
    minWidth: 250,
    maxHeight: 400,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.neutral.gray100,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  menuHeaderText: {
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  menuItemTitle: {
    fontSize: 14,
    color: colors.text.primary,
  },
  activeMenuItem: {
    color: colors.primary.main,
    fontWeight: '600',
  },
});

export default ProjectSelector;
