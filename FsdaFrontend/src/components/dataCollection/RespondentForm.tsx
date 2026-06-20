/**
 * RespondentForm Component
 * Initial form to capture respondent information and generate questions
 */

import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Text,
  TextInput,
  Switch,
  ActivityIndicator,
  Icon,
} from 'react-native-paper';
import { RespondentType, CommodityType } from '../../types';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface PrepareAllProgress {
  current: number;
  total: number;
  label: string;
  generated: number;
  cached: number;
  skipped: number;
}

interface RespondentFormProps {
  // Respondent state
  respondentId: string;
  setRespondentId: (id: string) => void;
  useAutoId: boolean;
  handleToggleAutoId: (enabled: boolean) => void;
  selectedRespondentType: RespondentType | '';
  setSelectedRespondentType: (type: RespondentType | '') => void;
  selectedCommodities: CommodityType[];
  toggleCommodity: (commodity: CommodityType) => void;
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  generateNewRespondentId: () => void;

  // Question state
  availableRespondentTypes: Array<{ value: string; display: string }>;
  availableCommodities: Array<{ value: string; display: string }>;
  availableCountries: string[];
  loadingOptions: boolean;
  generatingQuestions: boolean;
  questionsGenerated: boolean;
  cachingForOffline?: boolean;
  cachedOfflineCount?: number;
  loadingQuestions?: boolean;

  // Prepare All for Offline
  preparingAll?: boolean;
  prepareAllProgress?: PrepareAllProgress | null;
  onPrepareAllForOffline?: () => void;

  // Actions
  onGenerateQuestions: () => void;
  onStartSurvey: () => void;
  onCacheForOffline?: () => void;
}

