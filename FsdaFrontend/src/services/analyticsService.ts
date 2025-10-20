import { API_BASE_URL } from '../config/env';
import { secureStorage } from '../utils/secureStorage';

interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

class AnalyticsService {
  private descriptiveBaseUrl: string;
  private inferentialBaseUrl: string;
  private qualitativeBaseUrl: string;

  constructor() {
    // FastAPI Analytics Backend runs on port 8001
    const apiHost = API_BASE_URL.replace(':8000', ':8001').replace('/api', '');
    this.descriptiveBaseUrl = `${apiHost}/api/v1/analytics/descriptive`;
    this.inferentialBaseUrl = `${apiHost}/api/v1/analytics/inferential`;
    this.qualitativeBaseUrl = `${apiHost}/api/v1/analytics/qualitative`;
  }

  private async getAuthHeaders() {
    const token = await secureStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    };
  }

  // ============================================
  // DESCRIPTIVE ANALYTICS
  // ============================================

  async getDataSummary(projectId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/data-summary`,
        { method: 'GET', headers }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching data summary:', error);
      throw error;
    }
  }

  async getBasicStatistics(projectId: string, variables?: string[]): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/analyze/basic-statistics`,
        {
          method: 'POST',
          headers,
          body: variables ? JSON.stringify({ variables }) : undefined,
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching basic statistics:', error);
      throw error;
    }
  }

  async getDistributions(projectId: string, variables?: string[]): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/analyze/distributions`,
        {
          method: 'POST',
          headers,
          body: variables ? JSON.stringify({ variables }) : undefined,
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching distributions:', error);
      throw error;
    }
  }

  async getCategoricalAnalysis(projectId: string, variables?: string[]): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/analyze/categorical`,
        {
          method: 'POST',
          headers,
          body: variables ? JSON.stringify({ variables }) : undefined,
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching categorical analysis:', error);
      throw error;
    }
  }

  async getOutliers(projectId: string, variables?: string[], methods?: string[]): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/analyze/outliers`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ variables, methods }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching outliers:', error);
      throw error;
    }
  }

  async getMissingData(projectId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/analyze/missing-data`,
        { method: 'POST', headers }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching missing data analysis:', error);
      throw error;
    }
  }

  async getDataQuality(projectId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/analyze/data-quality`,
        { method: 'POST', headers }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching data quality:', error);
      throw error;
    }
  }

  async generateReport(projectId: string, includePlots: boolean = false): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/generate-report`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ include_plots: includePlots }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  // ============================================
  // INFERENTIAL ANALYTICS
  // ============================================

  async runCorrelationAnalysis(
    projectId: string,
    variables?: string[],
    correlationMethod: string = 'pearson',
    significanceLevel: number = 0.05
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.inferentialBaseUrl}/project/${projectId}/analyze/correlation`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            variables,
            correlation_method: correlationMethod,
            significance_level: significanceLevel,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running correlation analysis:', error);
      throw error;
    }
  }

  async runTTest(
    projectId: string,
    dependentVariable: string,
    independentVariable?: string,
    testType: string = 'two_sample',
    alternative: string = 'two_sided',
    confidenceLevel: number = 0.95
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.inferentialBaseUrl}/project/${projectId}/analyze/t-test`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            dependent_variable: dependentVariable,
            independent_variable: independentVariable,
            test_type: testType,
            alternative,
            confidence_level: confidenceLevel,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running t-test:', error);
      throw error;
    }
  }

  async runANOVA(
    projectId: string,
    dependentVariable: string,
    independentVariables: string[],
    anovaType: string = 'one_way',
    postHoc: boolean = true,
    postHocMethod: string = 'tukey'
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.inferentialBaseUrl}/project/${projectId}/analyze/anova`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            dependent_variable: dependentVariable,
            independent_variables: independentVariables,
            anova_type: anovaType,
            post_hoc: postHoc,
            post_hoc_method: postHocMethod,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running ANOVA:', error);
      throw error;
    }
  }

  async runRegression(
    projectId: string,
    dependentVariable: string,
    independentVariables: string[],
    regressionType: string = 'linear',
    includeDiagnostics: boolean = true,
    confidenceLevel: number = 0.95
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.inferentialBaseUrl}/project/${projectId}/analyze/regression`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            dependent_variable: dependentVariable,
            independent_variables: independentVariables,
            regression_type: regressionType,
            include_diagnostics: includeDiagnostics,
            confidence_level: confidenceLevel,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running regression:', error);
      throw error;
    }
  }

  async runChiSquare(
    projectId: string,
    variable1: string,
    variable2?: string,
    testType: string = 'independence',
    expectedFrequencies?: number[]
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.inferentialBaseUrl}/project/${projectId}/analyze/chi-square`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            variable1,
            variable2,
            test_type: testType,
            expected_frequencies: expectedFrequencies,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running chi-square test:', error);
      throw error;
    }
  }

  async runNonParametricTest(
    projectId: string,
    testType: string,
    variables: string[],
    groups?: string,
    alternative: string = 'two_sided'
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.inferentialBaseUrl}/project/${projectId}/analyze/nonparametric`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            test_type: testType,
            variables,
            groups,
            alternative,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running non-parametric test:', error);
      throw error;
    }
  }

  // ============================================
  // QUALITATIVE ANALYTICS
  // ============================================

  async runTextAnalysis(
    projectId: string,
    textFields?: string[],
    analysisType: string = 'comprehensive'
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.qualitativeBaseUrl}/project/${projectId}/analyze/text`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text_fields: textFields,
            analysis_type: analysisType,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running text analysis:', error);
      throw error;
    }
  }

  async runSentimentAnalysis(
    projectId: string,
    textFields?: string[],
    sentimentMethod: string = 'vader'
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.qualitativeBaseUrl}/project/${projectId}/analyze/sentiment`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text_fields: textFields,
            sentiment_method: sentimentMethod,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running sentiment analysis:', error);
      throw error;
    }
  }

  async runThemeAnalysis(
    projectId: string,
    textFields?: string[],
    numThemes: number = 5,
    themeMethod: string = 'lda'
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.qualitativeBaseUrl}/project/${projectId}/analyze/themes`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text_fields: textFields,
            num_themes: numThemes,
            theme_method: themeMethod,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running theme analysis:', error);
      throw error;
    }
  }

  async runWordFrequencyAnalysis(
    projectId: string,
    textFields?: string[],
    topN: number = 50,
    minWordLength: number = 3,
    removeStopwords: boolean = true
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.qualitativeBaseUrl}/project/${projectId}/analyze/word-frequency`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text_fields: textFields,
            top_n: topN,
            min_word_length: minWordLength,
            remove_stopwords: removeStopwords,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running word frequency analysis:', error);
      throw error;
    }
  }

  async runContentAnalysis(
    projectId: string,
    textFields?: string[],
    analysisFramework: string = 'inductive',
    codingScheme?: { [key: string]: string[] }
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.qualitativeBaseUrl}/project/${projectId}/analyze/content-analysis`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text_fields: textFields,
            analysis_framework: analysisFramework,
            coding_scheme: codingScheme,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running content analysis:', error);
      throw error;
    }
  }

  async runQualitativeCoding(
    projectId: string,
    textFields?: string[],
    codingMethod: string = 'open',
    autoCode: boolean = true
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${this.qualitativeBaseUrl}/project/${projectId}/analyze/qualitative-coding`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text_fields: textFields,
            coding_method: codingMethod,
            auto_code: autoCode,
          }),
        }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error running qualitative coding:', error);
      throw error;
    }
  }

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
      if (options.pageSize) queryParams.append('page_size', options.pageSize.toString());
      if (options.search) queryParams.append('search', options.search);
      if (options.questionFilter) queryParams.append('question_filter', options.questionFilter);
      if (options.respondentFilter) queryParams.append('respondent_filter', options.respondentFilter);
      if (options.dateFrom) queryParams.append('date_from', options.dateFrom);
      if (options.dateTo) queryParams.append('date_to', options.dateTo);

      const response = await fetch(
        `${this.descriptiveBaseUrl}/project/${projectId}/explore-data?${queryParams.toString()}`,
        { method: 'GET', headers }
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error: any) {
      console.error('Error exploring data:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
