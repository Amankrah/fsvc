import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, IconButton, Chip, Avatar } from 'react-native-paper';
import { Project } from '../types';
import { colors } from '../constants/theme';

interface ProjectCardProps {
  project: Project;
  onPress: (project: Project) => void;
  onMenuPress?: (project: Project) => void;
  onEditPress?: (project: Project) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress, onMenuPress, onEditPress }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusColor = () => {
    switch (project.sync_status) {
      case 'synced':
        return colors.status.success;
      case 'pending':
        return colors.status.warning;
      case 'error':
        return colors.status.error;
      default:
        return colors.neutral.gray500;
    }
  };

  const getInitials = () => {
    return project.name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <TouchableOpacity onPress={() => onPress(project)} activeOpacity={0.7}>
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Avatar.Text
                size={48}
                label={getInitials()}
                style={[styles.avatar, { backgroundColor: colors.primary.main }]}
              />
              <View style={styles.titleContainer}>
                <Text variant="titleLarge" style={styles.title} numberOfLines={1}>
                  {project.name}
                </Text>
                {project.description && (
                  <Text
                    variant="bodyMedium"
                    style={styles.description}
                    numberOfLines={2}
                  >
                    {project.description}
                  </Text>
                )}
              </View>
            </View>
            {onMenuPress && (
              <IconButton
                icon="dots-vertical"
                size={24}
                onPress={() => onMenuPress(project)}
              />
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <IconButton icon="file-document-outline" size={20} />
              <View>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Questions
                </Text>
                <Text variant="titleMedium" style={styles.statValue}>
                  {project.question_count || 0}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <IconButton icon="account-outline" size={20} />
              <View>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Respondents
                </Text>
                <Text variant="titleMedium" style={styles.statValue}>
                  {project.response_count || 0}
                </Text>
              </View>
            </View>

            <View style={styles.statItem}>
              <IconButton icon="account-group-outline" size={20} />
              <View>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Members
                </Text>
                <Text variant="titleMedium" style={styles.statValue}>
                  {project.team_members_count || 1}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              {project.membership_status === 'pending' && (
                <Chip
                  mode="flat"
                  style={[styles.statusChip, { backgroundColor: colors.status.warning + '20', marginRight: 8 }]}
                  textStyle={{ color: colors.status.warning, fontSize: 11 }}
                  compact
                  icon="account-clock"
                >
                  PENDING INVITE
                </Chip>
              )}
              <Chip
                mode="flat"
                style={[styles.statusChip, { backgroundColor: `${getStatusColor()}20` }]}
                textStyle={{ color: getStatusColor(), fontSize: 11 }}
                compact
              >
                {project.sync_status.toUpperCase()}
              </Chip>
              <Text variant="bodySmall" style={styles.dateText}>
                Updated {formatDate(project.updated_at)}
              </Text>
            </View>
            {onEditPress && (
              <IconButton
                icon="pencil"
                size={20}
                onPress={(e) => {
                  e.stopPropagation();
                  onEditPress(project);
                }}
                style={styles.editButton}
              />
            )}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: colors.background.paper,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    color: colors.text.secondary,
    marginBottom: 2,
  },
  statValue: {
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  dateText: {
    color: colors.text.disabled,
  },
  editButton: {
    margin: 0,
  },
});

export default React.memo(ProjectCard);