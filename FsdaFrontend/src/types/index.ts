/**
 * TypeScript Types for FSDA Data Collection Tool
 */

// User Types
export interface User {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  institution?: string;
  is_active?: boolean;
}

// Project Member Types
export type ProjectMemberRole = 'owner' | 'member' | 'analyst' | 'collaborator' | 'partner' | 'viewer';

export type ProjectPermission =
  | 'all'
  | 'view_project'
  | 'edit_project'
  | 'view_responses'
  | 'edit_responses'
  | 'delete_responses'
  | 'view_analytics'
  | 'run_analytics'
  | 'manage_questions'
  | 'export_data';

export interface ProjectMember {
  id: string;
  username: string;
  email: string;
  role: ProjectMemberRole;
  permissions: ProjectPermission[];
  partner_organization?: string;
  is_partner?: boolean;
  accessible_question_sources?: string[];
  joined_at: string;
  is_creator: boolean;
}

export interface ProjectMemberDetails {
  id: string;
  user: string;
  user_details: User;
  role: ProjectMemberRole;
  permissions: string;
  permissions_list: ProjectPermission[];
  partner_organization?: string;
  is_partner?: boolean;
  accessible_question_sources?: string[];
  partner_config?: {
    name: string;
    contact_email?: string;
    has_database_endpoint: boolean;
    has_api_key: boolean;
  };
  joined_at: string;
  invited_by?: string;
  invited_by_details?: User;
}

export interface InviteMemberData {
  user_id: string;
  role: ProjectMemberRole;
  permissions?: ProjectPermission[];
  partner_organization?: string;
}

export interface SearchedUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  institution?: string;
}

export interface UserSearchResponse {
  users: SearchedUser[];
  count: number;
  query: string;
  message?: string;
}

export interface UpdateMemberData {
  user_id: string;
  role?: ProjectMemberRole;
  permissions_list?: ProjectPermission[];
  partner_organization?: string;
}

export interface PendingInvitationMember {
  id: string;
  email: string;
  role: ProjectMemberRole;
  permissions: ProjectPermission[];
  invited_by: string;
  invited_at: string;
  expires_at: string;
  is_valid: boolean;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  is_pending: true;
}

export interface TeamMembersResponse {
  team_members: ProjectMember[];
  pending_invitations: PendingInvitationMember[];
  total_count: number;
  pending_count: number;
  total_including_pending: number;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: ProjectMemberRole;
  project_name: string;
  project_description?: string;
  invited_by: string;
  expires_at: string;
  is_valid: boolean;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
}

export interface InvitationInfoResponse {
  invitation: PendingInvitation;
}

// Notification Types
export interface UserNotification {
  id: string;
  title: string;
  message: string;
  type: 'team_invitation' | 'project_update' | 'system_message' | 'welcome';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_read: boolean;
  created_at: string;
  action_url?: string;
  action_text?: string;
  related_project_id?: string;
  is_expired: boolean;
}

export interface NotificationsResponse {
  notifications: UserNotification[];
  unread_count: number;
  total_count: number;
}

export interface PartnerOrganization {
  user_id: string;  // ID of the registered user who is the partner
  name: string;  // Full name or organization name
  username: string;  // Username of the partner user
  contact_email?: string;
  institution?: string;  // Partner's institution
  database_endpoint?: string;  // Optional AWS RDS endpoint or API URL
  api_key?: string;  // Optional authentication key for the partner database
  organization_type?: string;
  description?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_by_details?: User;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced' | 'error';
  cloud_id?: string;
  settings: Record<string, any>;
  metadata: Record<string, any>;
  question_count: number;
  response_count: number;
  team_members_count: number;
  team_members?: ProjectMember[];
  user_permissions?: string[];
  has_partners: boolean;
  partner_organizations: PartnerOrganization[];
  owner_database_endpoint?: string;  // Owner's database endpoint (AWS RDS or API URL)
  targeted_respondents: RespondentType[];
  targeted_commodities: CommodityType[];
  targeted_countries: string[];
}

