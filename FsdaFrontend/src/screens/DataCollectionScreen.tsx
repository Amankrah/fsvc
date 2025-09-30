import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  RadioButton,
  Checkbox,
  ActivityIndicator,
  Card,
  ProgressBar,
  Switch,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../services/api';
import { Question } from '../types';
import { RootStackParamList } from '../navigation/RootNavigator';
import { generateRespondentId } from '../utils/respondentIdGenerator';

type DataCollectionRouteProp = RouteProp<RootStackParamList, 'DataCollection'>;
type DataCollectionNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DataCollection'>;

interface ResponseData {
  [questionId: string]: string | string[];
}

const DataCollectionScreen: React.FC = () => {
  const route = useRoute<DataCollectionRouteProp>();
  const navigation = useNavigation<DataCollectionNavigationProp>();
  const { projectId, projectName } = route.params;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [responses, setResponses] = useState<ResponseData>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [respondentId, setRespondentId] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [showRespondentForm, setShowRespondentForm] = useState(true);
  const [useAutoId, setUseAutoId] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateQuestion, setCurrentDateQuestion] = useState<string | null>(null);
  const [manualDateInput, setManualDateInput] = useState({ year: '', month: '', day: '' });
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [currentLocationQuestion, setCurrentLocationQuestion] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState({ latitude: '', longitude: '', address: '' });

  useEffect(() => {
    loadQuestions();
    // Auto-generate respondent ID on mount
    if (useAutoId) {
      generateNewRespondentId();
    }
  }, []);

  const generateNewRespondentId = () => {
    const autoId = generateRespondentId(projectId);
    setRespondentId(autoId);
  };

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const data = await apiService.getQuestions(projectId);
      const questionList = Array.isArray(data) ? data : data.results || [];
      setQuestions(questionList.sort((a: Question, b: Question) => a.order_index - b.order_index));
    } catch (error: any) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondentSubmit = () => {
    if (!respondentId.trim()) {
      Alert.alert('Required', 'Please enter a Respondent ID');
      return;
    }
    setShowRespondentForm(false);
  };

  const handleToggleAutoId = (enabled: boolean) => {
    setUseAutoId(enabled);
    if (enabled) {
      generateNewRespondentId();
    } else {
      setRespondentId('');
    }
  };

  const handleResponseChange = (questionId: string, value: string | string[]) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion.is_required && !responses[currentQuestion.id]) {
      Alert.alert('Required', 'This question is required');
      return;
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    // Check if all required questions are answered
    const unansweredRequired = questions.filter(
      (q) => q.is_required && !responses[q.id]
    );

    if (unansweredRequired.length > 0) {
      Alert.alert(
        'Incomplete Form',
        `Please answer all required questions. ${unansweredRequired.length} required question(s) remaining.`
      );
      return;
    }

    try {
      setSubmitting(true);

      // First, create or get the respondent
      const respondentData = {
        respondent_id: respondentId,
        name: respondentName || null,
        project: projectId,
        is_anonymous: !respondentName,
        consent_given: true,
      };

      const respondent = await apiService.createRespondent(respondentData);

      // Submit all responses with better error handling
      const responsePromises = Object.entries(responses).map(async ([questionId, value]) => {
        const responseValue = Array.isArray(value) ? JSON.stringify(value) : value;
        const question = questions.find(q => q.id === questionId);

        try {
          return await apiService.submitResponse({
            project: projectId,
            question: questionId,
            respondent: respondent.id,
            response_value: responseValue,
            device_info: {
              platform: Platform.OS,
              app_version: '1.0.0',
            },
          });
        } catch (error: any) {
          console.error(`Error submitting response for question "${question?.question_text}":`, error);
          throw new Error(`Failed to submit response for: "${question?.question_text}". ${error.response?.data?.response_value?.[0] || error.message}`);
        }
      });

      await Promise.all(responsePromises);

      // Automatically reset for next respondent
      setResponses({});
      setShowRespondentForm(true);
      setCurrentQuestionIndex(0);
      setRespondentName('');
      if (useAutoId) {
        generateNewRespondentId();
      } else {
        setRespondentId('');
      }

      Alert.alert('Success', 'Response submitted successfully! Ready for next respondent.', [
        {
          text: 'Continue Collecting',
        },
        {
          text: 'Finish & Go Back',
          onPress: () => navigation.goBack(),
          style: 'cancel',
        },
      ]);
    } catch (error: any) {
      console.error('Error submitting responses:', error);
      const errorMessage = error.message || error.response?.data?.error || error.response?.data?.respondent_id?.[0] || 'Failed to submit responses';
      Alert.alert(
        'Error',
        errorMessage
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionInput = (question: Question) => {
    const responseValue = responses[question.id];

    switch (question.response_type) {
      case 'text_short':
        return (
          <TextInput
            value={(responseValue as string) || ''}
            onChangeText={(text) => handleResponseChange(question.id, text)}
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
          />
        );

      case 'text_long':
        return (
          <TextInput
            value={(responseValue as string) || ''}
            onChangeText={(text) => handleResponseChange(question.id, text)}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            textColor="#ffffff"
            theme={{
              colors: {
                primary: '#64c8ff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                outline: 'rgba(100, 200, 255, 0.5)',
              },
            }}
          />
        );

      case 'numeric_integer':
      case 'numeric_decimal':
        return (
          <TextInput
            value={(responseValue as string) || ''}
            onChangeText={(text) => handleResponseChange(question.id, text)}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
            textColor="#ffffff"
            theme={{
              colors: {
                primary: '#64c8ff',
                onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                outline: 'rgba(100, 200, 255, 0.5)',
              },
            }}
          />
        );

      case 'choice_single':
        return (
          <RadioButton.Group
            onValueChange={(value) => handleResponseChange(question.id, value)}
            value={(responseValue as string) || ''}
          >
            {question.options?.map((option, index) => (
              <View key={index} style={styles.radioOption}>
                <RadioButton.Android
                  value={option}
                  color="#64c8ff"
                  uncheckedColor="rgba(255, 255, 255, 0.5)"
                />
                <Text variant="bodyLarge" style={styles.optionText}>
                  {option}
                </Text>
              </View>
            ))}
          </RadioButton.Group>
        );

      case 'choice_multiple':
        const selectedOptions = (responseValue as string[]) || [];
        return (
          <View>
            {question.options?.map((option, index) => (
              <View key={index} style={styles.checkboxOption}>
                <Checkbox.Android
                  status={selectedOptions.includes(option) ? 'checked' : 'unchecked'}
                  onPress={() => {
                    const newSelection = selectedOptions.includes(option)
                      ? selectedOptions.filter((o) => o !== option)
                      : [...selectedOptions, option];
                    handleResponseChange(question.id, newSelection);
                  }}
                  color="#64c8ff"
                  uncheckedColor="rgba(255, 255, 255, 0.5)"
                />
                <Text variant="bodyLarge" style={styles.optionText}>
                  {option}
                </Text>
              </View>
            ))}
          </View>
        );

      case 'scale_rating':
        const maxScale = question.validation_rules?.max_value || 10;
        const minScale = question.validation_rules?.min_value || 1;
        return (
          <View style={styles.scaleContainer}>
            {Array.from({ length: maxScale - minScale + 1 }, (_, i) => i + minScale).map(
              (num) => (
                <Button
                  key={num}
                  mode={(responseValue as string) === num.toString() ? 'contained' : 'outlined'}
                  onPress={() => handleResponseChange(question.id, num.toString())}
                  style={styles.scaleButton}
                  labelStyle={styles.scaleButtonLabel}
                >
                  {num}
                </Button>
              )
            )}
          </View>
        );

      case 'date':
      case 'datetime':
        const dateValue = responseValue ? new Date(responseValue as string) : null;
        const isDateTime = question.response_type === 'datetime';

        let formattedDate = '';
        if (dateValue) {
          if (isDateTime) {
            formattedDate = dateValue.toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          } else {
            formattedDate = dateValue.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
          }
        }

        return (
          <View>
            <TouchableOpacity
              style={styles.dateButton}
               onPress={() => {
                 setCurrentDateQuestion(question.id);
                 const today = dateValue || new Date();
                setManualDateInput({
                  year: today.getFullYear().toString(),
                  month: (today.getMonth() + 1).toString().padStart(2, '0'),
                  day: today.getDate().toString().padStart(2, '0'),
                });
                setShowDatePicker(true);
              }}
            >
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateButtonText}>
                  {formattedDate || `Select ${isDateTime ? 'date & time' : 'date'}`}
                </Text>
                <Text style={styles.dateIcon}>📅</Text>
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'geopoint':
      case 'geoshape':
        const locationValue = responseValue
          ? (typeof responseValue === 'string' ? JSON.parse(responseValue as string) : responseValue)
          : null;

        let formattedLocation = '';
        if (locationValue) {
          if (locationValue.address) {
            formattedLocation = locationValue.address;
          } else if (locationValue.latitude && locationValue.longitude) {
            formattedLocation = `${locationValue.latitude}, ${locationValue.longitude}`;
          }
        }

        return (
          <View>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setCurrentLocationQuestion(question.id);
                if (locationValue) {
                  setLocationInput({
                    latitude: locationValue.latitude?.toString() || '',
                    longitude: locationValue.longitude?.toString() || '',
                    address: locationValue.address || '',
                  });
                } else {
                  setLocationInput({ latitude: '', longitude: '', address: '' });
                }
                setShowLocationDialog(true);
              }}
            >
              <View style={styles.dateButtonContent}>
                <Text style={styles.dateButtonText}>
                  {formattedLocation || 'Enter location'}
                </Text>
                <Text style={styles.dateIcon}>📍</Text>
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'image':
        const imageUri = responseValue as string;

        const pickImage = async () => {
          try {
            // Request permission
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission Required', 'Please allow access to your photo library');
              return;
            }

            // Launch image picker
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              quality: 0.7, // Compress to reduce size
              base64: true, // Get base64 for easy storage
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              // Store as base64 data URI
              const dataUri = `data:image/jpeg;base64,${asset.base64}`;
              handleResponseChange(question.id, dataUri);
            }
          } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image');
          }
        };

        const takePhoto = async () => {
          try {
            // Request permission
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
              Alert.alert('Permission Required', 'Please allow access to your camera');
              return;
            }

            // Launch camera
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.7,
              base64: true,
            });

            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              const dataUri = `data:image/jpeg;base64,${asset.base64}`;
              handleResponseChange(question.id, dataUri);
            }
          } catch (error) {
            console.error('Error taking photo:', error);
            Alert.alert('Error', 'Failed to take photo');
          }
        };

        return (
          <View>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                <View style={styles.imageActions}>
                  <Button
                    mode="outlined"
                    onPress={() => handleResponseChange(question.id, '')}
                    style={styles.imageActionButton}
                    icon="delete"
                  >
                    Remove
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={pickImage}
                    style={styles.imageActionButton}
                    icon="image"
                  >
                    Change
                  </Button>
                </View>
              </View>
            ) : (
              <View style={styles.imagePickerContainer}>
                <Button
                  mode="contained"
                  onPress={takePhoto}
                  style={[styles.imagePickerButton, { backgroundColor: '#4b1e85' }]}
                  icon="camera"
                >
                  Take Photo
                </Button>
                <Button
                  mode="contained"
                  onPress={pickImage}
                  style={[styles.imagePickerButton, { backgroundColor: '#64c8ff' }]}
                  icon="image"
                >
                  Choose from Gallery
                </Button>
              </View>
            )}
          </View>
        );

      default:
        return (
          <Text variant="bodyMedium" style={styles.notSupportedText}>
            This question type is not yet supported on mobile
          </Text>
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading form...
        </Text>
      </View>
    );
  }

  if (showRespondentForm) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.respondentFormContainer}>
            <Text variant="headlineMedium" style={styles.title}>
              Welcome to {projectName}
            </Text>
            <Text variant="bodyLarge" style={styles.subtitle}>
              Please provide your information to begin
            </Text>

            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.autoIdToggle}>
                  <View style={styles.toggleLabelContainer}>
                    <Text variant="bodyLarge" style={styles.toggleLabel}>
                      Auto-generate ID
                    </Text>
                    <Text variant="bodySmall" style={styles.toggleHint}>
                      {useAutoId ? 'ID will be generated automatically' : 'Enter your own custom ID'}
                    </Text>
                  </View>
                  <Switch
                    value={useAutoId}
                    onValueChange={handleToggleAutoId}
                    thumbColor={useAutoId ? '#64c8ff' : '#ccc'}
                    trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                  />
                </View>

                <TextInput
                  label="Respondent ID *"
                  value={respondentId}
                  onChangeText={setRespondentId}
                  mode="outlined"
                  style={styles.input}
                  textColor="#ffffff"
                  placeholder={useAutoId ? 'Auto-generated ID' : 'Enter your unique ID'}
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  disabled={useAutoId}
                  right={
                    useAutoId ? (
                      <TextInput.Icon
                        icon="refresh"
                        onPress={generateNewRespondentId}
                        color="#64c8ff"
                      />
                    ) : undefined
                  }
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />

                <TextInput
                  label="Name (Optional)"
                  value={respondentName}
                  onChangeText={setRespondentName}
                  mode="outlined"
                  style={styles.input}
                  textColor="#ffffff"
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />

                <Button
                  mode="contained"
                  onPress={handleRespondentSubmit}
                  style={styles.startButton}
                >
                  Start Survey
                </Button>
              </Card.Content>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length);

  const renderLocationDialog = () => {
    if (!currentLocationQuestion) return null;

    const handleLocationConfirm = () => {
      // Validate inputs
      if (!locationInput.address && (!locationInput.latitude || !locationInput.longitude)) {
        Alert.alert('Required', 'Please enter either an address or GPS coordinates');
        return;
      }

      // If GPS coordinates provided, validate them
      if (locationInput.latitude || locationInput.longitude) {
        const lat = parseFloat(locationInput.latitude);
        const lng = parseFloat(locationInput.longitude);

        if (isNaN(lat) || isNaN(lng)) {
          Alert.alert('Invalid GPS', 'Please enter valid GPS coordinates');
          return;
        }

        if (lat < -90 || lat > 90) {
          Alert.alert('Invalid Latitude', 'Latitude must be between -90 and 90');
          return;
        }

        if (lng < -180 || lng > 180) {
          Alert.alert('Invalid Longitude', 'Longitude must be between -180 and 180');
          return;
        }
      }

      const locationData = {
        latitude: locationInput.latitude ? parseFloat(locationInput.latitude) : null,
        longitude: locationInput.longitude ? parseFloat(locationInput.longitude) : null,
        address: locationInput.address || null,
        timestamp: new Date().toISOString(),
      };

      handleResponseChange(currentLocationQuestion, JSON.stringify(locationData));
      setShowLocationDialog(false);
      setCurrentLocationQuestion(null);
    };

    return (
      <Portal>
        <Dialog
          visible={showLocationDialog}
          onDismiss={() => setShowLocationDialog(false)}
          style={styles.dateDialog}
        >
          <Dialog.Title style={styles.dateDialogTitle}>Enter Location</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dateDialogHint}>
              Enter address or GPS coordinates:
            </Text>

            <Text style={styles.dateInputLabel}>Address / Location Name</Text>
            <TextInput
              value={locationInput.address}
              onChangeText={(text) => setLocationInput({ ...locationInput, address: text })}
              placeholder="e.g., Kampala, Uganda or Farm Name"
              mode="outlined"
              style={styles.input}
              textColor="#ffffff"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              multiline
              theme={{
                colors: {
                  primary: '#64c8ff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                  outline: 'rgba(100, 200, 255, 0.5)',
                },
              }}
            />

            <Text variant="bodyMedium" style={[styles.dateDialogHint, { marginTop: 16 }]}>
              Or enter GPS coordinates:
            </Text>

            <View style={styles.dateInputRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Latitude</Text>
                <TextInput
                  value={locationInput.latitude}
                  onChangeText={(text) => setLocationInput({ ...locationInput, latitude: text })}
                  keyboardType="numeric"
                  placeholder="e.g., 0.3476"
                  mode="outlined"
                  style={styles.dateInput}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Longitude</Text>
                <TextInput
                  value={locationInput.longitude}
                  onChangeText={(text) => setLocationInput({ ...locationInput, longitude: text })}
                  keyboardType="numeric"
                  placeholder="e.g., 32.5825"
                  mode="outlined"
                  style={styles.dateInput}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />
              </View>
            </View>

            <Text variant="bodySmall" style={styles.datePreview}>
              {locationInput.address && `Address: ${locationInput.address}`}
              {locationInput.latitude && locationInput.longitude &&
                `\nGPS: ${locationInput.latitude}, ${locationInput.longitude}`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dateDialogActions}>
            <Button
              onPress={() => {
                setShowLocationDialog(false);
                setCurrentLocationQuestion(null);
              }}
              labelStyle={styles.cancelButtonLabel}
            >
              Cancel
            </Button>
            <Button onPress={handleLocationConfirm} mode="contained" style={styles.confirmButton}>
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  const renderDatePickerDialog = () => {
    if (!currentDateQuestion) return null;

    const handleDateConfirm = () => {
      const year = parseInt(manualDateInput.year);
      const month = parseInt(manualDateInput.month) - 1;
      const day = parseInt(manualDateInput.day);

      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        Alert.alert('Invalid Date', 'Please enter a valid date');
        return;
      }

      const selectedDate = new Date(year, month, day);
      if (isNaN(selectedDate.getTime())) {
        Alert.alert('Invalid Date', 'Please enter a valid date');
        return;
      }

      handleResponseChange(currentDateQuestion, selectedDate.toISOString());
      setShowDatePicker(false);
      setCurrentDateQuestion(null);
    };

    return (
      <Portal>
        <Dialog visible={showDatePicker} onDismiss={() => setShowDatePicker(false)} style={styles.dateDialog}>
          <Dialog.Title style={styles.dateDialogTitle}>Select Date</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dateDialogHint}>
              Enter the date below:
            </Text>
            <View style={styles.dateInputRow}>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Year</Text>
                <TextInput
                  value={manualDateInput.year}
                  onChangeText={(text) => setManualDateInput({ ...manualDateInput, year: text })}
                  keyboardType="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  mode="outlined"
                  style={styles.dateInput}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Month</Text>
                <TextInput
                  value={manualDateInput.month}
                  onChangeText={(text) => setManualDateInput({ ...manualDateInput, month: text })}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="MM"
                  mode="outlined"
                  style={styles.dateInput}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />
              </View>
              <View style={styles.dateInputGroup}>
                <Text style={styles.dateInputLabel}>Day</Text>
                <TextInput
                  value={manualDateInput.day}
                  onChangeText={(text) => setManualDateInput({ ...manualDateInput, day: text })}
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="DD"
                  mode="outlined"
                  style={styles.dateInput}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />
              </View>
            </View>
            <Text variant="bodySmall" style={styles.datePreview}>
              Preview: {manualDateInput.year}/{manualDateInput.month}/{manualDateInput.day}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dateDialogActions}>
            <Button
              onPress={() => {
                setShowDatePicker(false);
                setCurrentDateQuestion(null);
              }}
              labelStyle={styles.cancelButtonLabel}
            >
              Cancel
            </Button>
            <Button
              onPress={handleDateConfirm}
              mode="contained"
              style={styles.confirmButton}
            >
              Confirm
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.progressContainer}>
        <Text variant="labelLarge" style={styles.progressText}>
          Question {currentQuestionIndex + 1} of {questions.length}
        </Text>
        <ProgressBar progress={progress} color="#64c8ff" style={styles.progressBar} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.questionCard}>
          <Card.Content>
            <View style={styles.questionHeader}>
              <Text variant="labelLarge" style={styles.questionNumber}>
                Q{currentQuestionIndex + 1}
              </Text>
              {currentQuestion.is_required && (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              )}
            </View>

            <Text variant="headlineSmall" style={styles.questionText}>
              {currentQuestion.question_text}
            </Text>

            <View style={styles.inputContainer}>{renderQuestionInput(currentQuestion)}</View>
          </Card.Content>
        </Card>
      </ScrollView>

      <View style={styles.navigationContainer}>
        <Button
          mode="outlined"
          onPress={handlePrevious}
          disabled={currentQuestionIndex === 0}
          style={styles.navButton}
          labelStyle={styles.navButtonLabel}
        >
          Previous
        </Button>

        {currentQuestionIndex < questions.length - 1 ? (
          <Button
            mode="contained"
            onPress={handleNext}
            style={styles.navButton}
          >
            Next
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submitButton}
          >
            Submit
          </Button>
        )}
      </View>

      {renderLocationDialog()}
      {renderDatePickerDialog()}
    </KeyboardAvoidingView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  respondentFormContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  title: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 32,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  autoIdToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.2)',
  },
  toggleLabelContainer: {
    flex: 1,
  },
  toggleLabel: {
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 4,
  },
  toggleHint: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  startButton: {
    marginTop: 8,
    backgroundColor: '#4b1e85',
  },
  progressContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: '#1a1a3a',
  },
  progressText: {
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
  },
  questionCard: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    color: '#64c8ff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  requiredBadge: {
    backgroundColor: 'rgba(211, 47, 47, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 12,
  },
  requiredText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
  },
  questionText: {
    color: '#ffffff',
    marginBottom: 24,
    lineHeight: 32,
  },
  inputContainer: {
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionText: {
    color: '#ffffff',
    marginLeft: 8,
    flex: 1,
  },
  scaleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scaleButton: {
    minWidth: 50,
    borderColor: 'rgba(100, 200, 255, 0.5)',
  },
  scaleButtonLabel: {
    color: '#ffffff',
  },
  notSupportedText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  dateButton: {
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  dateButtonContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  dateIcon: {
    fontSize: 24,
  },
  dateDialog: {
    backgroundColor: '#1a1a3a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  dateDialogTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  dateDialogHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  dateInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateInputGroup: {
    flex: 1,
  },
  dateInputLabel: {
    color: '#64c8ff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    height: 50,
  },
  datePreview: {
    color: '#64c8ff',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
  },
  dateDialogActions: {
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 30, 133, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  confirmButton: {
    backgroundColor: '#4b1e85',
    marginLeft: 8,
  },
  cancelButtonLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  imagePickerContainer: {
    gap: 12,
  },
  imagePickerButton: {
    width: '100%',
  },
  imagePreviewContainer: {
    width: '100%',
  },
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  imageActionButton: {
    flex: 1,
    borderColor: 'rgba(100, 200, 255, 0.5)',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a3a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 30, 133, 0.3)',
    gap: 12,
  },
  navButton: {
    flex: 1,
    borderColor: 'rgba(100, 200, 255, 0.5)',
  },
  navButtonLabel: {
    color: '#ffffff',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#4b1e85',
  },
});

export default DataCollectionScreen;