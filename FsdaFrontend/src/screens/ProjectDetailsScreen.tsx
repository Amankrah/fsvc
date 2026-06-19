import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import apiService from '../services/api';
import { Project } from '../types';
import { offlineProjectCache, networkMonitor } from '../services';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import ToolCard from '../components/ToolCard';
import { SkeletonProjectCard } from '../components/Skeleton';

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
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { projectId } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        try {
          const data = await apiService.getProject(projectId);
          setProject(data);
          setIsOfflineMode(false);
          await offlineProjectCache.updateProject(data);
        } catch {
          const cachedProject = await offlineProjectCache.getProject(projectId);
          if (cachedProject) {
            setProject(cachedProject);
            setIsOfflineMode(true);
          } else {
            Alert.alert('No Data Available', 'This project is not cached for offline use. Please sync while online first.');
          }
        }
      } else {
        const cachedProject = await offlineProjectCache.getProject(projectId);
        if (cachedProject) {
          setProject(cachedProject);
          setIsOfflineMode(true);
        } else {
          Alert.alert('Offline Mode', 'This project is not available offline. Please connect to the internet to load it.');
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  };

  const navigate = (route: keyof RootStackParamList, requiresName = false) => {
    const params: any = { projectId };
    if (requiresName && project) params.projectName = project.name;
    if (route === 'BundleCompletion') {
      params.isOwner = project?.created_by === user?.id;
    }
    navigation.navigate(route, params);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.skeletonHero} />
        <SkeletonProjectCard />
        <SkeletonProjectCard />
      </View>
    );
  }

  if (!project) return null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          {/* Back + Edit row */}
          <View style={styles.heroNav}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.heroBackBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon source="chevron-left" size={24} color="#fff" />
              <Text style={styles.heroBackText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Dashboard', { editProjectId: projectId })}
              style={styles.heroEditBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon source="pencil-outline" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          {/* Project info */}
          <View style={styles.heroContent}>
            <Text style={styles.heroName} numberOfLines={2}>{project.name}</Text>
            {project.description ? (
              <Text style={styles.heroDesc} numberOfLines={2}>{project.description}</Text>
            ) : null}
          </View>

          {/* Offline pill */}
          {isOfflineMode && (
            <View style={styles.offlinePill}>
              <Icon source="wifi-off" size={14} color={colors.status.warning} />
              <Text style={styles.offlinePillText}>Offline — cached data</Text>
            </View>
          )}

          {/* Stat bar */}
          <View style={styles.statBar}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{project.question_count ?? 0}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBorder]}>
              <Text style={styles.statValue}>{project.response_count ?? 0}</Text>
              <Text style={styles.statLabel}>Respondents</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{project.team_members_count ?? 1}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
          </View>
        </View>

        {/* ── Tools grid ──────────────────────────────────────────────────── */}
        <View style={styles.toolsSection}>
          <Text style={styles.toolsTitle}>Project Tools</Text>

          {/* Featured: Collect Data */}
          <ToolCard
            icon="clipboard-text-outline"
            title="Collect Data"
            description="Fill out survey forms and record respondent answers in the field"
            onPress={() => navigate('DataCollection', true)}
            featured
            tintColor={colors.primary.main}
          />

          {/* Row: Build Forms | Analytics */}
          <View style={styles.toolRow}>
            <ToolCard
              icon="file-document-edit-outline"
              title="Build Forms"
              description="Create and manage questionnaires"
              onPress={() => navigate('Forms')}
              tintColor={colors.visualization.teal}
            />
            <View style={styles.toolGap} />
            <ToolCard
              icon="chart-box-outline"
              title="Analytics"
              description="Descriptive stats and data insights"
              onPress={() => navigate('Analytics')}
              tintColor={colors.visualization.cyan}
            />
          </View>

          {/* Row: View Responses | Response Links */}
          <View style={styles.toolRow}>
            <ToolCard
              icon="table-eye"
              title="Responses"
              description="Review submitted responses"
              onPress={() => navigate('Responses', true)}
              tintColor={colors.visualization.orange}
            />
            <View style={styles.toolGap} />
            <ToolCard
              icon="link-variant"
              title="Web Links"
              description="Share surveys via web links"
              onPress={() => navigate('ResponseLinks', true)}
              tintColor={colors.visualization.indigo}
            />
          </View>

          {/* Row: Bundle Stats | Project Members */}
          <View style={styles.toolRow}>
            <ToolCard
              icon="checkbox-multiple-marked-outline"
              title="Bundle Stats"
              description="Track bundle completion rates"
              onPress={() => navigate('BundleCompletion', true)}
              tintColor={colors.visualization.teal}
            />
            <View style={styles.toolGap} />
            <ToolCard
              icon="account-group-outline"
              title="Members"
              description="Manage team collaborators"
              onPress={() => navigate('Members')}
              tintColor={colors.visualization.blue}
            />
          </View>

          {/* Featured: Sync & Backup */}
          <ToolCard
            icon="cloud-sync-outline"
            title="Sync & Backup"
            description="Sync data with the cloud and manage offline access"
            onPress={() => navigate('Sync')}
            featured
            tintColor={colors.visualization.amber}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // ── Skeleton
  skeletonHero: {
    height: 200,
    backgroundColor: colors.primary.dark,
    marginBottom: spacing.md,
  },

  // ── Hero
  hero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heroBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroBackText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  heroEditBtn: {
    padding: spacing.xs,
  },
  heroContent: {
    marginBottom: spacing.md,
  },
  heroName: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(217,119,6,0.15)',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.3)',
    marginBottom: spacing.sm,
  },
  offlinePillText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.status.warning,
  },
  statBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: '#fff',
    lineHeight: typography.fontSize.xl + 4,
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // ── Tools
  toolsSection: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  toolsTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: spacing.md,
  },
  toolRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  toolGap: {
    width: spacing.sm,
  },
});

export default React.memo(ProjectDetailsScreen);