export interface CreateProjectData {
  name: string;
  description?: string;
  settings?: Record<string, any>;
  metadata?: Record<string, any>;
  has_partners?: boolean;
  partner_organizations?: PartnerOrganization[];
  owner_database_endpoint?: string;  // Owner's database endpoint
  targeted_respondents?: RespondentType[];
  targeted_commodities?: CommodityType[];
  targeted_countries?: string[];
}

// Form/Question Types
export type ResponseType =
  | 'text_short'
  | 'text_long'
  | 'numeric_integer'
  | 'numeric_decimal'
  | 'scale_rating'
  | 'choice_single'
  | 'choice_multiple'
  | 'date'
  | 'datetime'
  | 'geopoint'
  | 'geoshape'
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'signature'
  | 'barcode';

export interface ValidationRule {
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  data_type?: string;
  format?: string;
  requires_gps?: boolean;
  max_size_mb?: number;
  accepted_formats?: string[];
}

export interface Question {
  id: string;
  project: string;
  project_details?: Project;
  question_bank_source?: string;
  question_bank_source_details?: QuestionBank;
  question_text: string;
  response_type: ResponseType;
  is_required: boolean;
  allow_multiple: boolean;
  options?: string[];
  validation_rules?: ValidationRule;
  order_index: number;
  created_at: string;
  sync_status: 'pending' | 'synced' | 'error';
  assigned_respondent_type?: string;
  assigned_commodity?: string;
  assigned_country?: string;
  is_dynamically_generated?: boolean;
  research_partner_info?: ResearchPartnerInfo;
  should_send_response_to_partner?: boolean;
  is_owner_question: boolean;
  partner_organization?: PartnerOrganization;
  partner_data_storage?: string;
  targeted_respondents: RespondentType[];
  question_sources?: string[];  // Array of source names: ['owner', 'Partner A', etc.]
}

export interface CreateQuestionData {
  question_text: string;
  response_type: ResponseType;
  is_required?: boolean;
  allow_multiple?: boolean;
  options?: string[];
  validation_rules?: ValidationRule;
  order_index?: number;
  is_owner_question?: boolean;
  partner_organization?: PartnerOrganization;
  partner_data_storage?: string;
  targeted_respondents?: RespondentType[];
}

export interface ResponseTypeInfo {
  value: ResponseType;
  display_name: string;
  category: string;
  supports_options: boolean;
  supports_validation: boolean;
  supports_media: boolean;
  supports_location: boolean;
  default_validation_rules?: ValidationRule;
  icon?: string;
}

// Response Types
export interface Response {
  id: string;
  project: string;
  question: string;
  respondent_id: string;
  response_value: string | number | boolean | any;
  metadata?: Record<string, any>;
  created_at: string;
  sync_status: 'pending' | 'synced' | 'error';
}

// Sync Types
export interface SyncStatus {
  id: string;
  project: string;
  last_sync_at?: string;
  sync_type: 'push' | 'pull' | 'full';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  items_synced: number;
  items_failed: number;
  error_message?: string;
  created_at: string;
}

// Analytics Types
export interface AnalyticsResult {
  id: string;
  project: string;
  analysis_type: string;
  result_data: Record<string, any>;
  created_at: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  message: string;
  error?: string;
  statusCode?: number;
  details?: Record<string, string[]>;
}

// QuestionBank Types
export type RespondentType =
  | 'input_suppliers'
  | 'farmers'
  | 'aggregators_lbcs'
  | 'processors'
  | 'processors_eu'
  | 'retailers_food_vendors'
  | 'retailers_food_vendors_eu'
  | 'local_consumers'
  | 'consumers_eu_prolific'
  | 'client_business_eu_prolific'
  | 'government'
  | 'ngos'
  | 'certification_schemes'
  | 'coop'
  | 'chief';

export type CommodityType = 'cocoa' | 'maize' | 'palm_oil' | 'groundnut' | 'honey';

export type QuestionCategory =
  | 'production'
  | 'processing'
  | 'distribution'
  | 'consumption'
  | 'waste_management'
  | 'input_supply'
  | 'market_access'
  | 'quality_standards'
  | 'certification'
  | 'sustainability'
  | 'climate_impact'
  | 'social_impact'
  | 'economic_impact'
  | 'governance'
  | 'policy'
  | 'technology'
  | 'logistics'
  | 'finance'
  | 'nutrition'
  | 'food_safety';

