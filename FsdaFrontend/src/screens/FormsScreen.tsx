import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Icon,
  Searchbar,
  ActivityIndicator,
  Menu,
  Divider,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiService from '../services/api';
import { useToast } from '../components/Toast';
import { Project, Question } from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonProjectCard } from '../components/Skeleton';
import { LinearGradient } from 'expo-linear-gradient';

const FormsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();

  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { showToast } = useToast();

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
      showToast({ message: 'Failed to load projects', variant: 'error' });
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
      const questionList: Question[] = Array.isArray(questions) ? questions : questions.results || [];
      const ownerQuestions = questionList.filter(q => q.is_owner_question !== false);
      const partnerQuestions = questionList.filter(q => q.is_owner_question === false);
      const message = questionList.length > 0
        ? `Total: ${questionList.length} question${questionList.length !== 1 ? 's' : ''}\n` +
          `Owner: ${ownerQuestions.length}\n` +
          `Partner: ${partnerQuestions.length}`
        : 'This form has no questions yet';
      Alert.alert('Form Questions', message, [{ text: 'OK' }]);
    } catch (error) {
      showToast({ message: 'Failed to load questions', variant: 'error' });
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

  const renderProjectCard = ({ item }: { item: Project }) => {
    const syncColor =
      item.sync_status === 'synced' ? colors.sync.synced :
      item.sync_status === 'pending' ? colors.sync.pending :
      item.sync_status === 'error' ? colors.sync.error :
      colors.sync.offline;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.92}
        onPress={() => handleEditForm(item)}
      >
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: syncColor }]} />

        <View style={styles.cardBody}>
          {/* Title row */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName} numberOfLines={1}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </View>

            <Menu
              visible={menuVisible[item.id] || false}
              onDismiss={() => closeMenu(item.id)}
              contentStyle={styles.menuContent}
              anchor={
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() => openMenu(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon source="dots-vertical" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              }
            >
              <Menu.Item
                leadingIcon="eye-outline"
                onPress={() => handleViewQuestions(item.id)}
                title="View Questions"
                titleStyle={styles.menuItemText}
              />
              <Divider style={styles.menuDivider} />
              <Menu.Item
                leadingIcon="pencil-outline"
                onPress={() => handleEditForm(item)}
                title="Edit Form"
                titleStyle={styles.menuItemText}
              />
            </Menu>
          </View>

          {/* Chips row */}
          <View style={styles.chipRow}>
            {item.sync_status === 'synced' && (
              <View style={[styles.chip, { backgroundColor: colors.sync.syncedSurface }]}>
                <Text style={[styles.chipText, { color: colors.sync.synced }]}>Synced</Text>
              </View>
            )}
            {item.sync_status === 'pending' && (
              <View style={[styles.chip, { backgroundColor: colors.sync.pendingSurface }]}>
                <Text style={[styles.chipText, { color: colors.sync.pending }]}>Pending</Text>
              </View>
            )}
            {item.has_partners && (
              <View style={[styles.chip, { backgroundColor: colors.status.infoSurface }]}>
                <Text style={[styles.chipText, { color: colors.status.info }]}>Partners</Text>
              </View>
            )}
          </View>

          {/* Stat row */}
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

          {/* Build Form CTA */}
          <TouchableOpacity style={styles.ctaBtn} onPress={() => handleEditForm(item)}>
            <Text style={styles.ctaBtnText}>Build Form</Text>
            <Icon source="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.primary.dark, colors.primary.main]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}
      >
        <View style={styles.heroNav}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="chevron-left" size={24} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Forms</Text>
        <Text style={styles.heroSubtitle}>Build and manage questionnaires</Text>
      </LinearGradient>

      {/* ── Search ──────────────────────────────────────────────────────── */}
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

      {/* ── List ────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          <SkeletonProjectCard />
          <SkeletonProjectCard />
          <SkeletonProjectCard />
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderProjectCard}
          keyExtractor={(item) => item.id}
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
                <Icon source="file-document-edit-outline" size={32} color={colors.primary.main} />
              </View>
              <Text style={styles.emptyTitle}>No Projects Found</Text>
              <Text style={styles.emptyBody}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create a project from the Home tab to start building forms'}
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

  // ── Hero
  hero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: '#fff',
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

  // ── Search
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

  // ── List
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },

  // ── Card
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
  },
  cardBody: {
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  menuBtn: {
    padding: 4,
    marginLeft: spacing.sm,
  },
  menuContent: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  menuItemText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.primary,
  },
  menuDivider: {
    backgroundColor: colors.border.light,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  chip: {
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
  },

  // ── Stat row
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

  // ── CTA button
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

  // ── Empty state
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

export default React.memo(FormsScreen);