export const RespondentForm: React.FC<RespondentFormProps> = ({
  respondentId,
  setRespondentId,
  useAutoId,
  handleToggleAutoId,
  selectedRespondentType,
  setSelectedRespondentType,
  selectedCommodities,
  toggleCommodity,
  selectedCountry,
  setSelectedCountry,
  generateNewRespondentId,
  availableRespondentTypes,
  availableCommodities,
  availableCountries,
  loadingOptions,
  generatingQuestions,
  questionsGenerated,
  cachingForOffline = false,
  cachedOfflineCount = 0,
  loadingQuestions = false,
  preparingAll = false,
  prepareAllProgress = null,
  onPrepareAllForOffline,
  onGenerateQuestions,
  onStartSurvey,
  onCacheForOffline,
}) => {
  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      {/* ── Respondent Identification ────────────────────────────────────── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Respondent Identification</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Auto-generate Respondent ID</Text>
          <Switch value={useAutoId} onValueChange={handleToggleAutoId} color={colors.primary.main} />
        </View>

        {useAutoId ? (
          /* Display pill — read-only ID with refresh button */
          <View style={styles.idDisplay}>
            <View style={{ flex: 1 }}>
              <Text style={styles.idLabel}>Respondent ID</Text>
              <Text style={styles.idValue} numberOfLines={1}>
                {respondentId || 'Generating…'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={generateNewRespondentId}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon source="refresh" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        ) : (
          /* Editable input — shown when user disables auto-generate */
          <TextInput
            label="Respondent ID"
            value={respondentId}
            onChangeText={setRespondentId}
            mode="outlined"
            style={styles.input}
            textColor={colors.text.primary}
            theme={{
              colors: {
                primary: colors.primary.main,
                onSurfaceVariant: colors.text.secondary,
                outline: colors.border.light,
              },
            }}
          />
        )}
      </View>

      {/* ── Respondent Profile ───────────────────────────────────────────── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Respondent Profile</Text>

        {loadingOptions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary.main} />
            <Text style={styles.loadingText}>Loading available options…</Text>
          </View>
        ) : (
          <>
            {/* Respondent Type */}
            <Text style={styles.fieldLabel}>Respondent Type *</Text>
            <View style={styles.chipGrid}>
              {availableRespondentTypes.map((type) => {
                const selected = selectedRespondentType === type.value;
                return (
                  <TouchableOpacity
                    key={type.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() =>
                      setSelectedRespondentType(
                        selectedRespondentType === type.value ? '' : (type.value as RespondentType)
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {type.display}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Commodities */}
            <Text style={styles.fieldLabel}>Commodities (Optional - Multi-select)</Text>
            <View style={styles.chipGrid}>
              {availableCommodities.map((commodity) => {
                const selected = selectedCommodities.includes(commodity.value as CommodityType);
                return (
                  <TouchableOpacity
                    key={commodity.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleCommodity(commodity.value as CommodityType)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {commodity.display}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Country */}
            <Text style={styles.fieldLabel}>Country (Optional)</Text>
            <View style={styles.chipGrid}>
              {availableCountries.slice(0, 10).map((country) => {
                const selected = selectedCountry === country;
                return (
                  <TouchableOpacity
                    key={country}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSelectedCountry(selectedCountry === country ? '' : country)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {country}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      {/* ── Action Buttons ───────────────────────────────────────────────── */}
      <View style={styles.actionsContainer}>
        {/* Generate Questions — disabled (greyed) when questions already exist */}
        {questionsGenerated ? (
          <View style={styles.questionsReadyBtn}>
            <Icon source="check-circle" size={18} color={colors.status.success} />
            <Text style={styles.questionsReadyText}>Questions Ready</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.generateBtn,
              (!selectedRespondentType || generatingQuestions || loadingOptions) &&
                styles.btnDisabled,
            ]}
            onPress={onGenerateQuestions}
            disabled={!selectedRespondentType || generatingQuestions || loadingOptions}
            activeOpacity={0.82}
          >
            {generatingQuestions ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.generateBtnText}>
                Generate Questions
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Cache for Offline — appears after generation */}
        {questionsGenerated && onCacheForOffline && (
          <TouchableOpacity
            style={[
              styles.cacheButton,
              (!selectedRespondentType || cachingForOffline || generatingQuestions) &&
                styles.btnDisabled,
            ]}
            onPress={onCacheForOffline}
            disabled={!selectedRespondentType || cachingForOffline || generatingQuestions}
            activeOpacity={0.82}
          >
            {cachingForOffline ? (
              <ActivityIndicator size="small" color={colors.primary.main} />
            ) : (
              <>
                <Icon source="download-circle" size={18} color={colors.primary.main} />
                <Text style={styles.cacheBtnText}>
                  {cachedOfflineCount > 0 ? 'Update Offline Cache' : 'Cache for Offline'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Start Survey — appears after generation */}
        {questionsGenerated && (
          <TouchableOpacity
            style={[styles.startButton, !respondentId && styles.btnDisabled]}
            onPress={onStartSurvey}
            disabled={!respondentId}
            activeOpacity={0.82}
          >
            <Icon source="play-circle" size={18} color="#fff" />
            <Text style={styles.startBtnText}>Start Survey</Text>
          </TouchableOpacity>
        )}

        {/* Prepare All for Offline — bulk generate + cache all profile combos */}
        {onPrepareAllForOffline && (
          <TouchableOpacity
            style={[
              styles.prepareAllBtn,
              (preparingAll || loadingOptions) && styles.btnDisabled,
            ]}
            onPress={onPrepareAllForOffline}
            disabled={preparingAll || loadingOptions}
            activeOpacity={0.82}
          >
            {preparingAll ? (
              <View style={styles.prepareAllProgressContainer}>
                <ActivityIndicator size="small" color={colors.accent.orange} />
                <View style={styles.prepareAllProgressInfo}>
                  <Text style={styles.prepareAllProgressLabel}>
                    {prepareAllProgress?.label || 'Preparing...'}
                  </Text>
                  {prepareAllProgress && (
                    <>
                      <View style={styles.prepareAllProgressTrack}>
                        <View
                          style={[
                            styles.prepareAllProgressFill,
                            {
                              width: `${prepareAllProgress.total > 0
                                ? (prepareAllProgress.current / prepareAllProgress.total) * 100
                                : 0}%` as any,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.prepareAllProgressStats}>
                        {prepareAllProgress.current}/{prepareAllProgress.total} — {prepareAllProgress.generated} generated, {prepareAllProgress.cached} cached
                        {prepareAllProgress.skipped > 0 && `, ${prepareAllProgress.skipped} skipped`}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            ) : (
              <>
                <Icon source="cloud-download" size={18} color={colors.accent.orange} />
                <Text style={styles.prepareAllBtnText}>Prepare All for Offline</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Status Banners ───────────────────────────────────────────────── */}
      {cachedOfflineCount > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📴 {cachedOfflineCount} questions cached offline</Text>
          <Text style={styles.offlineSubtext}>
            Available for: {selectedRespondentType}
            {selectedCommodities.length > 0 && ` - ${selectedCommodities.join(', ')}`}
            {selectedCountry && ` - ${selectedCountry}`}
          </Text>
        </View>
      )}

      {loadingQuestions && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={colors.primary.main} />
          <Text style={[styles.loadingText, { marginLeft: spacing.md }]}>
            Updating questions for new selection…
          </Text>
        </View>
      )}

      {!loadingQuestions && questionsGenerated && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✅ Questions are ready!</Text>
          <Text style={styles.successSubtext}>
            Questions have been generated for {selectedRespondentType}
            {selectedCommodities.length > 0 && ` - ${selectedCommodities.join(', ')}`}
            {selectedCountry && ` - ${selectedCountry}`}
          </Text>
        </View>
      )}

      <View style={{ height: spacing.huge }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  contentContainer: {
    paddingBottom: 100,
  },

  // ── Section cards — green-tinted, matching mockup
  sectionCard: {
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(29, 122, 82, 0.25)',
    margin: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: spacing.md,
  },

  // ── Switch row
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  switchLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.md,
  },

  // ── Respondent ID display pill (auto-generate ON)
  idDisplay: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  idLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  idValue: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // ── Editable ID input (auto-generate OFF)
  input: {
    backgroundColor: colors.background.paper,
  },

  // ── Chip field labels
  fieldLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // ── Chips
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.background.paper,
  },
  chipSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.surface,
  },
  chipText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    fontFamily: 'DMSans-Bold',
    color: colors.primary.main,
  },

  // ── Loading (inside Respondent Profile card)
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },

  // ── Action buttons
  actionsContainer: {
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  generateBtn: {
    backgroundColor: colors.primary.dark,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
generateBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  questionsReadyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    backgroundColor: colors.status.successSurface,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  questionsReadyText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.status.success,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  cacheButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    backgroundColor: colors.background.paper,
  },
  cacheBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.primary.main,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
  },
  startBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── Prepare All for Offline button
  prepareAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.accent.orange,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    backgroundColor: colors.background.paper,
    marginTop: spacing.sm,
  },
  prepareAllBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.accent.orange,
  },
  prepareAllProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    width: '100%',
  },
  prepareAllProgressInfo: {
    flex: 1,
  },
  prepareAllProgressLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.accent.orange,
    marginBottom: 4,
  },
  prepareAllProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  prepareAllProgressFill: {
    height: 4,
    backgroundColor: colors.accent.orange,
    borderRadius: 2,
  },
  prepareAllProgressStats: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // ── Status banners
  offlineBanner: {
    backgroundColor: 'rgba(100, 200, 255, 0.15)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.4)',
  },
  offlineText: {
    fontFamily: 'DMSans-Bold',
    color: colors.primary.main,
    fontSize: typography.fontSize.md,
    marginBottom: 4,
  },
  offlineSubtext: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
  },
  successBanner: {
    backgroundColor: colors.status.successSurface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  successText: {
    fontFamily: 'DMSans-Bold',
    color: colors.status.success,
    fontSize: typography.fontSize.md,
    marginBottom: 4,
  },
  successSubtext: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.infoSurface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
});
