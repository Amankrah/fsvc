import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
  Keyboard,
} from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import apiService from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  ProjectMember,
  ProjectMemberRole,
  ProjectPermission,
  TeamMembersResponse,
  InviteMemberData,
  UpdateMemberData,
  SearchedUser,
  UserSearchResponse,
} from '../types';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type RootStackParamList = {
  Members: { projectId: string };
};

type MembersScreenRouteProp = RouteProp<RootStackParamList, 'Members'>;

// Role and Permission configurations
const ROLE_DISPLAY_NAMES: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  member: 'Member',
  partner: 'Partner Organization',
};

const ROLE_COLORS: Record<ProjectMemberRole, string> = {
  owner: colors.roles.owner,
  member: colors.roles.member,
  partner: colors.roles.partner,
};

const PERMISSION_DISPLAY_NAMES: Record<ProjectPermission, string> = {
  all: 'All Permissions',
  collect_data: 'Generate Questions & Collect Data',
  view_responses: 'View Responses',
  view_share_link: 'View Shareable Link',
};

// All members have FIXED permissions - these cannot be customized
// Backend enforces: collect_data, view_responses, view_share_link
const FIXED_MEMBER_PERMISSIONS: ProjectPermission[] = ['collect_data', 'view_responses', 'view_share_link'];

