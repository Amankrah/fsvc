/**
 * RespondentForm Component
 * Initial form to capture respondent information and generate questions
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Switch,
  Button,
  Chip,
  ActivityIndicator,
  Card,
  Divider,
} from 'react-native-paper';
import { RespondentType, CommodityType } from '../../types';

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

  // Actions
  onGenerateQuestions: () => void;
  onStartSurvey: () => void;
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
  onGenerateQuestions,
  onStartSurvey,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.card}>
        <Card.Content>
          {/* Respondent ID Section */}
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Respondent Identification
          </Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Auto-generate Respondent ID</Text>
            <Switch value={useAutoId} onValueChange={handleToggleAutoId} color="#64c8ff" />
          </View>

          <TextInput
            label="Respondent ID"
            value={respondentId}
            onChangeText={setRespondentId}
            disabled={useAutoId}
            mode="outlined"
            style={styles.input}
            textColor="#ffffff"
            theme={{
              colors: {
                primary: '#64c8ff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                outline: 'rgba(100, 200, 255, 0.5)',
              },
            }}
            right={
              useAutoId ? (
                <TextInput.Icon icon="refresh" onPress={generateNewRespondentId} />
              ) : null
            }
          />

          <Divider style={styles.divider} />

          {/* Respondent Profile Section */}
          <Text variant="titleLarge" style={styles.sectionTitle}>
            Respondent Profile
          </Text>

          {loadingOptions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#64c8ff" />
              <Text style={styles.loadingText}>Loading available options...</Text>
            </View>
          ) : (
            <>
              {/* Respondent Type */}
              <Text style={styles.label}>Respondent Type *</Text>
              <View style={styles.chipContainer}>
                {availableRespondentTypes.map((type) => (
                  <Chip
                    key={type.value}
                    selected={selectedRespondentType === type.value}
                    onPress={() =>
                      setSelectedRespondentType(
                        selectedRespondentType === type.value ? '' : (type.value as RespondentType)
                      )
                    }
                    style={[
                      styles.chip,
                      selectedRespondentType === type.value && styles.selectedChip,
                    ]}
                    textStyle={styles.chipText}>
                    {type.display}
                  </Chip>
                ))}
              </View>

              {/* Commodities */}
              <Text style={styles.label}>Commodities (Optional - Multi-select)</Text>
              <View style={styles.chipContainer}>
                {availableCommodities.map((commodity) => (
                  <Chip
                    key={commodity.value}
                    selected={selectedCommodities.includes(commodity.value as CommodityType)}
                    onPress={() => toggleCommodity(commodity.value as CommodityType)}
                    style={[
                      styles.chip,
                      selectedCommodities.includes(commodity.value as CommodityType) &&
                        styles.selectedChip,
                    ]}
                    textStyle={styles.chipText}>
                    {commodity.display}
                  </Chip>
                ))}
              </View>

              {/* Country */}
              <Text style={styles.label}>Country (Optional)</Text>
              <View style={styles.chipContainer}>
                {availableCountries.slice(0, 10).map((country) => (
                  <Chip
                    key={country}
                    selected={selectedCountry === country}
                    onPress={() => setSelectedCountry(selectedCountry === country ? '' : country)}
                    style={[styles.chip, selectedCountry === country && styles.selectedChip]}
                    textStyle={styles.chipText}>
                    {country}
                  </Chip>
                ))}
              </View>
            </>
          )}

          <Divider style={styles.divider} />

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={onGenerateQuestions}
              loading={generatingQuestions}
              disabled={!selectedRespondentType || generatingQuestions || loadingOptions}
              style={styles.generateButton}
              icon="auto-fix">
              {questionsGenerated ? 'Regenerate Questions' : 'Generate Questions'}
            </Button>

            {questionsGenerated && (
              <Button
                mode="contained"
                onPress={onStartSurvey}
                disabled={!respondentId}
                style={styles.startButton}
                icon="play-circle">
                Start Survey
              </Button>
            )}
          </View>

          {questionsGenerated && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✅ Questions are ready!</Text>
              <Text style={styles.successSubtext}>
                Questions have been generated for {selectedRespondentType}
                {selectedCommodities.length > 0 && ` - ${selectedCommodities.join(', ')}`}
                {selectedCountry && ` - ${selectedCountry}`}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  card: {
    margin: 16,
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  sectionTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#ffffff',
    fontSize: 14,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  divider: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 24,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.3)',
    borderColor: '#64c8ff',
  },
  chipText: {
    color: '#ffffff',
    fontSize: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 12,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  generateButton: {
    backgroundColor: '#4b1e85',
  },
  startButton: {
    backgroundColor: '#1976d2',
  },
  successBanner: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  successText: {
    color: '#81c784',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  successSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
});
