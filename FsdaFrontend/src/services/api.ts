import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '../utils/secureStorage';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../config/env';
import { CreateProjectData, CreateQuestionData } from '../types';

// Django Token Auth Response Format
interface LoginResponse {
  token: string;
  user_data?: {
    id: string;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    institution?: string;
  };
}

interface RegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    institution?: string;
  };
}

class ApiService {
  private axiosInstance: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
  }> = [];

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - Django uses Token authentication
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const token = await secureStorage.getItem('auth_token');

        if (token && config.headers) {
          // Django Rest Framework Token format: "Token <token>"
          config.headers.Authorization = `Token ${token}`;
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle 401 errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Django Token auth doesn't support refresh tokens by default
        // On 401, clear auth and redirect to login
        if (error.response?.status === 401) {
          useAuthStore.getState().clearAuth();
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints - Django Token Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.axiosInstance.post<LoginResponse>('/auth/login/', {
      email,
      password,
    });
    return response.data;
  }

  async register(
    email: string,
    username: string,
    password: string,
    password2: string,
    firstName: string,
    lastName: string,
    role?: string,
    institution?: string
  ): Promise<RegisterResponse> {
    const response = await this.axiosInstance.post<RegisterResponse>('/auth/register/', {
      email,
      username,
      password,
      password2,
      first_name: firstName,
      last_name: lastName,
      role: role || 'researcher',
      institution: institution || '',
    });
    return response.data;
  }

  async logout() {
    const response = await this.axiosInstance.post('/auth/logout/');
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.axiosInstance.get('/auth/profile/');
    return response.data;
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return await this.get('/v1/dashboard-stats/');
  }

  // Project endpoints
  async getProjects() {
    return await this.get('/projects/projects/');
  }

  async getProject(id: string) {
    return await this.get(`/projects/projects/${id}/`);
  }

  async createProject(data: CreateProjectData) {
    return await this.post('/projects/projects/', data);
  }

  async updateProject(id: string, data: Partial<CreateProjectData>) {
    return await this.patch(`/projects/projects/${id}/`, data);
  }

  async deleteProject(id: string) {
    return await this.delete(`/projects/projects/${id}/`);
  }

  // Project Member endpoints
  async getProjectMembers(projectId: string) {
    return await this.get(`/projects/projects/${projectId}/members/`);
  }

  async inviteMember(projectId: string, data: { user_id: string; role: string; permissions?: string[] }) {
    return await this.post(`/projects/projects/${projectId}/invite_member/`, data);
  }

  async updateMember(projectId: string, data: { user_id: string; role?: string; permissions_list?: string[] }) {
    return await this.patch(`/projects/projects/${projectId}/update_member/`, data);
  }

  async removeMember(projectId: string, userId: string) {
    return await this.delete(`/projects/projects/${projectId}/remove_member/?user_id=${userId}`);
  }

  async getAvailableUsers() {
    return await this.get('/projects/projects/available_users/');
  }

  async cancelInvitation(projectId: string, invitationId: string) {
    return await this.delete(`/projects/projects/${projectId}/cancel_invitation/?invitation_id=${invitationId}`);
  }

  async resendInvitation(projectId: string, invitationId: string) {
    return await this.post(`/projects/projects/${projectId}/resend_invitation/`, { invitation_id: invitationId });
  }

  async getInvitationInfo(token: string) {
    return await this.get(`/projects/projects/get_invitation_info/?token=${token}`);
  }

  async acceptInvitation(token: string) {
    return await this.post('/projects/projects/accept_invitation/', { invitation_token: token });
  }

  // Form/Question endpoints
  // Question endpoints (project-specific question instances)
  async getQuestions(projectId: string) {
    // Set page_size to a large number to get all questions (backend max is 100, but we can request more)
    return await this.get(`/forms/questions/?project_id=${projectId}&page_size=1000`);
  }

  async getQuestionsForRespondent(
    projectId: string,
    filters: {
      assigned_respondent_type?: string;
      assigned_commodity?: string;
      assigned_country?: string;
    },
    pagination?: {
      page?: number;
      page_size?: number;
    }
  ) {
    // Build query params
    const params = new URLSearchParams({ project_id: projectId });

    if (filters.assigned_respondent_type) {
      params.append('assigned_respondent_type', filters.assigned_respondent_type);
    }
    if (filters.assigned_commodity) {
      params.append('assigned_commodity', filters.assigned_commodity);
    }
    if (filters.assigned_country) {
      params.append('assigned_country', filters.assigned_country);
    }

    // Add pagination parameters if provided
    if (pagination?.page) {
      params.append('page', String(pagination.page));
    }
    if (pagination?.page_size) {
      params.append('page_size', String(pagination.page_size));
    }

    return await this.get(`/forms/questions/get_for_respondent/?${params.toString()}`);
  }

  async getQuestion(id: string) {
    return await this.get(`/forms/questions/${id}/`);
  }

  async createQuestion(projectId: string, data: any) {
    return await this.post('/forms/questions/', { ...data, project: projectId });
  }

  async bulkCreateQuestions(projectId: string, questions: any[], replace = false) {
    const questionsData = questions.map(q => ({ ...q, project: projectId }));
    return await this.post(`/forms/questions/bulk_create/?replace=${replace}`, questionsData);
  }

  async updateQuestion(id: string, data: Partial<CreateQuestionData>) {
    return await this.patch(`/forms/questions/${id}/`, data);
  }

  async deleteQuestion(id: string) {
    return await this.delete(`/forms/questions/${id}/`);
  }

  async bulkDeleteQuestions(data: {
    question_ids?: string[];
    project_id?: string;
    question_bank_source_id?: string;
    assigned_respondent_type?: string;
  }) {
    return await this.post('/forms/questions/bulk_delete/', data);
  }

  async reorderQuestions(projectId: string, questionIds: string[]) {
    return await this.post('/forms/questions/bulk_update_order/', {
      question_ids: questionIds,
      project_id: projectId,
    });
  }

  async deleteAllProjectQuestions(projectId: string) {
    return await this.bulkDeleteQuestions({ project_id: projectId });
  }

  async getResponseTypes() {
    return await this.get('/forms/questions/response_types/');
  }

  async validateQuestions(questions: any[]) {
    return await this.post('/forms/questions/validate_questions/', questions);
  }

  async bulkUpdateQuestionOrder(questionIds: string[]) {
    return await this.post('/forms/questions/bulk_update_order/', { question_ids: questionIds });
  }

  async exportGeneratedQuestionsJSON(
    projectId: string,
    filters?: {
      assigned_respondent_type?: string;
      assigned_commodity?: string;
      assigned_country?: string;
    }
  ) {
    const token = await secureStorage.getItem('auth_token');
    const params = new URLSearchParams({ project_id: projectId });

    if (filters?.assigned_respondent_type) {
      params.append('assigned_respondent_type', filters.assigned_respondent_type);
    }
    if (filters?.assigned_commodity) {
      params.append('assigned_commodity', filters.assigned_commodity);
    }
    if (filters?.assigned_country) {
      params.append('assigned_country', filters.assigned_country);
    }

    const response = await fetch(`${API_BASE_URL}/forms/questions/export-json/?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Token ${token}` : '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return await response.blob();
  }

  async duplicateQuestion(id: string, targetProjectId?: string, orderIndex?: number) {
    return await this.post(`/forms/questions/${id}/duplicate/`, {
      target_project: targetProjectId,
      order_index: orderIndex,
    });
  }

  async getQuestionResponseCounts(projectId: string) {
    return await this.get(`/forms/questions/response-counts/?project_id=${projectId}`);
  }

  async getBundleCompletionStats(projectId: string) {
    return await this.get(`/forms/questions/bundle-completion-stats/?project_id=${projectId}`);
  }

  // Dynamic Question Generation endpoints
  async generateDynamicQuestions(data: {
    project: string;
    respondent_type: string;
    commodity?: string; // Single commodity or comma-separated list (e.g., "cocoa" or "cocoa,coffee")
    country?: string;
    categories?: string[];
    work_packages?: string[];
    use_project_bank_only?: boolean;
    replace_existing?: boolean;
    notes?: string;
  }) {
    return await this.post('/forms/questions/generate_dynamic_questions/', data);
  }

  // Get available options from QuestionBank for a project
  async getAvailableQuestionBankOptions(projectId: string) {
    return await this.get(`/forms/questions/get_available_options/?project_id=${projectId}`);
  }

  async previewDynamicQuestions(data: {
    respondent_type: string;
    commodity?: string;
    country?: string;
    categories?: string[];
    work_packages?: string[];
    data_sources?: string[];
    limit?: number;
    include_inactive?: boolean;
  }) {
    return await this.post('/forms/questions/preview_dynamic_questions/', data);
  }

  async getPartnerDistribution(projectId: string) {
    return await this.get(`/forms/questions/get_partner_distribution/?project_id=${projectId}`);
  }

  // QuestionBank endpoints - now project-specific
  async getQuestionBank(params?: {
    project_id?: string;
    respondent_type?: string;
    commodity?: string;
    category?: string;
    data_source?: string;
    is_active?: boolean;
    search?: string;
    ordering?: string;
    page_size?: number;
    page?: number;
  }) {
    // Build query string manually to ensure proper type conversion
    const queryParams: string[] = [];
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.push(`${key}=${encodeURIComponent(String(value))}`);
        }
      });
    }
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    return await this.get(`/forms/question-bank/${queryString}`);
  }

  async getQuestionBankItem(id: string) {
    return await this.get(`/forms/question-bank/${id}/`);
  }

  async createQuestionBankItem(data: {
    question_text: string;
    question_category: string;
    targeted_respondents: string[];
    targeted_commodities?: string[];
    targeted_countries?: string[];
    data_source?: string;
    research_partner_name?: string;
    research_partner_contact?: string;
    work_package?: string;
    project: string; // Required - question banks are now project-specific
    response_type: string;
    is_required?: boolean;
    allow_multiple?: boolean;
    options?: string[];
    validation_rules?: any;
    priority_score?: number;
    is_active?: boolean;
    tags?: string[];
    is_follow_up?: boolean;
    conditional_logic?: any;
    section_header?: string;
    section_preamble?: string;
  }) {
    return await this.post('/forms/question-bank/', data);
  }

  async updateQuestionBankItem(id: string, data: any) {
    return await this.patch(`/forms/question-bank/${id}/`, data);
  }

  async deleteQuestionBankItem(id: string) {
    return await this.delete(`/forms/question-bank/${id}/`);
  }

  async bulkDeleteQuestionBank(data: {
    question_bank_ids: string[];
    hard_delete?: boolean;
    delete_generated_questions?: boolean;
  }) {
    return await this.post('/forms/question-bank/bulk_delete/', data);
  }

  async deleteAllQuestionBankItems(
    projectId: string,
    hardDelete: boolean = false,
    deleteGenerated: boolean = false
  ) {
    // Get all question bank items for the project first, then bulk delete
    const response = await this.getQuestionBank({ project_id: projectId, page_size: 10000 });
    const questionBankIds = response.results?.map((item: any) => item.id) || [];
    if (questionBankIds.length === 0) {
      return { message: 'No question bank items to delete', deleted_count: 0 };
    }
    return await this.bulkDeleteQuestionBank({
      question_bank_ids: questionBankIds,
      hard_delete: hardDelete,
      delete_generated_questions: deleteGenerated,
    });
  }

  async searchQuestionBankForRespondent(data: {
    respondent_type: string;
    commodity?: string;
    country?: string;
    categories?: string[];
    work_packages?: string[];
    data_sources?: string[];
    limit?: number;
    include_inactive?: boolean;
  }) {
    return await this.post('/forms/question-bank/search_for_respondent/', data);
  }

  async getQuestionBankChoices() {
    return await this.get('/forms/question-bank/get_choices/');
  }

  async duplicateQuestionBankItem(id: string) {
    return await this.post(`/forms/question-bank/${id}/duplicate/`);
  }

  // Question Import/Export endpoints
  async downloadCSVTemplate() {
    const token = await secureStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/forms/question-bank/download_csv_template/`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Token ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download CSV template');
    }

    return response.blob();
  }

  async downloadExcelTemplate() {
    const token = await secureStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/forms/question-bank/download_excel_template/`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Token ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download Excel template');
    }

    return response.blob();
  }

  async importQuestions(file: File | any, projectId: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project_id', projectId);

    const token = await secureStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/forms/question-bank/import_questions/`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Token ${token}` : '',
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw data;
    }

    return data;
  }

  async exportQuestionBankCSV(projectId: string) {
    const token = await secureStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/forms/question-bank/export_csv/?project_id=${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Token ${token}` : '',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export Question Bank to CSV');
    }

    return response.blob();
  }

  async exportQuestionBankJSON(projectId: string) {
    const token = await secureStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/forms/question-bank/export_json/?project_id=${projectId}`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Token ${token}` : '',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to export Question Bank to JSON');
    }

    return response.blob();
  }

  // Dynamic Question Session endpoints
  async getQuestionSessions(projectId?: string) {
    const params = projectId ? `?project=${projectId}` : '';
    return await this.get(`/forms/question-sessions/${params}`);
  }

  async getQuestionSession(id: string) {
    return await this.get(`/forms/question-sessions/${id}/`);
  }

  async createQuestionSession(data: {
    project: string;
    respondent_type: string;
    commodity?: string;
    country?: string;
    categories?: string[];
    work_packages?: string[];
    notes?: string;
  }) {
    return await this.post('/forms/question-sessions/', data);
  }

  // Response endpoints
  async getResponses(projectId: string) {
    return await this.get(`/responses/responses/?project_id=${projectId}`);
  }

  async createResponse(data: any) {
    return await this.post('/responses/responses/', data);
  }

  async submitResponse(data: any) {
    return await this.post('/responses/responses/', data);
  }

  // Respondent endpoints
  async getRespondents(projectId: string) {
    return await this.get(`/responses/respondents/?project_id=${projectId}&page_size=1000`);
  }

  async createRespondent(data: any) {
    return await this.post('/responses/respondents/', data);
  }

  async getRespondentResponses(respondentId: string) {
    return await this.get(`/responses/respondents/${respondentId}/responses/`);
  }

  async saveDraftResponse(data: any) {
    return await this.post('/responses/respondents/save_draft/', data);
  }

  async getDraftResponses(projectId: string) {
    return await this.get(`/responses/respondents/get_drafts/?project_id=${projectId}`);
  }

  async updateRespondentStatus(respondentId: string, status: 'draft' | 'completed' | 'abandoned') {
    return await this.patch(`/responses/respondents/${respondentId}/`, {
      completion_status: status,
    });
  }

  async exportResponses(projectId: string, format: 'csv' | 'json' = 'csv') {
    if (format === 'csv') {
      const response = await this.axiosInstance.get(
        `/responses/respondents/export_csv/?project_id=${projectId}`,
        { responseType: 'text' }
      );
      return response.data;
    } else if (format === 'json') {
      const response = await this.axiosInstance.get(
        `/responses/respondents/export_json/?project_id=${projectId}`,
        { responseType: 'text' }
      );
      return response.data;
    }
    return await this.get(`/responses/responses/?project_id=${projectId}`);
  }

  // User search endpoints
  async searchUsers(query: string) {
    return await this.get(`/auth/users/search/?q=${encodeURIComponent(query)}`);
  }

  // Notification endpoints
  async getNotifications() {
    return await this.get('/auth/notifications/');
  }

  async markNotificationAsRead(notificationId: string) {
    return await this.post(`/auth/notifications/${notificationId}/read/`);
  }

  async markAllNotificationsAsRead() {
    return await this.post('/auth/notifications/mark-all-read/');
  }

  // Team invitation endpoints (for notifications)
  async acceptTeamInvitation(projectId: string, notificationId: string) {
    return await this.post(`/projects/projects/${projectId}/accept_invitation/`, {
      notification_id: notificationId
    });
  }

  async declineTeamInvitation(projectId: string, notificationId: string) {
    return await this.post(`/projects/projects/${projectId}/decline_invitation/`, {
      notification_id: notificationId
    });
  }

  // Sync endpoints
  async getSyncStatus(projectId: string) {
    return await this.get(`/sync/status/?project=${projectId}`);
  }

  async triggerSync(projectId: string, syncType: 'push' | 'pull' | 'full' = 'full') {
    return await this.post('/sync/trigger/', { project: projectId, sync_type: syncType });
  }

  // Generic methods
  async get<T = any>(url: string, config?: any) {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any) {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: any) {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: any) {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: any) {
    const response = await this.axiosInstance.patch<T>(url, data, config);
    return response.data;
  }

  // ============================================
  // RESPONSE LINKS
  // ============================================

  /**
   * Create a new shareable response link
   */
  async createResponseLink(data: any) {
    return await this.post('/v1/response-links/', data);
  }

  /**
   * Get all response links
   */
  async getResponseLinks() {
    return await this.get('/v1/response-links/');
  }

  /**
   * Get active response links
   */
  async getActiveResponseLinks() {
    return await this.get('/v1/response-links/active/');
  }

  /**
   * Get expired response links
   */
  async getExpiredResponseLinks() {
    return await this.get('/v1/response-links/expired/');
  }

  /**
   * Get single response link
   */
  async getResponseLink(linkId: string) {
    return await this.get(`/v1/response-links/${linkId}/`);
  }

  /**
   * Deactivate a response link
   */
  async deactivateResponseLink(linkId: string) {
    return await this.post(`/v1/response-links/${linkId}/deactivate/`, {});
  }

  /**
   * Extend response link expiration
   */
  async extendResponseLink(linkId: string, days: number) {
    return await this.post(`/v1/response-links/${linkId}/extend/`, { days });
  }

  /**
   * Get response link statistics
   */
  async getResponseLinkStatistics(linkId: string) {
    return await this.get(`/v1/response-links/${linkId}/statistics/`);
  }

  /**
   * Delete response link
   */
  async deleteResponseLink(linkId: string) {
    return await this.delete(`/v1/response-links/${linkId}/`);
  }

  /**
   * Cleanup expired response links
   */
  async cleanupExpiredResponseLinks(olderThanDays: number = 30) {
    return await this.post('/v1/response-links/cleanup_expired/', { older_than_days: olderThanDays });
  }

  // ============================================
  // PUBLIC RESPONSE LINKS (No Auth)
  // ============================================

  /**
   * Get public link info (no auth)
   */
  async getPublicLinkInfo(token: string) {
    return await this.get(`/v1/public/links/${token}/`);
  }

  /**
   * Get questions for public link (no auth)
   */
  async getPublicLinkQuestions(token: string) {
    return await this.get(`/v1/public/links/${token}/questions/`);
  }

  /**
   * Submit responses via public link (no auth)
   */
  async submitPublicLinkResponses(token: string, data: {
    consent_given: boolean;
    responses: Record<string, string>;
    respondent_metadata?: Record<string, any>;
  }) {
    return await this.post(`/v1/public/links/${token}/submit/`, data);
  }
}

export const apiService = new ApiService();
export default apiService;