export type DataSourceType =
  | 'internal'
  | 'partner_university'
  | 'partner_ngo'
  | 'partner_government'
  | 'partner_private'
  | 'partner_international'
  | 'consultant'
  | 'collaborative';

export interface ResearchPartnerInfo {
  data_source: DataSourceType;
  partner_name?: string;
  partner_contact?: string;
  work_package?: string;
}

export interface QuestionBank {
  id: string;
  question_text: string;
  question_category: QuestionCategory;
  targeted_respondents: RespondentType[];
  targeted_commodities: CommodityType[];
  targeted_countries: string[];
  data_source: DataSourceType;
  research_partner_name?: string;
  research_partner_contact?: string;
  work_package?: string;
  base_project?: string;
  base_project_details?: Project;
  response_type: ResponseType;
  is_required: boolean;
  allow_multiple: boolean;
  options?: string[];
  validation_rules?: ValidationRule;
  priority_score: number;
  is_active: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  targeted_respondents_display?: string[];
  targeted_commodities_display?: string[];
}

export interface CreateQuestionBankData {
  question_text: string;
  question_category: QuestionCategory;
  targeted_respondents: RespondentType[];
  targeted_commodities?: CommodityType[];
  targeted_countries?: string[];
  data_source?: DataSourceType;
  research_partner_name?: string;
  research_partner_contact?: string;
  work_package?: string;
  base_project?: string;
  response_type: ResponseType;
  is_required?: boolean;
  allow_multiple?: boolean;
  options?: string[];
  validation_rules?: ValidationRule;
  priority_score?: number;
  is_active?: boolean;
  tags?: string[];
}

export interface DynamicQuestionSession {
  id: string;
  project: string;
  project_details?: Project;
  respondent_type: RespondentType;
  commodity?: string;
  country?: string;
  categories: QuestionCategory[];
  work_packages: string[];
  questions_generated: number;
  questions_from_partners: Record<string, number>;
  created_by?: string;
  created_at: string;
  notes?: string;
  partner_distribution?: Record<string, number>;
  questions_count?: number;
}

export interface GenerateDynamicQuestionsData {
  project: string;
  respondent_type: RespondentType;
  commodity?: CommodityType;
  country?: string;
  categories?: QuestionCategory[];
  work_packages?: string[];
  replace_existing?: boolean;
  notes?: string;
}

export interface QuestionBankSearchData {
  respondent_type: RespondentType;
  commodity?: CommodityType;
  country?: string;
  categories?: QuestionCategory[];
  work_packages?: string[];
  data_sources?: DataSourceType[];
  limit?: number;
  include_inactive?: boolean;
}

export interface QuestionBankChoices {
  respondent_types: Array<{ value: RespondentType; label: string }>;
  commodities: Array<{ value: CommodityType; label: string }>;
  categories: Array<{ value: QuestionCategory; label: string }>;
  data_sources: Array<{ value: DataSourceType; label: string }>;
}

export interface DynamicQuestionGenerationResult {
  questions: Question[];
  session: DynamicQuestionSession;
  summary: {
    questions_generated: number;
    partner_distribution: Record<string, number>;
    respondent_type: RespondentType;
    commodity?: string;
    categories: QuestionCategory[];
    work_packages: string[];
    replaced_existing: boolean;
  };
}

export interface QuestionPreviewResult {
  preview_questions: QuestionBank[];
  preview_summary: {
    total_questions: number;
    partner_distribution: Record<string, number>;
    category_distribution: Record<string, number>;
    search_parameters: QuestionBankSearchData;
  };
}

export interface PartnerDistributionResult {
  partner_distribution: Record<string, {
    partner_info: ResearchPartnerInfo;
    questions: Question[];
    question_count: number;
  }>;
  summary: {
    total_partners: number;
    total_questions: number;
    project_id: string;
  };
}

// Dynamic Question Generation Form Data
export interface DynamicQuestionFormData {
  respondent_type: RespondentType;
  commodity?: CommodityType;
  country?: string;
  categories?: QuestionCategory[];
  work_packages?: string[];
  replace_existing?: boolean;
  notes?: string;
}