const MembersScreen: React.FC = () => {
  const route = useRoute<MembersScreenRouteProp>();
  const { projectId } = route.params;
  const { user } = useAuthStore();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [project, setProject] = useState<any>(null);

  // Invite Dialog State
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SearchedUser[]>([]);
  const [inviteRole, setInviteRole] = useState<ProjectMemberRole>('member');
  // Permissions are now fixed - all members get the same permissions
  const [invitePartnerOrg, setInvitePartnerOrg] = useState<string>('');
  const [isInviting, setIsInviting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Edit Member Dialog State (role only - permissions are fixed)
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [editRole, setEditRole] = useState<ProjectMemberRole>('member');
  const [isUpdating, setIsUpdating] = useState(false);

  // Member action sheet
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionSheetMember, setActionSheetMember] = useState<ProjectMember | null>(null);

  // Permission to manage members (only the project creator can manage).
  // The creator appears in the members list with key 'id' (not 'user') and role='owner'.
  // The most reliable check is project.created_by since that UUID always matches user.id.
  const canManageMembers = !!project && (
    project.created_by === user?.id ||
    // Fallback: creator entry returned with 'id' key instead of 'user'
    members.some((m) => (m.id === user?.id || m.user === user?.id) && (m.role === 'owner' || m.is_creator))
  );

  const loadMembers = useCallback(async () => {
    try {
      const response: TeamMembersResponse = await apiService.getProjectMembers(projectId);
      setMembers(response.team_members || []);
    } catch (error: any) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load team members');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    try {
      const projectData = await apiService.getProject(projectId);
      setProject(projectData);
    } catch (error: any) {
      console.error('Error loading project:', error);
    }
  }, [projectId]);

  useEffect(() => {
    loadMembers();
    loadProject();
  }, [loadMembers, loadProject]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadMembers();
  }, [loadMembers]);

  const handleUserSearch = useCallback(async (query: string) => {
    setUserSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchedUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const response: UserSearchResponse = await apiService.searchUsers(query);

      // Filter out users who are already members or already queued
      const memberEmails = members.map(m => m.user_details?.email || m.email);
      const filteredUsers = response.users.filter(u =>
        !memberEmails.includes(u.email) && !selectedUsers.some(s => s.id === u.id)
      );

      setSearchedUsers(filteredUsers);
    } catch (error: any) {
      console.error('Error searching users:', error);
      setSearchedUsers([]);
    } finally {
      setIsSearching(false);
    }
  }, [members, selectedUsers]);

  const handleUserSelect = useCallback((u: SearchedUser) => {
    setSelectedUsers(prev => prev.find(p => p.id === u.id) ? prev : [...prev, u]);
    setUserSearchQuery('');
    setSearchedUsers([]);
  }, []);

  const handleInviteMember = useCallback(async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user to invite');
      return;
    }

    // Validate partner organization for partner role
    if (inviteRole === 'partner' && !invitePartnerOrg) {
      Alert.alert('Error', 'Please select a partner organization for partner role');
      return;
    }

    setIsInviting(true);
    const results: { name: string; success: boolean; error?: string }[] = [];

    try {
      for (const u of selectedUsers) {
        try {
          const inviteData: InviteMemberData = {
            user_id: u.id,
            role: inviteRole,
            permissions: FIXED_MEMBER_PERMISSIONS,
            partner_organization: inviteRole === 'partner' ? invitePartnerOrg : undefined,
          };
          await apiService.inviteMember(projectId, inviteData);
          results.push({ name: u.full_name || u.username, success: true });
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.error ||
            error.response?.data?.details?.user_id?.[0] ||
            'Failed to invite';
          results.push({ name: u.full_name || u.username, success: false, error: errorMessage });
        }
      }

      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (succeeded.length > 0 && failed.length === 0) {
        Alert.alert(
          'Invites Sent',
          `${succeeded.length} member${succeeded.length > 1 ? 's' : ''} invited successfully! They will receive notifications to accept.`
        );
      } else if (succeeded.length > 0) {
        Alert.alert(
          'Partial Success',
          `Invited: ${succeeded.map(r => r.name).join(', ')}\n\nFailed: ${failed.map(r => `${r.name} (${r.error})`).join(', ')}`
        );
      } else {
        Alert.alert('Error', failed.map(r => `${r.name}: ${r.error}`).join('\n'));
      }

      setUserSearchQuery('');
      setSelectedUsers([]);
      setSearchedUsers([]);
      setInviteRole('member');
      setInvitePartnerOrg('');
      setShowInviteDialog(false);
      loadMembers();
    } finally {
      setIsInviting(false);
    }
  }, [selectedUsers, inviteRole, invitePartnerOrg, projectId, loadMembers]);

  const handleUpdateMember = useCallback(async () => {
    if (!editingMember) return;

    setIsUpdating(true);
    try {
      const updateData: UpdateMemberData = {
        user_id: editingMember.user, // Use User ID
        role: editRole,
        // Permissions are fixed - all members have the same permissions
        permissions_list: FIXED_MEMBER_PERMISSIONS,
      };

      await apiService.updateMember(projectId, updateData);

      Alert.alert('Success', 'Member role updated successfully');
      setShowEditDialog(false);
      setEditingMember(null);
      loadMembers();
    } catch (error: any) {
      console.error('Error updating member:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update member';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUpdating(false);
    }
  }, [editingMember, editRole, projectId, loadMembers]);

  const handleRemoveMember = useCallback(
    (member: ProjectMember) => {
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${member.username} from this project?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                // Pass User ID (member.user), NOT Membership ID (member.id)
                await apiService.removeMember(projectId, member.user);
                Alert.alert('Success', 'Member removed successfully');
                loadMembers();
              } catch (error: any) {
                console.error('Error removing member:', error);
                const errorMessage = error.response?.data?.error || 'Failed to remove member';
                Alert.alert('Error', errorMessage);
              }
            },
          },
        ]
      );
    },
    [projectId, loadMembers]
  );

  const openEditDialog = useCallback((member: ProjectMember) => {
    setEditingMember(member);
    setEditRole(member.role);
    setShowEditDialog(true);
  }, []);

  const handleRoleChange = useCallback((role: ProjectMemberRole, isEditMode: boolean = false) => {
    if (isEditMode) {
      setEditRole(role);
    } else {
      setInviteRole(role);
      // Reset partner organization if role is not partner
      if (role !== 'partner') {
        setInvitePartnerOrg('');
      }
    }
  }, []);

  const renderMemberItem = ({ item }: { item: ProjectMember }) => {
    const isOwner = item.role === 'owner';
    const userId = item.user;
    const isCurrentUser = userId === user?.id;
    const username = item.user_details?.username || item.username || 'Unknown';
    const email = item.user_details?.email || item.email || '';
    const initials = username.slice(0, 2).toUpperCase();
    const roleColor = ROLE_COLORS[item.role];

    return (
      <View style={styles.memberCard}>
        {/* Role accent bar */}
        <View style={[styles.memberAccentBar, { backgroundColor: roleColor }]} />

        <View style={styles.memberCardBody}>
          <View style={styles.memberHeader}>
            {/* Avatar with initials */}
            <View style={[styles.memberAvatar, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.memberInitials, { color: roleColor }]}>{initials}</Text>
            </View>

            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>{username}</Text>
                {isCurrentUser && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>You</Text>
                  </View>
                )}
              </View>
              <Text style={styles.memberEmail}>{email}</Text>
              <View style={styles.memberMeta}>
                <View style={[styles.roleChip, { backgroundColor: roleColor + '20' }]}>
                  <Text style={[styles.roleChipText, { color: roleColor }]}>
                    {ROLE_DISPLAY_NAMES[item.role]}
                  </Text>
                </View>
                {item.status === 'pending' && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                )}
              </View>
              <Text style={styles.joinedText}>
                Joined {new Date(item.joined_at).toLocaleDateString()}
              </Text>
            </View>

            {canManageMembers && !isOwner && (
              <TouchableOpacity
                onPress={() => { setActionSheetMember(item); setShowActionSheet(true); }}
                style={styles.menuBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon source="dots-vertical" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Permissions */}
          <View style={styles.permissionsSection}>
            <Text style={styles.permissionsLabel}>PERMISSIONS</Text>
            <View style={styles.permissionsList}>
              {item.permissions.includes('all') ? (
                <View style={styles.permissionChip}>
                  <Text style={styles.permissionChipText}>All Permissions</Text>
                </View>
              ) : (
                item.permissions.slice(0, 3).map((perm) => (
                  <View key={perm} style={styles.permissionChip}>
                    <Text style={styles.permissionChipText}>{PERMISSION_DISPLAY_NAMES[perm]}</Text>
                  </View>
                ))
              )}
              {item.permissions.length > 3 && !item.permissions.includes('all') && (
                <View style={styles.permissionChip}>
                  <Text style={styles.permissionChipText}>+{item.permissions.length - 3} more</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderInviteDialog = () => {
    const availableRoles = (Object.keys(ROLE_DISPLAY_NAMES) as ProjectMemberRole[]).filter(role => {
      if (role === 'owner') return false;
      if (role === 'partner' && !project?.has_partners) return false;
      return true;
    });

    const dismissInvite = () => {
      setShowInviteDialog(false);
      setUserSearchQuery('');
      setSelectedUsers([]);
      setSearchedUsers([]);
      setInviteRole('member');
      setInvitePartnerOrg('');
    };

    return (
      <Modal
        visible={showInviteDialog}
        transparent
        animationType="slide"
        onRequestClose={dismissInvite}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={dismissInvite} />
          <View style={styles.modalKAV}>
            <View style={[styles.bottomSheet, { paddingBottom: Math.max(insets.bottom, 20), height: SCREEN_HEIGHT * 0.88 - keyboardHeight }]}>
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Title row */}
              <View style={styles.dialogTitleRow}>
                <View style={styles.dialogTitleAccent} />
                <Text style={styles.dialogTitleText}>Invite Team Member</Text>
                <TouchableOpacity onPress={dismissInvite} style={styles.sheetCloseBtn}>
                  <Icon source="close" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets
              >
                <Text style={styles.inviteHelpText}>
                  Search for a registered user to invite to this project. They will receive a notification to accept the invitation.
                </Text>

                {/* Search input */}
                <View style={styles.searchInputWrap}>
                  <Icon source="magnify" size={18} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Name, email, or username..."
                    placeholderTextColor={colors.text.tertiary}
                    value={userSearchQuery}
                    onChangeText={handleUserSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {isSearching && (
                    <ActivityIndicator size="small" color={colors.primary.main} />
                  )}
                  {!isSearching && userSearchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => { setUserSearchQuery(''); setSearchedUsers([]); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon source="close-circle" size={16} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Min chars hint */}
                {userSearchQuery.length > 0 && userSearchQuery.length < 2 && (
                  <Text style={styles.minCharsHint}>Type at least 2 characters to search</Text>
                )}

                {/* Search results */}
                {searchedUsers.length > 0 && (
                  <View style={styles.searchResultsList}>
                    <Text style={styles.searchResultsLabel}>Select a user to invite:</Text>
                    {searchedUsers.map((u) => {
                      const initials = (u.full_name || u.username || '?').slice(0, 2).toUpperCase();
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={styles.searchResultRow}
                          onPress={() => handleUserSelect(u)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.resultAvatar}>
                            <Text style={styles.resultAvatarText}>{initials}</Text>
                          </View>
                          <View style={styles.resultInfo}>
                            <Text style={styles.resultName}>{u.full_name || u.username}</Text>
                            <Text style={styles.resultEmail}>{u.email}</Text>
                            {u.institution ? (
                              <Text style={styles.resultInstitution}>{u.institution}</Text>
                            ) : null}
                          </View>
                          {u.role ? (
                            <View style={styles.resultRoleBadge}>
                              <Text style={styles.resultRoleBadgeText}>{u.role}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* No results state */}
                {userSearchQuery.length >= 2 && !isSearching && searchedUsers.length === 0 && (
                  <View style={styles.noResults}>
                    <Icon source="account-search-outline" size={28} color={colors.border.medium} />
                    <Text style={styles.noResultsText}>No users found</Text>
                  </View>
                )}

                {/* Invite queue — shows all selected users */}
                {selectedUsers.length > 0 && (
                  <View style={styles.queueSection}>
                    <View style={styles.queueHeader}>
                      <Text style={styles.queueLabel}>TO INVITE ({selectedUsers.length})</Text>
                      <TouchableOpacity onPress={() => setSelectedUsers([])}>
                        <Text style={styles.queueClearAll}>Clear all</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.queueChips}>
                      {selectedUsers.map(u => (
                        <View key={u.id} style={styles.queueChip}>
                          <View style={styles.queueChipAvatar}>
                            <Text style={styles.queueChipInitials}>
                              {(u.full_name || u.username || '?').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.queueChipName} numberOfLines={1}>
                            {u.full_name || u.username}
                          </Text>
                          <TouchableOpacity
                            onPress={() => setSelectedUsers(prev => prev.filter(p => p.id !== u.id))}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Icon source="close" size={13} color={colors.text.secondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Role inline chips */}
                <Text style={styles.sectionLabel}>Role</Text>
                <View style={styles.roleChipRow}>
                  {availableRoles.map(role => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleOptionChip, inviteRole === role && styles.roleOptionChipActive]}
                      onPress={() => handleRoleChange(role, false)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.roleOptionChipText, inviteRole === role && styles.roleOptionChipTextActive]}>
                        {ROLE_DISPLAY_NAMES[role]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!project?.has_partners && (
                  <Text style={styles.helperText}>
                    Enable "Collaborate with Partners" in project settings to invite partner organizations.
                  </Text>
                )}

                {/* Partner org selector */}
                {inviteRole === 'partner' && project?.partner_organizations && project.partner_organizations.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>Partner Organization *</Text>
                    <View style={styles.roleChipRow}>
                      {project.partner_organizations.map((partner: any) => (
                        <TouchableOpacity
                          key={partner.name}
                          style={[styles.roleOptionChip, invitePartnerOrg === partner.name && styles.roleOptionChipActive]}
                          onPress={() => setInvitePartnerOrg(partner.name)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.roleOptionChipText, invitePartnerOrg === partner.name && styles.roleOptionChipTextActive]}>
                            {partner.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {invitePartnerOrg ? (
                      <Text style={styles.helperText}>This member will only see data for {invitePartnerOrg}</Text>
                    ) : null}
                  </>
                )}

                {inviteRole === 'partner' && (!project?.partner_organizations || project.partner_organizations.length === 0) && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningText}>
                      ⚠️ No partner organizations configured. Please add partner organizations in project settings before inviting partner members.
                    </Text>
                  </View>
                )}

                {/* Permissions info */}
                <Text style={styles.sectionLabel}>Member Permissions</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>All members receive the same fixed permissions:</Text>
                  {FIXED_MEMBER_PERMISSIONS.map(permission => (
                    <View key={permission} style={styles.permissionInfoRow}>
                      <Icon source="check-circle" size={14} color={colors.status.success} />
                      <Text style={styles.permissionInfoText}>{PERMISSION_DISPLAY_NAMES[permission]}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Action row */}
              <View style={styles.dialogActionRow}>
                <TouchableOpacity style={styles.dialogCancelBtn} onPress={dismissInvite} disabled={isInviting}>
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogPrimaryBtn, (isInviting || selectedUsers.length === 0) && styles.dialogBtnDisabled]}
                  onPress={handleInviteMember}
                  disabled={isInviting || selectedUsers.length === 0}
                >
                  {isInviting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.dialogPrimaryText}>
                        {selectedUsers.length > 1 ? `Send ${selectedUsers.length} Invites` : 'Send Invite'}
                      </Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEditDialog = () => {
    const availableRoles = (Object.keys(ROLE_DISPLAY_NAMES) as ProjectMemberRole[]).filter(role => {
      if (role === 'owner') return false;
      if (role === 'partner' && !project?.has_partners) return false;
      return true;
    });

    return (
      <Modal
        visible={showEditDialog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditDialog(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditDialog(false)} />
          <View style={[styles.editBottomSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.handleBar} />
            <View style={styles.dialogTitleRow}>
              <View style={styles.dialogTitleAccent} />
              <Text style={styles.dialogTitleText}>Edit Member</Text>
              <TouchableOpacity onPress={() => setShowEditDialog(false)} style={styles.sheetCloseBtn}>
                <Icon source="close" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.editSheetContent}>
              <Text style={styles.editMemberName}>
                {editingMember?.user_details?.username || editingMember?.username}
              </Text>

              <Text style={styles.sectionLabel}>Role</Text>
              <View style={styles.roleChipRow}>
                {availableRoles.map(role => (
                  <TouchableOpacity
                    key={role}
                    style={[styles.roleOptionChip, editRole === role && styles.roleOptionChipActive]}
                    onPress={() => handleRoleChange(role, true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.roleOptionChipText, editRole === role && styles.roleOptionChipTextActive]}>
                      {ROLE_DISPLAY_NAMES[role]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Member Permissions</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>All members have the same fixed permissions:</Text>
                {FIXED_MEMBER_PERMISSIONS.map(permission => (
                  <View key={permission} style={styles.permissionInfoRow}>
                    <Icon source="check-circle" size={14} color={colors.status.success} />
                    <Text style={styles.permissionInfoText}>{PERMISSION_DISPLAY_NAMES[permission]}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.dialogActionRow}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowEditDialog(false)} disabled={isUpdating}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogPrimaryBtn, isUpdating && styles.dialogBtnDisabled]}
                onPress={handleUpdateMember}
                disabled={isUpdating}
              >
                {isUpdating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.dialogPrimaryText}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderActionSheet = () => {
    const member = actionSheetMember;
    return (
      <Modal
        visible={showActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionSheet(false)} />
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.handleBar} />
            {member && (
              <Text style={styles.actionSheetTitle}>
                {member.user_details?.username || member.username}
              </Text>
            )}
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => { setShowActionSheet(false); if (member) openEditDialog(member); }}
              activeOpacity={0.7}
            >
              <Icon source="pencil-outline" size={20} color={colors.text.primary} />
              <Text style={styles.actionSheetItemText}>Edit Role</Text>
            </TouchableOpacity>
            <View style={styles.actionSheetDivider} />
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => { setShowActionSheet(false); if (member) handleRemoveMember(member); }}
              activeOpacity={0.7}
            >
              <Icon source="account-remove-outline" size={20} color={colors.status.error} />
              <Text style={[styles.actionSheetItemText, { color: colors.status.error }]}>Remove from Project</Text>
            </TouchableOpacity>
            <View style={styles.actionSheetDivider} />
            <TouchableOpacity
              style={[styles.actionSheetItem, styles.actionSheetCancel]}
              onPress={() => setShowActionSheet(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderHeader = () => (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.heroNav}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon source="chevron-left" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {canManageMembers && (
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => setShowInviteDialog(true)}
          >
            <Icon source="account-plus-outline" size={16} color={colors.primary.main} />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.heroTitle}>Team</Text>
      <Text style={styles.heroSubtitle}>
        {members.length} active {members.length === 1 ? 'member' : 'members'}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon source="account-group-outline" size={80} color={colors.border.medium} />
      <Text style={styles.emptyTitle}>No Team Members</Text>
      <Text style={styles.emptyText}>
        Invite team members to collaborate on this project
      </Text>
      {canManageMembers && (
        <TouchableOpacity style={styles.emptyButton} onPress={() => setShowInviteDialog(true)} activeOpacity={0.8}>
          <Text style={styles.emptyButtonText}>+ Invite Member</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.heroTitle}>Team</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading team members...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderListContent = () => {
    if (members.length === 0) {
      return renderEmptyState();
    }

    return (
      <View style={styles.listContent}>
        {/* Team Members Section */}
        {renderSectionHeader(`Team Members (${members.length})`)}
        {members.map((member) => (
          <View key={member.id}>{renderMemberItem({ item: member })}</View>
        ))}
      </View>
    );
  };

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary.main} colors={[colors.primary.main]} />}
        contentContainerStyle={styles.scrollContent}
      >
        {renderHeader()}
        {renderListContent()}
      </ScrollView>

      {renderInviteDialog()}
      {renderEditDialog()}
      {renderActionSheet()}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
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
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  inviteBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
  heroTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
  },

  scrollContent: {
    flexGrow: 1,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionHeaderText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Member card
  memberCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  memberAccentBar: {
    height: 3,
  },
  memberCardBody: {
    padding: spacing.md,
  },
  memberHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  memberInitials: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  memberName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  youBadge: {
    backgroundColor: colors.status.infoSurface,
    borderRadius: borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  youBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.info,
  },
  memberEmail: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  roleChip: {
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  roleChipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
  },
  pendingBadge: {
    backgroundColor: colors.sync.pendingSurface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.sync.pending,
  },
  joinedText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  menuBtn: {
    padding: 4,
    marginLeft: spacing.xs,
  },

  // ── Permissions
  permissionsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  permissionsLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionChip: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  permissionChipText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 10,
    color: colors.text.secondary,
  },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: spacing.xs,
  },
  emptyButtonText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  // ── Modal shared
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 61, 43, 0.5)',
  },
  modalKAV: {
    justifyContent: 'flex-end',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.border.medium,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  // ── Invite bottom sheet
  bottomSheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  sheetCloseBtn: {
    padding: 4,
  },

  // ── Edit bottom sheet
  editBottomSheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  editSheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },

  // ── Action sheet
  actionSheet: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
  },
  actionSheetTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  actionSheetItemText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.lg,
  },
  actionSheetCancel: {
    justifyContent: 'center',
    marginTop: spacing.xs,
  },

  // ── Search input
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    padding: 0,
    margin: 0,
  },
  minCharsHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },

  // ── Search results
  searchResultsList: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  searchResultsLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.paper,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: 1,
  },
  resultEmail: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  resultInstitution: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  resultRoleBadge: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  resultRoleBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 10,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },

  // ── No results
  noResults: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  noResultsText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },

  // ── Selected user card
  selectedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary.muted,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  selectedUserLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  selectedUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedUserAvatarText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
  selectedUserName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  selectedUserEmail: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // ── Role chips
  roleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  roleOptionChip: {
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.paper,
  },
  roleOptionChipActive: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.surface,
  },
  roleOptionChipText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  roleOptionChipTextActive: {
    color: colors.primary.main,
  },

  // ── Shared dialog elements
  inviteHelpText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editMemberName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
    color: colors.text.primary,
  },
  helperText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  warningBox: {
    backgroundColor: colors.status.warningSurface,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.warning,
    padding: spacing.sm,
    marginVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  warningText: {
    fontFamily: 'DMSans-Regular',
    color: colors.status.warning,
    fontSize: typography.fontSize.xs,
  },
  infoBox: {
    backgroundColor: colors.primary.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
    padding: spacing.sm,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  infoText: {
    fontFamily: 'DMSans-Regular',
    color: colors.primary.main,
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  permissionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginVertical: 2,
  },
  permissionInfoText: {
    fontFamily: 'DMSans-Regular',
    color: colors.primary.main,
    fontSize: typography.fontSize.xs,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  dialogTitleAccent: {
    width: 4,
    height: 26,
    backgroundColor: colors.primary.main,
    borderRadius: 2,
  },
  dialogTitleText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
  },
  dialogActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  dialogPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogPrimaryText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  dialogBtnDisabled: {
    opacity: 0.45,
  },

  // ── Invite queue
  queueSection: {
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.muted,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  queueLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: colors.primary.main,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  queueClearAll: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  queueChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  queueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: colors.primary.muted,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 8,
    maxWidth: 180,
  },
  queueChipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary.main + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueChipInitials: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 9,
    color: colors.primary.main,
  },
  queueChipName: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    flex: 1,
  },
});

export default React.memo(MembersScreen);
