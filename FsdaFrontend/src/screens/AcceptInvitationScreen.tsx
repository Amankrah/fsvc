import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  ActivityIndicator,
  Chip,
  Divider,
  Card,
  IconButton,
} from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiService from '../services/api';
import { Project, UserNotification } from '../types';

type RootStackParamList = {
  AcceptInvitation: { 
    projectId: string; 
    notificationId: string;
  };
  Dashboard: undefined;
  ProjectDetails: { projectId: string };
};

type AcceptInvitationScreenRouteProp = RouteProp<RootStackParamList, 'AcceptInvitation'>;
type AcceptInvitationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'AcceptInvitation'
>;

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  owner: 'Owner',
  member: 'Member',
  analyst: 'Analyst',
  collaborator: 'Collaborator',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner: '#6200ee',
  member: '#03dac6',
  analyst: '#ff6f00',
  collaborator: '#00bcd4',
  viewer: '#9e9e9e',
};

const AcceptInvitationScreen: React.FC = () => {
  const route = useRoute<AcceptInvitationScreenRouteProp>();
  const navigation = useNavigation<AcceptInvitationScreenNavigationProp>();
  const { projectId, notificationId } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [notification, setNotification] = useState<UserNotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load project and notification details
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load project details
        const projectData = await apiService.getProject(projectId);
        setProject(projectData);
        
        // Load user notifications to find the specific invitation
        const notificationsData = await apiService.getNotifications();
        const inviteNotification = notificationsData.notifications.find(
          (n: UserNotification) => n.id === notificationId && n.type === 'team_invitation'
        );
        
        if (!inviteNotification) {
          Alert.alert(
            'Invitation Not Found',
            'This invitation notification is no longer available.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Dashboard'),
              },
            ]
          );
          return;
        }
        
        if (inviteNotification.is_expired) {
          Alert.alert(
            'Invitation Expired',
            'This invitation has expired.',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Dashboard'),
              },
            ]
          );
          return;
        }
        
        setNotification(inviteNotification);
        
      } catch (error: any) {
        console.error('Error loading invitation data:', error);
        Alert.alert(
          'Error',
          'Failed to load invitation details.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Dashboard'),
            },
          ]
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [projectId, notificationId, navigation]);

  const handleAcceptInvitation = async () => {
    try {
      setIsSubmitting(true);
      await apiService.acceptTeamInvitation(projectId, notificationId);

      // Auto-redirect to dashboard after successful acceptance
      navigation.navigate('Dashboard');
      
      // Show success message briefly
      Alert.alert('Success', `Welcome to ${project?.name}! You've successfully joined the project.`);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineInvitation = async () => {
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join ${project?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await apiService.declineTeamInvitation(projectId, notificationId);

              // Auto-redirect to dashboard after successful decline
              navigation.navigate('Dashboard');
              
              // Show brief confirmation
              Alert.alert('Invitation Declined', 'You have declined the project invitation.');
            } catch (error: any) {
              console.error('Error declining invitation:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to decline invitation');
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading invitation details...
        </Text>
      </View>
    );
  }

  if (!project || !notification) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="headlineSmall" style={styles.errorTitle}>
          Invitation Not Available
        </Text>
        <Text variant="bodyMedium" style={styles.errorText}>
          This invitation is no longer available.
        </Text>
        <Button mode="contained" onPress={() => navigation.navigate('Dashboard')}>
          Go to Dashboard
        </Button>
      </View>
    );
  }

  // Extract invited by info from notification message
  const invitedByMatch = notification.message.match(/^(.+?) has invited you/);
  const invitedBy = invitedByMatch ? invitedByMatch[1] : 'Someone';

  // Extract role from notification message  
  const roleMatch = notification.message.match(/as a (\w+)\./);
  const extractedRole = roleMatch ? roleMatch[1] : 'member';
  const userRole = extractedRole.toLowerCase(); // Ensure lowercase to match ROLE_COLORS keys

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.surface} elevation={2}>
          <View style={styles.headerSection}>
            <IconButton
              icon="arrow-left"
              size={24}
              onPress={() => navigation.navigate('Dashboard')}
              style={styles.backButton}
            />
            <Text variant="headlineMedium" style={styles.title}>
              Project Invitation
            </Text>
          </View>

          <Card style={styles.projectCard}>
            <Card.Content>
              <View style={styles.invitationHeader}>
                <Text variant="bodyLarge" style={styles.invitedText}>
                  You've been invited by <Text style={styles.boldText}>{invitedBy}</Text> to join:
                </Text>
              </View>

              <Text variant="headlineSmall" style={styles.projectName}>
                {project.name}
              </Text>

              {project.description && (
                <Text variant="bodyMedium" style={styles.projectDescription}>
                  {project.description}
                </Text>
              )}

              <Divider style={styles.divider} />

              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Your Role
                  </Text>
                  <Chip
                    mode="flat"
                    style={[
                      styles.roleChip,
                      { backgroundColor: (ROLE_COLORS[userRole] || '#6200ee') + '20' },
                    ]}
                    textStyle={{ color: ROLE_COLORS[userRole] || '#6200ee', fontWeight: 'bold' }}
                  >
                    {ROLE_DISPLAY_NAMES[userRole] || extractedRole || 'Member'}
                  </Chip>
                </View>

                <View style={styles.detailItem}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Project Questions
                  </Text>
                  <Text variant="titleMedium" style={styles.detailValue}>
                    {project.question_count || 0}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Respondents
                  </Text>
                  <Text variant="titleMedium" style={styles.detailValue}>
                    {project.response_count || 0}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text variant="labelMedium" style={styles.detailLabel}>
                    Team Members
                  </Text>
                  <Text variant="titleMedium" style={styles.detailValue}>
                    {project.team_members_count || 1}
                  </Text>
                </View>
              </View>

              <View style={styles.projectMeta}>
                <Text variant="bodySmall" style={styles.metaText}>
                  Created by: {project.created_by_details?.first_name} {project.created_by_details?.last_name}
                </Text>
                <Text variant="bodySmall" style={styles.metaText}>
                  Created: {new Date(project.created_at).toLocaleDateString()}
                </Text>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.actionsSection}>
            <Text variant="titleMedium" style={styles.actionsTitle}>
              What would you like to do?
            </Text>
            
            <View style={styles.actionButtons}>
              <Button
                mode="contained"
                onPress={handleAcceptInvitation}
                loading={isSubmitting}
                disabled={isSubmitting}
                style={styles.acceptButton}
                icon="check"
              >
                Accept & Join Project
              </Button>

              <Button
                mode="outlined"
                onPress={handleDeclineInvitation}
                disabled={isSubmitting}
                style={styles.declineButton}
                icon="close"
              >
                Decline Invitation
              </Button>
            </View>

            <Text variant="bodySmall" style={styles.helpText}>
              You can change your mind later from your dashboard notifications.
            </Text>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  surface: {
    padding: 0,
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#212529',
  },
  errorText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#6200ee',
  },
  backButton: {
    marginRight: 8,
  },
  title: {
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  projectCard: {
    margin: 20,
    borderRadius: 12,
    elevation: 2,
  },
  invitationHeader: {
    marginBottom: 16,
  },
  invitedText: {
    color: '#666',
    lineHeight: 22,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#333',
  },
  projectName: {
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#6200ee',
    fontSize: 24,
  },
  projectDescription: {
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  divider: {
    marginVertical: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  detailLabel: {
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 18,
  },
  roleChip: {
    alignSelf: 'center',
  },
  projectMeta: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  metaText: {
    color: '#999',
    marginBottom: 4,
  },
  actionsSection: {
    padding: 20,
  },
  actionsTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  actionButtons: {
    gap: 12,
    marginBottom: 16,
  },
  acceptButton: {
    backgroundColor: '#4caf50',
    paddingVertical: 8,
  },
  declineButton: {
    borderColor: '#d32f2f',
    paddingVertical: 8,
  },
  helpText: {
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AcceptInvitationScreen;