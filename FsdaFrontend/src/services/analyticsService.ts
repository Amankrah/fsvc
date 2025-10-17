import { API_BASE_URL } from '../config/env';
import { secureStorage } from '../utils/secureStorage';

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

class AnalyticsService {
  private baseUrl: string;

  constructor() {
    // FastAPI Analytics Backend runs on port 8001
    // Extract the host from API_BASE_URL and use port 8001
    const apiHost = API_BASE_URL.replace(':8000', ':8001').replace('/api', '');
    this.baseUrl = `${apiHost}/api/v1/analytics/descriptive`;
  }

  private async getAuthHeaders() {
    const token = await secureStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    };
  }

  /**
   * Get data summary for a project
   */
  async getDataSummary(projectId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/data-summary`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching data summary:', error);
      throw new Error(error.message || 'Failed to fetch data summary');
    }
  }

  /**
   * Get basic statistics for a project
   */
  async getBasicStatistics(
    projectId: string,
    variables?: string[]
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const body = variables ? JSON.stringify({ variables }) : undefined;

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/basic-statistics`,
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching basic statistics:', error);
      throw new Error(error.message || 'Failed to fetch basic statistics');
    }
  }

  /**
   * Get distribution analysis
   */
  async getDistributions(
    projectId: string,
    variables?: string[]
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const body = variables ? JSON.stringify({ variables }) : undefined;

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/distributions`,
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching distributions:', error);
      throw new Error(error.message || 'Failed to fetch distributions');
    }
  }

  /**
   * Get categorical analysis
   */
  async getCategoricalAnalysis(
    projectId: string,
    variables?: string[]
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const body = variables ? JSON.stringify({ variables }) : undefined;

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/categorical`,
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching categorical analysis:', error);
      throw new Error(error.message || 'Failed to fetch categorical analysis');
    }
  }

  /**
   * Get outlier detection results
   */
  async getOutliers(
    projectId: string,
    variables?: string[],
    methods?: string[]
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const body = JSON.stringify({ variables, methods });

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/outliers`,
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching outliers:', error);
      throw new Error(error.message || 'Failed to fetch outliers');
    }
  }

  /**
   * Get missing data analysis
   */
  async getMissingData(projectId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/missing-data`,
        {
          method: 'POST',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching missing data analysis:', error);
      throw new Error(error.message || 'Failed to fetch missing data analysis');
    }
  }

  /**
   * Get data quality analysis
   */
  async getDataQuality(projectId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/data-quality`,
        {
          method: 'POST',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching data quality:', error);
      throw new Error(error.message || 'Failed to fetch data quality analysis');
    }
  }

  /**
   * Get comprehensive descriptive analysis
   */
  async getDescriptiveAnalysis(
    projectId: string,
    analysisType: string = 'comprehensive',
    targetVariables?: string[]
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const body = JSON.stringify({
        analysis_type: analysisType,
        target_variables: targetVariables,
      });

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/analyze/descriptive`,
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching descriptive analysis:', error);
      throw new Error(error.message || 'Failed to fetch descriptive analysis');
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(
    projectId: string,
    includePlots: boolean = false
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const body = JSON.stringify({ include_plots: includePlots });

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/generate-report`,
        {
          method: 'POST',
          headers,
          body,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error generating report:', error);
      throw new Error(error.message || 'Failed to generate report');
    }
  }

  /**
   * Get analysis types
   */
  async getAnalysisTypes(): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/analysis-types`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching analysis types:', error);
      throw new Error(error.message || 'Failed to fetch analysis types');
    }
  }

  /**
   * Explore project data with filters
   */
  async exploreData(
    projectId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
      questionFilter?: string;
      respondentFilter?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const queryParams = new URLSearchParams();

      if (options.page) queryParams.append('page', options.page.toString());
      if (options.pageSize)
        queryParams.append('page_size', options.pageSize.toString());
      if (options.search) queryParams.append('search', options.search);
      if (options.questionFilter)
        queryParams.append('question_filter', options.questionFilter);
      if (options.respondentFilter)
        queryParams.append('respondent_filter', options.respondentFilter);
      if (options.dateFrom) queryParams.append('date_from', options.dateFrom);
      if (options.dateTo) queryParams.append('date_to', options.dateTo);

      const response = await fetch(
        `${this.baseUrl}/project/${projectId}/explore-data?${queryParams.toString()}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error exploring data:', error);
      throw new Error(error.message || 'Failed to explore data');
    }
  }
}

export const analyticsService = new AnalyticsService();
