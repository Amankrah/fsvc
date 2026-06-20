import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Text, Icon, Searchbar } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiService from '../services/api';
import { offlineProjectCache, networkMonitor } from '../services';
import { useToast } from '../components/Toast';
import { Project } from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { SkeletonProjectCard } from '../components/Skeleton';

type CollectStackParamList = {
  Collect: undefined;
  DataCollection: { projectId: string; projectName: string };
};

const CollectScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<CollectStackParamList>>();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const online = await networkMonitor.checkConnection();
      let list: Project[] = [];
      if (online) {
        try {
          const data = await apiService.getProjects();
          list = Array.isArray(data) ? data : (data as any).results || [];
          await offlineProjectCache.cacheProjects(list);
          setIsOffline(false);
        } catch (err) {
          list = await offlineProjectCache.getProjects();
          setIsOffline(true);
        }
      } else {
        list = await offlineProjectCache.getProjects();
        setIsOffline(true);
      }
      const active = list.filter(p => p.membership_status !== 'pending');
      setProjects(active);
      setFilteredProjects(active);
    } catch (error) {
      console.error('Error loading projects for Collect:', error);
      showToast({ message: 'Failed to load projects', variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProjects();
  }, [loadProjects]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    const term = q.trim().toLowerCase();
    if (!term) {
      setFilteredProjects(projects);
    } else {
      setFilteredProjects(
        projects.filter(
          p =>
            p.name.toLowerCase().includes(term) ||
            (p.description ?? '').toLowerCase().includes(term)
        )
      );
    }
  }, [projects]);

  const handleSelectProject = useCallback((project: Project) => {
    navigation.navigate('DataCollection', {
      projectId: project.id,
      projectName: project.name,
    });
  }, [navigation]);

  const renderCard = ({ item }: { item: Project }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => handleSelectProject(item)}
    >
      <View style={styles.accentBar} />

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.projectName} numberOfLines={1}>{item.name}</Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            ) : null}
          </View>
          <View style={styles.cardIconTile}>
            <Icon source="clipboard-edit-outline" size={20} color={colors.primary.main} />
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{item.question_count ?? 0}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={[styles.statCell, styles.statCellBorder]}>
            <Text style={styles.statValue}>{item.response_count ?? 0}</Text>
            <Text style={styles.statLabel}>Responses</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{item.team_members_count ?? 1}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={() => handleSelectProject(item)}>
          <Icon source="play-circle" size={16} color="#fff" />
          <Text style={styles.ctaBtnText}>Collect Data</Text>
          <Icon source="arrow-right" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      <LinearGradient
        colors={[colors.primary.dark, colors.primary.main]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
      >
        <Text style={styles.heroTitle}>Collect</Text>
        <Text style={styles.heroSubtitle}>Pick a project to start a survey session</Text>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Icon source="wifi-off" size={14} color="#fff" />
            <Text style={styles.offlineBannerText}>Offline — showing cached projects</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search projects..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
          elevation={0}
        />
      </View>

      {loading ? (
        <View style={styles.skeletonWrap}>
          <SkeletonProjectCard />
          <SkeletonProjectCard />
          <SkeletonProjectCard />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
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
              <View style={styles.emptyIconTile}>
                <Icon source="clipboard-text-outline" size={32} color={colors.primary.main} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No projects match' : 'No Projects Yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'Open the Home tab and create your first project to start collecting responses.'}
              </Text>
            </View>
          }
        />
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: 'Fraunces-Regular',
    fontSize: typography.fontSize.md,
    color: 'rgba(255,255,255,0.75)',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  offlineBannerText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: '#fff',
  },

  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.default,
  },
  searchbar: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    elevation: 0,
  },
  searchInput: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },

  skeletonWrap: {
    padding: spacing.lg,
  },

  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },

  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    width: '100%',
    backgroundColor: colors.primary.main,
  },
  cardBody: {
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardIconTile: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  description: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  statRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statCellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border.light,
  },
  statValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: colors.text.primary,
    lineHeight: typography.fontSize.xxl + 4,
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
  },
  ctaBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: '#fff',
    letterSpacing: 0.2,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
  },
  emptyIconTile: {
    width: 72,
    height: 72,
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
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default React.memo(CollectScreen);
