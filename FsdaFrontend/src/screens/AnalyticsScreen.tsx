import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator, Icon } from 'react-native-paper';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { analyticsService } from '../services/analyticsService';
import { apiService } from '../services/api';
import CustomAnalyticsTab from '../components/analytics/CustomAnalyticsTab';

type AnalyticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Analytics'>;
type AnalyticsScreenRouteProp = RouteProp<RootStackParamList, 'Analytics'>;

interface AnalyticsStats {
  total_responses: number;
  unique_respondents: number;
  unique_questions: number;
  response_types_count: number;
  earliest_response: string | null;
  latest_response: string | null;
  avg_quality_score: number;
  validated_responses: number;
  responses_with_location: number;
  validation_rate: number;
  location_coverage: number;
}

interface ResponseTypeBreakdown {
  display_name: string;
  data_type: string;
  count: number;
}

interface AnalysisSummary {
  summary: AnalyticsStats;
  response_types: ResponseTypeBreakdown[];
}

type AnalyticsView = 'overview' | 'custom';

// Bar chart colors cycling through the design palette
const BAR_COLORS = [
  colors.primary.main,
  colors.accent.main,
  colors.status.info,
  colors.status.error,
  colors.status.success,
  '#7C3AED',
  '#0D9488',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TabBar: React.FC<{
  active: AnalyticsView;
  onChange: (v: AnalyticsView) => void;
}> = ({ active, onChange }) => (
  <View style={tabStyles.container}>
    {(['overview', 'custom'] as AnalyticsView[]).map(tab => {
      const isActive = active === tab;
      const label = tab === 'overview' ? 'Overview' : 'Analytics';
      return (
        <TouchableOpacity
          key={tab}
          style={tabStyles.tab}
          activeOpacity={0.7}
          onPress={() => onChange(tab)}
        >
          <Text style={[tabStyles.label, isActive && tabStyles.labelActive]}>
            {label}
          </Text>
          {isActive && <View style={tabStyles.indicator} />}
        </TouchableOpacity>
      );
    })}
  </View>
);

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  label: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  labelActive: {
    color: colors.primary.main,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.primary.main,
  },
});

// ── Stat card ────────────────────────────────────────────────────────────────
const SumCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  full?: boolean;
}> = ({ label, value, sub, accent = colors.text.primary, full }) => (
  <View style={[sumStyles.card, full && sumStyles.cardFull]}>
    <Text style={sumStyles.label}>{label}</Text>
    <Text style={[sumStyles.value, { color: accent }]}>{value}</Text>
    {sub ? <Text style={sumStyles.sub}>{sub}</Text> : null}
  </View>
);

const sumStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 14,
  },
  cardFull: {
    flex: undefined,
    width: '100%',
  },
  label: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  value: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 28,
    lineHeight: 32,
    color: colors.text.primary,
  },
  sub: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 4,
  },
});

// ── Horizontal bar chart row ─────────────────────────────────────────────────
const BarRow: React.FC<{ label: string; pct: number; count: number; color: string }> = ({
  label,
  pct,
  count,
  color,
}) => (
  <View style={barStyles.row}>
    <Text style={barStyles.label} numberOfLines={1}>{label}</Text>
    <View style={barStyles.track}>
      <View style={[barStyles.fill, { width: `${Math.max(pct, 1)}%`, backgroundColor: color }]} />
    </View>
    <Text style={barStyles.val}>{count}</Text>
  </View>
);

const barStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  label: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    width: 80,
    textAlign: 'right',
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.round,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: borderRadius.round,
  },
  val: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    width: 28,
    textAlign: 'right',
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<AnalyticsScreenNavigationProp>();
  const route = useRoute<AnalyticsScreenRouteProp>();
  const { projectId } = route.params || {};
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('overview');
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');

  const loadAnalyticsSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await analyticsService.getDataSummary(projectId);
      if (summary.status === 'success') {
        setAnalysisSummary(summary.data);
      } else {
        setError(summary.message || 'Failed to load analytics data');
      }
    } catch (err: any) {
      console.error('Error loading analytics summary:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadProjectName = useCallback(async () => {
    if (!projectId) return;
    try {
      const project = await apiService.getProject(projectId);
      setProjectName(project.name);
    } catch (error) {
      console.error('Error loading project name:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadProjectName();
      loadAnalyticsSummary();
    }
  }, [projectId, loadProjectName, loadAnalyticsSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalyticsSummary();
    setRefreshing(false);
  }, [loadAnalyticsSummary]);

  const formatNumber = (value: any, decimals: number = 2): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return typeof value === 'number' ? value.toFixed(decimals) : String(value);
  };

  // ── Overview tab content ───────────────────────────────────────────────────
  const renderOverview = () => {
    if (!analysisSummary) {
      return (
        <View style={styles.emptyState}>
          <Icon source="chart-bar" size={40} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyBody}>Collect some responses to see analytics here.</Text>
        </View>
      );
    }

    const { summary, response_types } = analysisSummary;

    // Total for bar chart percentages
    const typeTotal = response_types?.reduce((s, t) => s + (t.count || 0), 0) || 1;

    return (
      <>
        {/* ── 2×2 stat grid ────────────────────────────────────────────── */}
        <View style={styles.statGrid}>
          <SumCard
            label="Total Respondents"
            value={(summary?.unique_respondents || 0).toLocaleString()}
            accent={colors.primary.main}
          />
          <SumCard
            label="Avg Responses"
            value={
              summary?.unique_respondents && summary?.total_responses
                ? formatNumber(summary.total_responses / summary.unique_respondents, 1)
                : '0'
            }
            sub="per respondent"
          />
        </View>
        <View style={[styles.statGrid, { marginTop: 10 }]}>
          <SumCard
            label="Questions Covered"
            value={(summary?.unique_questions || 0).toLocaleString()}
            accent={colors.status.info}
          />
          <SumCard
            label="Avg Quality"
            value={`${formatNumber(summary?.avg_quality_score, 1)}%`}
            accent={colors.status.success}
          />
        </View>

        {/* ── Quality metrics row ───────────────────────────────────────── */}
        <View style={[styles.statGrid, { marginTop: 10 }]}>
          <SumCard
            label="Validation Rate"
            value={`${formatNumber(summary?.validation_rate, 1)}%`}
            accent={colors.accent.main}
          />
          <SumCard
            label="Location Coverage"
            value={`${formatNumber(summary?.location_coverage, 1)}%`}
            accent={colors.accent.dark}
          />
        </View>

        {/* ── Response type bar chart ───────────────────────────────────── */}
        {response_types && response_types.length > 0 && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <View style={styles.cardAccentBar} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Response Type Breakdown</Text>
              <View style={styles.barChartContainer}>
                {response_types.map((type, idx) => {
                  const pct = Math.round((type.count / typeTotal) * 100);
                  return (
                    <BarRow
                      key={idx}
                      label={type.display_name || type.data_type}
                      pct={pct}
                      count={type.count}
                      color={BAR_COLORS[idx % BAR_COLORS.length]}
                    />
                  );
                })}
              </View>
              <Text style={styles.chartFootnote}>
                {typeTotal.toLocaleString()} total responses across {response_types.length} question types
              </Text>
            </View>
          </View>
        )}

        {/* ── Collection period ────────────────────────────────────────── */}
        {summary?.earliest_response && (
          <View style={[styles.card, { marginTop: 10 }]}>
            <View style={[styles.cardAccentBar, { backgroundColor: colors.accent.main }]} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Collection Period</Text>
              <View style={styles.periodRow}>
                <View style={styles.periodDate}>
                  <Text style={styles.periodLabel}>Start</Text>
                  <Text style={styles.periodValue}>
                    {new Date(summary.earliest_response).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.periodDivider} />
                <View style={styles.periodDate}>
                  <Text style={styles.periodLabel}>Latest</Text>
                  <Text style={styles.periodValue}>
                    {summary.latest_response
                      ? new Date(summary.latest_response).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : 'Present'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── CTA to analytics tab ─────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.ctaCard}
          activeOpacity={0.85}
          onPress={() => setAnalyticsView('custom')}
        >
          <View style={styles.ctaLeft}>
            <Icon source="chart-box-outline" size={22} color={colors.primary.main} />
            <View style={styles.ctaText}>
              <Text style={styles.ctaTitle}>Run Custom Analysis</Text>
              <Text style={styles.ctaSub}>Descriptive · Inferential · Qualitative</Text>
            </View>
          </View>
          <Icon source="chevron-right" size={20} color={colors.primary.main} />
        </TouchableOpacity>
      </>
    );
  };

  // ── Loading / Error full screens ───────────────────────────────────────────
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon source="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Analytics</Text>
          {projectName ? (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{projectName}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.headerIconBtn}
          activeOpacity={0.7}
          onPress={onRefresh}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon source="refresh" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading analytics…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (error && !analysisSummary) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <View style={styles.errorIconWrap}>
            <Icon source="alert-circle-outline" size={40} color={colors.status.error} />
          </View>
          <Text style={styles.errorTitle}>Failed to Load</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={loadAnalyticsSummary}>
            <Icon source="refresh" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* Header */}
      {renderHeader()}

      {/* Tab bar */}
      <TabBar active={analyticsView} onChange={setAnalyticsView} />

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {analyticsView === 'overview' ? renderOverview() : (
          <CustomAnalyticsTab projectId={projectId} />
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: '#FFFFFF',
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ───────────────────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 80,
  },

  // ── Loading / Error ──────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorIconWrap: {
    marginBottom: spacing.md,
  },
  errorTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary.main,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: borderRadius.round,
  },
  retryBtnText: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── Stat grid ────────────────────────────────────────────────────────────
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAccentBar: {
    width: 4,
    backgroundColor: colors.primary.main,
  },
  cardBody: {
    flex: 1,
    padding: 14,
  },
  cardTitle: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginBottom: 12,
  },

  // ── Bar chart ────────────────────────────────────────────────────────────
  barChartContainer: {
    gap: 0,
  },
  chartFootnote: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 8,
  },

  // ── Period card ──────────────────────────────────────────────────────────
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  periodDate: {
    flex: 1,
  },
  periodLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  periodValue: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  periodDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
  },

  // ── CTA card ─────────────────────────────────────────────────────────────
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.muted,
    padding: 14,
    marginTop: 10,
    gap: 12,
  },
  ctaLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaText: {
    flex: 1,
  },
  ctaTitle: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.md,
    color: colors.primary.dark,
  },
  ctaSub: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
    marginTop: 2,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'DMSans-SemiBold',
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
  },
  emptyBody: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default React.memo(AnalyticsScreen);
