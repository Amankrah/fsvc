import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import {
  Text,
  ActivityIndicator,
  Card,
  Searchbar,
  Chip,
  DataTable,
  Menu,
  IconButton,
} from 'react-native-paper';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import apiService from '../services/api';
import { RootStackParamList } from '../navigation/RootNavigator';

type ResponsesRouteProp = RouteProp<RootStackParamList, 'Responses'>;

interface Respondent {
  id: string;
  respondent_id: string;
  name?: string;
  email?: string;
  created_at: string;
  last_response_at?: string;
  response_count: number;
  completion_rate: number;
}

interface QuestionDetail {
  id: string;
  question_text: string;
  response_type: string;
}

interface ResponseDetail {
  response_id: string;
  question: string;
  question_details: QuestionDetail;
  response_value: string;
  collected_at: string;
  is_validated: boolean;
}

const ResponsesScreen: React.FC = () => {
  const route = useRoute<ResponsesRouteProp>();
  const { projectId, projectName } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [filteredRespondents, setFilteredRespondents] = useState<Respondent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null);
  const [respondentResponses, setRespondentResponses] = useState<ResponseDetail[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [menuVisible, setMenuVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [itemsPerPage] = useState(50); // Server-side pagination: 50 items per page
  const [totalCount, setTotalCount] = useState(0); // Total count from server

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [page]) // Reload when page changes
  );

  const loadData = async () => {
    try {
      setLoading(true);
      await loadRespondents();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  };

  const loadRespondents = async () => {
    try {
      // Use server-side pagination: page is 0-indexed in UI but 1-indexed in API
      const apiPage = page + 1;
      const data = await apiService.getRespondents(projectId, apiPage, itemsPerPage);

      // Extract paginated data
      const respondentList = Array.isArray(data) ? data : data.results || [];
      const count = data.count || respondentList.length;

      console.log(`📊 Loaded page ${apiPage}: ${respondentList.length} respondents (${count} total)`);

      setRespondents(respondentList);
      setFilteredRespondents(respondentList);
      setTotalCount(count);
    } catch (error) {
      console.error('Error loading respondents:', error);
      throw error;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRespondents();
    } catch (error) {
      // Error already logged in loadRespondents
    }
    setRefreshing(false);
  };

  const loadRespondentResponses = async (respondentId: string) => {
    try {
      setLoading(true);
      const data = await apiService.getRespondentResponses(respondentId);
      setRespondentResponses(data.responses || []);
      setViewMode('detail');
    } catch (error) {
      console.error('Error loading respondent responses:', error);
      Alert.alert('Error', 'Failed to load respondent responses');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredRespondents(respondents);
      return;
    }

    const lowercaseQuery = query.toLowerCase();
    const filtered = respondents.filter(
      (r) =>
        r.respondent_id.toLowerCase().includes(lowercaseQuery) ||
        r.name?.toLowerCase().includes(lowercaseQuery) ||
        r.email?.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredRespondents(filtered);
    setPage(0);
  };

  const handleRespondentPress = async (respondent: Respondent) => {
    setSelectedRespondent(respondent);
    await loadRespondentResponses(respondent.id);
  };

  const handleBack = () => {
    setSelectedRespondent(null);
    setRespondentResponses([]);
    setViewMode('list');
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      setMenuVisible(false);

      const csvData = await apiService.exportResponses(projectId, 'csv');

      // For web, trigger download
      if (Platform.OS === 'web') {
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectName}_responses_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        Alert.alert('Success', 'Responses exported to CSV successfully');
      } else {
        // For mobile, use share functionality
        // This would require additional implementation with react-native-share
        Alert.alert('Export', 'CSV export feature is available on web platform');
      }
    } catch (error: any) {
      console.error('Error exporting responses:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to export responses');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      setExporting(true);
      setMenuVisible(false);

      const jsonData = await apiService.exportResponses(projectId, 'json');

      // For web, trigger download
      if (Platform.OS === 'web') {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${projectName}_responses_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        window.URL.revokeObjectURL(url);
        Alert.alert('Success', 'Responses exported to JSON successfully');
      } else {
        // For mobile, use share functionality
        Alert.alert('Export', 'JSON export feature is available on web platform');
      }
    } catch (error: any) {
      console.error('Error exporting responses:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to export responses');
    } finally {
      setExporting(false);
    }
  };

  const renderListView = () => {
    // Server-side pagination: display current page items directly
    const from = page * itemsPerPage;
    const to = Math.min(from + filteredRespondents.length, totalCount);

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4b1e85"
            colors={["#4b1e85"]}
          />
        }>
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {totalCount}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Total Respondents
              </Text>
            </Card.Content>
          </Card>

          <Card style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {respondents.reduce((sum, r) => sum + r.response_count, 0)}
              </Text>
              <Text variant="bodyMedium" style={styles.statLabel}>
                Responses (Current Page)
              </Text>
            </Card.Content>
          </Card>
        </View>

        <DataTable style={styles.dataTable}>
          <DataTable.Header style={styles.tableHeader}>
            <DataTable.Title textStyle={styles.headerText}>Respondent ID</DataTable.Title>
            <DataTable.Title textStyle={styles.headerText}>Name</DataTable.Title>
            <DataTable.Title textStyle={styles.headerText} numeric>
              Responses
            </DataTable.Title>
          </DataTable.Header>

          {filteredRespondents.map((respondent) => (
            <TouchableOpacity
              key={respondent.id}
              onPress={() => handleRespondentPress(respondent)}
              activeOpacity={0.7}
            >
              <DataTable.Row style={styles.tableRow}>
                <DataTable.Cell textStyle={styles.cellText}>
                  {respondent.respondent_id}
                </DataTable.Cell>
                <DataTable.Cell textStyle={styles.cellText}>
                  {respondent.name || 'Anonymous'}
                </DataTable.Cell>
                <DataTable.Cell textStyle={styles.cellText} numeric>
                  {respondent.response_count}
                </DataTable.Cell>
              </DataTable.Row>
            </TouchableOpacity>
          ))}

          <DataTable.Pagination
            page={page}
            numberOfPages={Math.ceil(totalCount / itemsPerPage)}
            onPageChange={setPage}
            label={`${from + 1}-${to} of ${totalCount}`}
            showFastPaginationControls
            numberOfItemsPerPage={itemsPerPage}
            style={styles.pagination}
            theme={{
              colors: {
                onSurface: '#ffffff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
              },
            }}
          />
        </DataTable>
      </ScrollView>
    );
  };

  const formatResponseValue = (response: ResponseDetail) => {
    const value = response.response_value;
    const questionType = response.question_details?.response_type;

    // Handle empty responses
    if (!value || value === 'null' || value === 'undefined') return 'No response';

    // Handle images - check for base64 data
    if (questionType === 'image') {
      console.log('Image detected:', { questionType, valueLength: value?.length, valueStart: value?.substring(0, 50) });
      // Check if it's a base64 string
      if (value.startsWith('data:image/') || value.startsWith('iVBOR') || value.startsWith('/9j/')) {
        const imageUri = value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
        return (
          <Image
            source={{ uri: imageUri }}
            style={styles.responseImage}
            resizeMode="contain"
            onError={(error) => console.error('Image load error:', error)}
            onLoad={() => console.log('Image loaded successfully')}
          />
        );
      }
      // If it's a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return (
          <Image
            source={{ uri: value }}
            style={styles.responseImage}
            resizeMode="contain"
            onError={(error) => console.error('Image load error:', error)}
            onLoad={() => console.log('Image loaded successfully')}
          />
        );
      }
      // Otherwise show as text
      console.log('Image data not recognized as valid format');
      return 'Image data';
    }

    // Handle location data
    if ((questionType === 'geopoint' || questionType === 'geoshape')) {
      try {
        const locationData = typeof value === 'string' ? JSON.parse(value) : value;
        return (
          <View style={styles.locationContainer}>
            {locationData.address && (
              <Text style={styles.locationText}>📍 {locationData.address}</Text>
            )}
            {locationData.latitude && locationData.longitude && (
              <Text style={styles.locationText}>
                GPS: {locationData.latitude}, {locationData.longitude}
              </Text>
            )}
          </View>
        );
      } catch (e) {
        return value;
      }
    }

    // Handle date/datetime
    if ((questionType === 'date' || questionType === 'datetime')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return questionType === 'datetime'
            ? date.toLocaleString()
            : date.toLocaleDateString();
        }
        return value;
      } catch (e) {
        return value;
      }
    }

    // Handle multiple choice (JSON arrays) and other arrays
    if (questionType === 'choice_multiple' || (typeof value === 'string' && value.trim().startsWith('['))) {
      try {
        const choices = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(choices)) {
          return (
            <View style={styles.multiChoiceContainer}>
              {choices.map((choice, index) => (
                <Chip
                  key={index}
                  style={styles.choiceChip}
                  textStyle={styles.choiceChipText}
                  mode="outlined"
                >
                  {choice}
                </Chip>
              ))}
            </View>
          );
        }
        return value;
      } catch (e) {
        return value;
      }
    }

    // Handle JSON objects
    if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
      try {
        const jsonData = JSON.parse(value);
        return JSON.stringify(jsonData, null, 2);
      } catch (e) {
        return value;
      }
    }

    // Default: return as text
    return value;
  };

  const renderDetailView = () => {
    if (!selectedRespondent) return null;

    return (
      <>
        <View style={styles.detailHeader}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="#ffffff"
            onPress={handleBack}
          />
          <View style={styles.detailHeaderInfo}>
            <Text variant="titleLarge" style={styles.detailTitle}>
              {selectedRespondent.name || 'Anonymous'}
            </Text>
            <Text variant="bodyMedium" style={styles.detailSubtitle}>
              ID: {selectedRespondent.respondent_id}
            </Text>
          </View>
        </View>

        <View style={styles.detailStats}>
          <Chip style={styles.detailChip} textStyle={styles.chipText}>
            📊 {selectedRespondent.response_count} Responses
          </Chip>
          <Chip style={styles.detailChip} textStyle={styles.chipText}>
            🆔 {selectedRespondent.respondent_id}
          </Chip>
        </View>

        <ScrollView 
          style={[styles.responsesContainer, { flex: 1 }]}
          contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#4b1e85"
              colors={["#4b1e85"]}
            />
          }>
          {respondentResponses.map((response) => {
            const formattedValue = formatResponseValue(response);
            const isImage = response.question_details?.response_type === 'image';

            return (
              <Card key={response.response_id} style={styles.responseCard}>
                <Card.Content>
                  <View style={styles.responseHeader}>
                    <Text variant="labelLarge" style={styles.questionLabel}>
                      {response.question_details?.question_text || 'Question'}
                    </Text>
                    {response.is_validated && (
                      <Chip
                        style={styles.validatedChip}
                        textStyle={styles.validatedChipText}
                        icon="check-circle"
                      >
                        Validated
                      </Chip>
                    )}
                  </View>
                  {isImage ? (
                    formattedValue
                  ) : (
                    <Text variant="bodyLarge" style={styles.responseValue}>
                      {formattedValue}
                    </Text>
                  )}
                  <Text variant="bodySmall" style={styles.responseTime}>
                    {new Date(response.collected_at).toLocaleString()}
                  </Text>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      </>
    );
  };

  if (loading && respondents.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading responses...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text variant="headlineSmall" style={styles.title}>
            {viewMode === 'list' ? 'Responses' : 'Response Details'}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {projectName}
          </Text>
        </View>

        {viewMode === 'list' && (
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <IconButton
                icon="dots-vertical"
                size={24}
                iconColor="#ffffff"
                onPress={() => setMenuVisible(true)}
              />
            }
            contentStyle={styles.menuContent}
          >
            <Menu.Item
              onPress={handleExportCSV}
              title="Export to CSV"
              leadingIcon="file-delimited"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={handleExportJSON}
              title="Export to JSON"
              leadingIcon="code-json"
              titleStyle={styles.menuItemText}
            />
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                loadData();
              }}
              title="Refresh"
              leadingIcon="refresh"
              titleStyle={styles.menuItemText}
            />
          </Menu>
        )}
      </View>

      {viewMode === 'list' && (
        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="Search respondents..."
            onChangeText={handleSearch}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor="#64c8ff"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            theme={{
              colors: {
                onSurface: '#ffffff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                elevation: {
                  level3: 'rgba(75, 30, 133, 0.3)',
                },
              },
            }}
          />
        </View>
      )}

      <View style={styles.content}>
        {viewMode === 'list' ? renderListView() : renderDetailView()}
      </View>

      {exporting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Exporting...
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#4b1e85',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 28,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    fontSize: 16,
  },
  menuContent: {
    backgroundColor: '#1a1a3a',
  },
  menuItemText: {
    color: '#ffffff',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#0f0f23',
  },
  searchBar: {
    backgroundColor: 'rgba(75, 30, 133, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  searchInput: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    color: '#64c8ff',
    fontWeight: 'bold',
    fontSize: 32,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    textAlign: 'center',
  },
  dataTable: {
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
  },
  headerText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tableRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.2)',
  },
  cellText: {
    color: '#ffffff',
    fontSize: 14,
  },
  pagination: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailHeaderInfo: {
    flex: 1,
    marginLeft: 8,
  },
  detailTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  detailSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  detailStats: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  detailChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  chipText: {
    color: '#64c8ff',
  },
  responsesContainer: {
    flex: 1,
  },
  responseCard: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
    marginBottom: 12,
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionLabel: {
    color: '#64c8ff',
    flex: 1,
    marginRight: 8,
  },
  validatedChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    height: 28,
  },
  validatedChipText: {
    color: '#4caf50',
    fontSize: 11,
  },
  responseValue: {
    color: '#ffffff',
    marginBottom: 8,
  },
  responseTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  responseImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  locationContainer: {
    marginBottom: 8,
  },
  locationText: {
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 4,
  },
  multiChoiceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  choiceChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.4)',
  },
  choiceChipText: {
    color: '#64c8ff',
    fontSize: 13,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
});

export default ResponsesScreen;