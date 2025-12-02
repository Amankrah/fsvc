import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  FAB,
  Portal,
  Dialog,
  TextInput,
  Button,
  Surface,
  IconButton,
  Chip,
  Menu,
  Divider,
  ActivityIndicator,
  Checkbox,
  List,
} from 'react-native-paper';
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

type RootStackParamList = {
  Members: { projectId: string };
};

type MembersScreenRouteProp = RouteProp<RootStackParamList, 'Members'>;

// Role and Permission configurations
const ROLE_DISPLAY_NAMES: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  member: 'Member',
  analyst: 'Analyst',
  collaborator: 'Collaborator',
  partner: 'Partner Organization',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<ProjectMemberRole, string> = {
  owner: '#6200ee',
  member: '#03dac6',
  analyst: '#ff6f00',
  collaborator: '#00bcd4',
  partner: '#9c27b0',
  viewer: '#9e9e9e',
};

const PERMISSION_DISPLAY_NAMES: Record<ProjectPermission, string> = {
  all: 'All Permissions',
  view_project: 'View Project',
  edit_project: 'Edit Project',
  view_responses: 'View Responses',
  edit_responses: 'Edit Responses',
  delete_responses: 'Delete Responses',
  view_analytics: 'View Analytics',
  run_analytics: 'Run Analytics',
  manage_questions: 'Manage Questions',
  export_data: 'Export Data',
};

const DEFAULT_PERMISSIONS_FOR_ROLE: Record<Exclude<ProjectMemberRole, 'owner'>, ProjectPermission[]> = {
  viewer: ['view_project', 'view_responses'],
  member: ['view_project', 'view_responses', 'edit_responses', 'view_analytics'],
  analyst: ['view_project', 'view_responses', 'view_analytics', 'run_analytics', 'export_data'],
  collaborator: [
    'view_project',
    'edit_project',
    'view_responses',
    'edit_responses',
    'view_analytics',
    'run_analytics',
    'manage_questions',
    'export_data',
  ],
  partner: ['view_project', 'view_responses', 'view_analytics', 'export_data'],
};

