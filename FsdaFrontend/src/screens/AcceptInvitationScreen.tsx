import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import apiService from '../services/api';
import { Project, UserNotification } from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

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
  owner: colors.roles.owner,
  member: colors.roles.member,
  analyst: colors.visualization.amber,
  collaborator: colors.visualization.cyan,
  viewer: colors.text.disabled,
};

const AcceptInvitationScreen: React.FC = () => {
  const route = useRoute<AcceptInvitationScreenRouteProp>();
  const navigation = useNavigation<AcceptInvitationScreenNavigationProp>();
  const { projectId, notificationId } = route.params;
  const insets = useSafeAreaInsets();

  const [project, setProject] = useState<Project | null>(null);
  const [notification, setNotification] = useState<UserNotification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [existingRole, setExistingRole] = useState<string>('member');

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const projectData = await apiService.getProject(projectId);
        setProject(projectData);

        // If the project's membership_status is no longer 'pending', user already joined
        if (projectData.membership_status && projectData.membership_status !== 'pending') {
          setIsAlreadyMember(true);
          setIsLoading(false);
          return;
        }

        const notificationsData = await apiService.getNotifications();
        const inviteNotification = notificationsData.notifications.find(
          (n: UserNotification) => n.id === notificationId && n.type === 'team_invitation'
        );

        if (!inviteNotification) {
          // Notification gone but project loaded — likely already accepted
          if (projectData.membership_status !== 'pending') {
            setIsAlreadyMember(true);
          } else {
            Alert.alert('Invitation Not Found', 'This invitation notification is no longer available.', [
              { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
            ]);
          }
          return;
        }

        if (inviteNotification.is_expired) {
          Alert.alert('Invitation Expired', 'This invitation has expired.', [
            { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
          ]);
          return;
        }

        setNotification(inviteNotification);
      } catch (error: any) {
        console.error('Error loading invitation data:', error);
        Alert.alert('Error', 'Failed to load invitation details.', [
          { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
        ]);
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
      navigation.navigate('Dashboard');
      Alert.alert('Success', `Welcome to ${project?.name}! You've successfully joined the project.`);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      // Backend explicitly says already a member
      if (error.response?.data?.error === 'already_member') {
        setExistingRole(error.response.data.role || 'member');
        setIsAlreadyMember(true);
        return;
      }
      Alert.alert('Error', error.response?.data?.message || error.response?.data?.error || 'Failed to accept invitation');
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
              navigation.navigate('Dashboard');
              Alert.alert('Invitation Declined', 'You have declined the project invitation.');
            } catch (error: any) {
              console.error('Error declining invitation:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to decline invitation');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // ── Already a member ─────────────────────────────────────────────────────
  if (!isLoading && isAlreadyMember) {
    const roleLabel = ROLE_DISPLAY_NAMES[existingRole] || existingRole;
    const roleColor = ROLE_COLORS[existingRole] || colors.primary.main;
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Icon source="chevron-left" size={22} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.heroIconTile}>
            <Icon source="check-decagram" size={26} color="rgba(255,255,255,0.9)" />
          </View>
          <Text style={styles.heroLabel}>Already Joined</Text>
          <Text style={styles.heroTitle}>You're a member of this project</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.alreadyMemberCard}>
            <View style={styles.projectAccentBar} />
            <View style={styles.projectCardBody}>
              <Text style={styles.projectCardLabel}>Project</Text>
              <Text style={styles.projectName}>{project?.name}</Text>
              {project?.description ? (
                <Text style={styles.projectDescription}>{project.description}</Text>
              ) : null}
              <View style={[styles.rolePill, { backgroundColor: roleColor + '18', borderColor: roleColor + '40' }]}>
                <View style={[styles.rolePillDot, { backgroundColor: roleColor }]} />
                <Text style={[styles.rolePillText, { color: roleColor }]}>Your role: {roleLabel}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.decisionPrompt}>
            You already accepted this invitation and are an active member.
          </Text>

          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={() => navigation.navigate('ProjectDetails', { projectId })}
            activeOpacity={0.82}
          >
            <Icon source="folder-open-outline" size={18} color="#fff" />
            <Text style={styles.acceptBtnText}>Open Project</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => navigation.navigate('Dashboard')}
            activeOpacity={0.82}
          >
            <Text style={styles.declineBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
          <View style={{ height: spacing.huge }} />
        </ScrollView>
      </ScreenWrapper>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenWrapper style={styles.loadingContainer} edges={{ top: false }}>
        <View style={[styles.loadingHero, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Icon source="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading invitation details…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (!project || !notification) {
    return (
      <ScreenWrapper style={styles.errorContainer} edges={{ top: false }}>
        <View style={[styles.loadingHero, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Icon source="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingBody}>
          <Text style={styles.errorTitle}>Invitation Not Available</Text>
          <Text style={styles.errorText}>This invitation is no longer available.</Text>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Text style={styles.acceptBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  // Parse notification info
  const invitedByMatch = notification.message.match(/^(.+?) has invited you/);
  const invitedBy = invitedByMatch ? invitedByMatch[1] : 'Someone';
  const inviterInitials = invitedBy
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const roleMatch = notification.message.match(/as a (\w+)\./);
  const extractedRole = roleMatch ? roleMatch[1] : 'member';
  const userRole = extractedRole.toLowerCase();
  const roleColor = ROLE_COLORS[userRole] || colors.primary.main;
  const roleLabel = ROLE_DISPLAY_NAMES[userRole] || extractedRole;

  const createdDate = project.created_at
    ? new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* ── Green hero ──────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Dashboard')}>
          <Icon source="chevron-left" size={22} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.heroIconTile}>
          <Icon source="email-outline" size={26} color="rgba(255,255,255,0.9)" />
        </View>
        <Text style={styles.heroLabel}>Project Invitation</Text>
        <Text style={styles.heroTitle}>You've been invited to collaborate</Text>
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Inviter strip */}
        <View style={styles.inviterCard}>
          <View style={styles.inviterAvatar}>
            <Text style={styles.inviterInitials}>{inviterInitials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inviterLabel}>Invited by</Text>
            <Text style={styles.inviterName}>{invitedBy}</Text>
          </View>
        </View>

        {/* Project card */}
        <View style={styles.projectCard}>
          <View style={styles.projectAccentBar} />
          <View style={styles.projectCardBody}>
            <Text style={styles.projectCardLabel}>Project</Text>
            <Text style={styles.projectName}>{project.name}</Text>
            {project.description ? (
              <Text style={styles.projectDescription}>{project.description}</Text>
            ) : null}

            {/* 2×2 stat grid */}
            <View style={styles.statGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{project.question_count ?? 0}</Text>
                <Text style={styles.statLabel}>Questions</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{project.response_count ?? 0}</Text>
                <Text style={styles.statLabel}>Respondents</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statValue}>{project.team_members_count ?? 1}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={[styles.statCell, styles.roleCell]}>
                <Text style={[styles.roleValue, { color: roleColor }]}>{roleLabel}</Text>
                <Text style={styles.statLabel}>Your Role</Text>
              </View>
            </View>

            {/* Footer meta */}
            <View style={styles.projectMeta}>
              {project.created_by_details && (
                <Text style={styles.metaText}>
                  Created by {project.created_by_details.first_name} {project.created_by_details.last_name}
                </Text>
              )}
              {createdDate ? <Text style={styles.metaText}>{createdDate}</Text> : null}
            </View>
          </View>
        </View>

        {/* Decision prompt */}
        <Text style={styles.decisionPrompt}>
          Would you like to join this project as a{' '}
          <Text style={[styles.decisionRole, { color: roleColor }]}>{roleLabel}</Text>?
        </Text>

        {/* Action buttons */}
        <TouchableOpacity
          style={[styles.acceptBtn, isSubmitting && styles.btnDisabled]}
          onPress={handleAcceptInvitation}
          disabled={isSubmitting}
          activeOpacity={0.82}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon source="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.acceptBtnText}>Accept & Join Project</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.declineBtn, isSubmitting && styles.btnDisabled]}
          onPress={handleDeclineInvitation}
          disabled={isSubmitting}
          activeOpacity={0.82}
        >
          <Icon source="close-circle-outline" size={18} color={colors.status.error} />
          <Text style={styles.declineBtnText}>Decline Invitation</Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>You can leave the project at any time from your profile.</Text>

        <View style={{ height: spacing.huge }} />
      </ScrollView>
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
    paddingBottom: spacing.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  heroIconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    lineHeight: 30,
    letterSpacing: -0.3,
  },

  // ── Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },

  // ── Inviter card
  inviterCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.md,
  },
  inviterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  inviterInitials: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 15,
    color: '#fff',
  },
  inviterLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  inviterName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },

  // ── Project card
  projectCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  projectAccentBar: {
    height: 4,
    backgroundColor: colors.primary.main,
  },
  projectCardBody: {
    padding: spacing.lg,
  },
  projectCardLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  projectName: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
    lineHeight: 26,
  },
  projectDescription: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  // ── Stat grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  statCell: {
    width: '47%',
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.sm,
    padding: 10,
    alignItems: 'center',
  },
  roleCell: {
    backgroundColor: colors.primary.surface,
    borderWidth: 1,
    borderColor: 'rgba(29, 122, 82, 0.25)',
  },
  statValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: colors.text.primary,
    lineHeight: typography.fontSize.xxl + 4,
  },
  statLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  roleValue: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    marginBottom: 2,
  },

  // ── Project meta footer
  projectMeta: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
  },

  // ── Decision prompt
  decisionPrompt: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  decisionRole: {
    fontFamily: 'DMSans-Bold',
  },

  // ── Buttons
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 15,
    marginBottom: spacing.sm,
  },
  acceptBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.status.error,
    borderRadius: borderRadius.lg,
    paddingVertical: 15,
    backgroundColor: colors.background.paper,
    marginBottom: spacing.md,
  },
  declineBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.status.error,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  helpText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // ── Loading / error
  loadingHero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  // ── Already member card
  alreadyMemberCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.round,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  rolePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rolePillText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
  },

  errorContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  errorTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  errorText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});

export default AcceptInvitationScreen;