const MembersScreen: React.FC = () => {
  const route = useRoute<MembersScreenRouteProp>();
  const { projectId } = route.params;
  const { user } = useAuthStore();

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [project, setProject] = useState<any>(null);

  // Invite Dialog State
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [inviteRole, setInviteRole] = useState<ProjectMemberRole>('member');
  const [invitePermissions, setInvitePermissions] = useState<ProjectPermission[]>(
    DEFAULT_PERMISSIONS_FOR_ROLE.member
  );
  const [invitePartnerOrg, setInvitePartnerOrg] = useState<string>('');
  const [isInviting, setIsInviting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showPartnerMenu, setShowPartnerMenu] = useState(false);

  // Edit Member Dialog State
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<ProjectMember | null>(null);
  const [editRole, setEditRole] = useState<ProjectMemberRole>('member');
  const [editPermissions, setEditPermissions] = useState<ProjectPermission[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditRoleMenu, setShowEditRoleMenu] = useState(false);

  // Member Actions Menu State
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);

  // Permission to manage members (only owner can manage)
  const canManageMembers = members.find((m) => m.id === user?.id)?.role === 'owner' || false;

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
      
      // Filter out users who are already members of this project
      const memberEmails = members.map(m => m.email);
      const filteredUsers = response.users.filter(user => !memberEmails.includes(user.email));
      
      setSearchedUsers(filteredUsers);
    } catch (error: any) {
      console.error('Error searching users:', error);
      setSearchedUsers([]);
    } finally {
      setIsSearching(false);
    }
  }, [members]);

  const handleUserSelect = useCallback((user: SearchedUser) => {
    setSelectedUser(user);
    setUserSearchQuery(user.full_name || user.username);
    setSearchedUsers([]);
  }, []);

  const handleInviteMember = useCallback(async () => {
    if (!selectedUser) {
      Alert.alert('Error', 'Please select a user to invite');
      return;
    }

    // Validate partner organization for partner role
    if (inviteRole === 'partner' && !invitePartnerOrg) {
      Alert.alert('Error', 'Please select a partner organization for partner role');
      return;
    }

    setIsInviting(true);
    try {
      const inviteData: InviteMemberData = {
        user_id: selectedUser.id,
        role: inviteRole,
        permissions: invitePermissions,
        partner_organization: inviteRole === 'partner' ? invitePartnerOrg : undefined,
      };

      await apiService.inviteMember(projectId, inviteData);

      Alert.alert('Success', `${selectedUser.full_name || selectedUser.username} has been invited to the project! They will receive a notification to accept the invitation.`);
      setUserSearchQuery('');
      setSelectedUser(null);
      setSearchedUsers([]);
      setInviteRole('member');
      setInvitePermissions(DEFAULT_PERMISSIONS_FOR_ROLE.member);
      setInvitePartnerOrg('');
      setShowInviteDialog(false);
      loadMembers();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.details?.user_id?.[0] ||
        error.response?.data?.details?.partner_organization?.[0] ||
        'Failed to invite member';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsInviting(false);
    }
  }, [selectedUser, inviteRole, invitePermissions, invitePartnerOrg, projectId, loadMembers]);

  const handleUpdateMember = useCallback(async () => {
    if (!editingMember) return;

    setIsUpdating(true);
    try {
      const updateData: UpdateMemberData = {
        user_id: editingMember.id,
        role: editRole,
        permissions_list: editPermissions,
      };

      await apiService.updateMember(projectId, updateData);

      Alert.alert('Success', 'Member updated successfully');
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
  }, [editingMember, editRole, editPermissions, projectId, loadMembers]);

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
                await apiService.removeMember(projectId, member.id);
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
    setEditPermissions(member.permissions);
    setShowEditDialog(true);
    setActiveMenuMemberId(null);
  }, []);

  const handleRoleChange = useCallback((role: ProjectMemberRole, isEditMode: boolean = false) => {
    if (isEditMode) {
      setEditRole(role);
      if (role !== 'owner') {
        setEditPermissions(DEFAULT_PERMISSIONS_FOR_ROLE[role]);
      }
      setShowEditRoleMenu(false);
    } else {
      setInviteRole(role);
      if (role !== 'owner') {
        setInvitePermissions(DEFAULT_PERMISSIONS_FOR_ROLE[role]);
      }
      // Reset partner organization if role is not partner
      if (role !== 'partner') {
        setInvitePartnerOrg('');
      }
      setShowRoleMenu(false);
    }
  }, []);

  const togglePermission = useCallback((permission: ProjectPermission, isEditMode: boolean = false) => {
    if (isEditMode) {
      setEditPermissions((prev) =>
        prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
      );
    } else {
      setInvitePermissions((prev) =>
        prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
      );
    }
  }, []);

  const renderMemberItem = ({ item }: { item: ProjectMember }) => {
    const isOwner = item.role === 'owner';
    const isCurrentUser = item.id === user?.id;

    return (
      <Surface style={styles.memberCard} elevation={1}>
        <View style={styles.memberHeader}>
          <View style={styles.memberAvatar}>
            <IconButton icon="account" size={32} iconColor="#6200ee" />
          </View>

          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text variant="titleMedium" style={styles.memberName}>
                {item.username}
              </Text>
              {isCurrentUser && <Chip style={styles.youChip}>You</Chip>}
            </View>
            <Text variant="bodySmall" style={styles.memberEmail}>
              {item.email}
            </Text>
            <View style={styles.memberMeta}>
              <Chip
                mode="flat"
                style={[styles.roleChip, { backgroundColor: ROLE_COLORS[item.role] + '20' }]}
                textStyle={{ color: ROLE_COLORS[item.role] }}
              >
                {ROLE_DISPLAY_NAMES[item.role]}
              </Chip>
              <Text variant="bodySmall" style={styles.joinedText}>
                Joined {new Date(item.joined_at).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {canManageMembers && !isOwner && (
            <Menu
              visible={activeMenuMemberId === item.id}
              onDismiss={() => setActiveMenuMemberId(null)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => setActiveMenuMemberId(item.id)}
                />
              }
            >
              <Menu.Item
                leadingIcon="pencil"
                onPress={() => openEditDialog(item)}
                title="Edit Role & Permissions"
              />
              <Divider />
              <Menu.Item
                leadingIcon="account-remove"
                onPress={() => handleRemoveMember(item)}
                title="Remove from Project"
                titleStyle={{ color: '#d32f2f' }}
              />
            </Menu>
          )}
        </View>

        <View style={styles.permissionsSection}>
          <Text variant="labelSmall" style={styles.permissionsLabel}>
            Permissions:
          </Text>
          <View style={styles.permissionsList}>
            {item.permissions.includes('all') ? (
              <Chip mode="outlined" style={styles.permissionChip} compact>
                All Permissions
              </Chip>
            ) : (
              item.permissions.slice(0, 3).map((perm) => (
                <Chip key={perm} mode="outlined" style={styles.permissionChip} compact>
                  {PERMISSION_DISPLAY_NAMES[perm]}
                </Chip>
              ))
            )}
            {item.permissions.length > 3 && !item.permissions.includes('all') && (
              <Chip mode="outlined" style={styles.permissionChip} compact>
                +{item.permissions.length - 3} more
              </Chip>
            )}
          </View>
        </View>
      </Surface>
    );
  };


  const renderInviteDialog = () => (
    <Dialog visible={showInviteDialog} onDismiss={() => {
      setShowInviteDialog(false);
      setUserSearchQuery('');
      setSelectedUser(null);
      setSearchedUsers([]);
      setInviteRole('member');
      setInvitePermissions(DEFAULT_PERMISSIONS_FOR_ROLE.member);
      setInvitePartnerOrg('');
    }} style={styles.inviteDialog}>
      <Dialog.Title>Invite Team Member</Dialog.Title>
      <Dialog.ScrollArea style={styles.inviteDialogScrollArea}>
        <ScrollView showsVerticalScrollIndicator={true}>
        <View style={styles.dialogContentContainer}>
        <Text variant="bodyMedium" style={styles.inviteHelpText}>
          Search for a registered user to invite to this project. They will receive a notification to accept the invitation.
        </Text>
        
        <TextInput
          label="Search Users (name, email, username)"
          value={userSearchQuery}
          onChangeText={handleUserSearch}
          mode="outlined"
          style={styles.dialogInput}
          autoFocus
          right={isSearching ? <TextInput.Icon icon="loading" /> : undefined}
        />
        
        {/* User search results */}
        {searchedUsers.length > 0 && (
          <View style={styles.searchResults}>
            <Text variant="labelMedium" style={styles.searchResultsLabel}>
              Select a user to invite:
            </Text>
            {searchedUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => handleUserSelect(user)}
                activeOpacity={0.7}
              >
                <Surface
                  style={[
                    styles.userSearchItem,
                    selectedUser?.id === user.id && styles.userSearchItemSelected
                  ]}
                >
                  <View style={styles.userSearchInfo}>
                    <Text variant="titleMedium" style={styles.userSearchName}>
                      {user.full_name || user.username}
                    </Text>
                    <Text variant="bodySmall" style={styles.userSearchEmail}>
                      {user.email}
                    </Text>
                    {user.institution && (
                      <Text variant="bodySmall" style={styles.userSearchInstitution}>
                        {user.institution}
                      </Text>
                    )}
                  </View>
                  <Chip
                    mode="outlined"
                    style={styles.userRoleChip}
                    textStyle={styles.userRoleChipText}
                    compact
                  >
                    {user.role}
                  </Chip>
                </Surface>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {selectedUser && (
          <View style={styles.selectedUserContainer}>
            <Text variant="labelMedium" style={styles.selectedUserLabel}>
              Selected User:
            </Text>
            <Surface style={styles.selectedUserCard}>
              <Text variant="titleMedium">{selectedUser.full_name || selectedUser.username}</Text>
              <Text variant="bodySmall" style={styles.selectedUserEmail}>{selectedUser.email}</Text>
            </Surface>
          </View>
        )}

        <Text variant="labelMedium" style={styles.sectionLabel}>
          Role
        </Text>
        <Menu
          visible={showRoleMenu}
          onDismiss={() => setShowRoleMenu(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setShowRoleMenu(true)}
              style={styles.roleButton}
              icon="chevron-down"
              contentStyle={styles.roleButtonContent}
            >
              {ROLE_DISPLAY_NAMES[inviteRole]}
            </Button>
          }
        >
          {(Object.keys(ROLE_DISPLAY_NAMES) as ProjectMemberRole[])
            .filter((role) => role !== 'owner')
            .map((role) => (
              <Menu.Item
                key={role}
                onPress={() => handleRoleChange(role, false)}
                title={ROLE_DISPLAY_NAMES[role]}
              />
            ))}
        </Menu>

        {inviteRole === 'partner' && project?.partner_organizations && project.partner_organizations.length > 0 && (
          <>
            <Text variant="labelMedium" style={styles.sectionLabel}>
              Partner Organization *
            </Text>
            <Menu
              visible={showPartnerMenu}
              onDismiss={() => setShowPartnerMenu(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setShowPartnerMenu(true)}
                  style={styles.roleButton}
                  icon="chevron-down"
                  contentStyle={styles.roleButtonContent}
                >
                  {invitePartnerOrg || 'Select Partner Organization'}
                </Button>
              }
            >
              {project.partner_organizations.map((partner: any) => (
                <Menu.Item
                  key={partner.name}
                  onPress={() => {
                    setInvitePartnerOrg(partner.name);
                    setShowPartnerMenu(false);
                  }}
                  title={partner.name}
                />
              ))}
            </Menu>
            <Text variant="bodySmall" style={styles.helperText}>
              This member will only see questions and responses for {invitePartnerOrg || 'the selected partner'}
            </Text>
          </>
        )}

        {inviteRole === 'partner' && (!project?.partner_organizations || project.partner_organizations.length === 0) && (
          <View style={styles.warningBox}>
            <Text variant="bodySmall" style={styles.warningText}>
              ⚠️ No partner organizations configured for this project. Please add partner organizations in project settings before inviting partner members.
            </Text>
          </View>
        )}

        <Text variant="labelMedium" style={styles.sectionLabel}>
          Permissions
        </Text>
        {(Object.keys(PERMISSION_DISPLAY_NAMES) as ProjectPermission[])
          .filter((perm) => perm !== 'all')
          .map((permission) => (
            <List.Item
              key={permission}
              title={PERMISSION_DISPLAY_NAMES[permission]}
              left={() => (
                <Checkbox
                  status={invitePermissions.includes(permission) ? 'checked' : 'unchecked'}
                  onPress={() => togglePermission(permission, false)}
                />
              )}
              onPress={() => togglePermission(permission, false)}
              style={styles.permissionItem}
            />
          ))}
        </View>
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Button onPress={() => setShowInviteDialog(false)} disabled={isInviting}>
          Cancel
        </Button>
        <Button
          onPress={handleInviteMember}
          loading={isInviting}
          disabled={isInviting || !selectedUser}
        >
          Send Invite
        </Button>
      </Dialog.Actions>
    </Dialog>
  );

  const renderEditDialog = () => (
    <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)}>
      <Dialog.Title>Edit Member</Dialog.Title>
      <Dialog.Content>
        <Text variant="bodyMedium" style={styles.editMemberName}>
          {editingMember?.username}
        </Text>

        <Text variant="labelMedium" style={styles.sectionLabel}>
          Role
        </Text>
        <Menu
          visible={showEditRoleMenu}
          onDismiss={() => setShowEditRoleMenu(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setShowEditRoleMenu(true)}
              style={styles.roleButton}
              icon="chevron-down"
              contentStyle={styles.roleButtonContent}
            >
              {ROLE_DISPLAY_NAMES[editRole]}
            </Button>
          }
        >
          {(Object.keys(ROLE_DISPLAY_NAMES) as ProjectMemberRole[])
            .filter((role) => role !== 'owner')
            .map((role) => (
              <Menu.Item
                key={role}
                onPress={() => handleRoleChange(role, true)}
                title={ROLE_DISPLAY_NAMES[role]}
              />
            ))}
        </Menu>

        <Text variant="labelMedium" style={styles.sectionLabel}>
          Permissions
        </Text>
        {(Object.keys(PERMISSION_DISPLAY_NAMES) as ProjectPermission[])
          .filter((perm) => perm !== 'all')
          .map((permission) => (
            <List.Item
              key={permission}
              title={PERMISSION_DISPLAY_NAMES[permission]}
              left={() => (
                <Checkbox
                  status={editPermissions.includes(permission) ? 'checked' : 'unchecked'}
                  onPress={() => togglePermission(permission, true)}
                />
              )}
              onPress={() => togglePermission(permission, true)}
              style={styles.permissionItem}
            />
          ))}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={() => setShowEditDialog(false)} disabled={isUpdating}>
          Cancel
        </Button>
        <Button onPress={handleUpdateMember} loading={isUpdating} disabled={isUpdating}>
          Update
        </Button>
      </Dialog.Actions>
    </Dialog>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text variant="headlineSmall" style={styles.headerTitle}>
        Team Members
      </Text>
      <Text variant="bodyMedium" style={styles.headerSubtitle}>
        {members.length} active {members.length === 1 ? 'member' : 'members'}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconButton icon="account-group-outline" size={80} iconColor="#ccc" />
      <Text variant="titleLarge" style={styles.emptyTitle}>
        No Team Members
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        Invite team members to collaborate on this project
      </Text>
      {canManageMembers && (
        <Button
          mode="contained"
          onPress={() => setShowInviteDialog(true)}
          style={styles.emptyButton}
          icon="plus"
        >
          Invite Member
        </Button>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading team members...
        </Text>
      </View>
    );
  }

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text variant="titleMedium" style={styles.sectionHeaderText}>
        {title}
      </Text>
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
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {renderHeader()}
        {renderListContent()}
      </ScrollView>

      {canManageMembers && members.length > 0 && (
        <FAB
          icon="account-plus"
          style={styles.fab}
          onPress={() => setShowInviteDialog(true)}
          label="Invite"
        />
      )}

      <Portal>
        {renderInviteDialog()}
        {renderEditDialog()}
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: '#666',
  },
  scrollContent: {
    flexGrow: 1,
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontWeight: 'bold',
    color: '#333',
  },
  memberCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'white',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    fontWeight: 'bold',
  },
  youChip: {
    height: 24,
    backgroundColor: '#e3f2fd',
  },
  memberEmail: {
    color: '#666',
    marginBottom: 8,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleChip: {
    alignSelf: 'flex-start',
  },
  joinedText: {
    color: '#999',
  },
  permissionsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  permissionsLabel: {
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  permissionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionChip: {
    height: 28,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  inviteHelpText: {
    color: '#666',
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  dialogInput: {
    marginBottom: 16,
  },
  searchResults: {
    maxHeight: 200,
    marginBottom: 16,
  },
  searchResultsLabel: {
    color: '#666',
    marginBottom: 8,
  },
  userSearchItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userSearchItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#6200ee',
  },
  userSearchInfo: {
    flex: 1,
  },
  userSearchName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  userSearchEmail: {
    color: '#666',
    marginBottom: 2,
  },
  userSearchInstitution: {
    color: '#999',
    fontStyle: 'italic',
  },
  userRoleChip: {
    height: 24,
  },
  userRoleChipText: {
    fontSize: 12,
  },
  selectedUserContainer: {
    marginBottom: 16,
  },
  selectedUserLabel: {
    color: '#666',
    marginBottom: 8,
  },
  selectedUserCard: {
    padding: 12,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  selectedUserEmail: {
    color: '#666',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    color: '#666',
  },
  roleButton: {
    marginBottom: 8,
  },
  roleButtonContent: {
    flexDirection: 'row-reverse',
  },
  permissionItem: {
    paddingLeft: 0,
  },
  editMemberName: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  helperText: {
    color: '#6c757d',
    fontSize: 12,
    marginTop: -4,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    padding: 12,
    marginVertical: 12,
    borderRadius: 4,
  },
  warningText: {
    color: '#856404',
  },
  inviteDialog: {
    maxHeight: '85%',
  },
  inviteDialogScrollArea: {
    maxHeight: 450,
    paddingHorizontal: 0,
  },
  dialogContentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
});

export default React.memo(MembersScreen);