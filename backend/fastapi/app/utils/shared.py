"""
Shared utilities for analytics operations.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime
import json
import logging
import uuid
from core.database import get_project_data, get_project_stats

# Inferential analytics imports
from app.analytics.inferential.hypothesis_testing import (
    perform_t_test, perform_paired_t_test, perform_welch_t_test, perform_anova,
    perform_two_way_anova, perform_repeated_measures_anova, perform_chi_square_test,
    perform_fisher_exact_test, perform_mcnemar_test, perform_correlation_test,
    perform_partial_correlation
)
from app.analytics.inferential.bayesian_inference import (
    bayesian_t_test, bayesian_proportion_test, calculate_bayes_factor,
    calculate_posterior_distribution, calculate_credible_interval, bayesian_ab_test
)
from app.analytics.inferential.confidence_intervals import (
    calculate_mean_ci, calculate_proportion_ci, calculate_difference_ci,
    calculate_correlation_ci, calculate_median_ci, calculate_bootstrap_ci,
    calculate_prediction_interval, calculate_odds_ratio_ci
)
from app.analytics.inferential.effect_sizes import (
    calculate_cohens_d, calculate_hedges_g, calculate_glass_delta, calculate_eta_squared,
    calculate_omega_squared, calculate_cohens_f, calculate_cramers_v, calculate_odds_ratio,
    calculate_risk_ratio, calculate_nnt
)
from app.analytics.inferential.power_analysis import (
    calculate_sample_size_t_test, calculate_sample_size_anova, calculate_sample_size_proportion,
    calculate_sample_size_correlation, calculate_power_t_test, calculate_power_anova,
    calculate_effect_size_needed, post_hoc_power_analysis
)
from app.analytics.inferential.nonparametric_tests import (
    mann_whitney_u_test, wilcoxon_signed_rank_test, kruskal_wallis_test, friedman_test,
    runs_test, kolmogorov_smirnov_test, anderson_darling_test, shapiro_wilk_test,
    mood_median_test
)
from app.analytics.inferential.multiple_comparisons import (
    bonferroni_correction, holm_bonferroni_correction, benjamini_hochberg_correction,
    benjamini_yekutieli_correction, tukey_hsd_test, dunnett_test, games_howell_test,
    apply_multiple_corrections
)
from app.analytics.inferential.regression_analysis import (
    perform_linear_regression, perform_multiple_regression, perform_logistic_regression,
    perform_poisson_regression, calculate_regression_diagnostics, calculate_vif,
    perform_ridge_regression, perform_lasso_regression, perform_robust_regression
)
from app.analytics.inferential.time_series_inference import (
    test_stationarity, test_autocorrelation, test_seasonality, granger_causality_test,
    cointegration_test, change_point_detection, forecast_accuracy_tests
)
from app.analytics.inferential.inference_utils import (
    validate_series_data, validate_two_samples, validate_dataframe_columns,
    test_normality, test_equal_variances, test_independence, format_p_value,
    format_confidence_interval, check_test_assumptions
)

logger = logging.getLogger(__name__)

def normalize_uuid(uuid_str: str) -> str:
    """
    Normalize UUID string format to handle both with and without hyphens.
    
    Args:
        uuid_str: UUID string in any format
        
    Returns:
        UUID string without hyphens (as stored in database)
    """
    if not uuid_str:
        return uuid_str
    
    try:
        # Remove any hyphens and convert to lowercase
        cleaned = str(uuid_str).replace('-', '').lower()
        
        # Validate it's a proper UUID length (32 hex characters)
        if len(cleaned) == 32 and all(c in '0123456789abcdef' for c in cleaned):
            return cleaned
        
        # Try to parse as standard UUID and extract hex
        uuid_obj = uuid.UUID(uuid_str)
        return uuid_obj.hex
        
    except (ValueError, AttributeError):
        # If all else fails, return the original string
        logger.warning(f"Could not normalize UUID: {uuid_str}")
        return str(uuid_str)

# Import analytics modules
from app.analytics.auto_detect.survey_detector import SurveyDetector
from app.analytics.auto_detect.base_detector import StandardizedDataProfiler, DataCharacteristics

# Try to import the unified auto-detector
try:
    from app.analytics.auto_detect import UnifiedAutoDetector, create_auto_detector
    UNIFIED_AUTO_DETECTOR_AVAILABLE = True
except ImportError:
    UNIFIED_AUTO_DETECTOR_AVAILABLE = False
    logger.warning("UnifiedAutoDetector not available, using basic auto-detection")
from app.analytics.descriptive import (
    # Main analysis functions
    analyze_descriptive_data,
    quick_data_overview,
    auto_detect_analysis_needs,
    get_data_characteristics as get_descriptive_characteristics,
    generate_analysis_workflow,
    
    # Basic Statistics
    calculate_basic_stats,
    calculate_percentiles,
    calculate_grouped_stats,
    calculate_weighted_stats,
    calculate_correlation_matrix,
    calculate_covariance_matrix,
    
    # Distributions
    analyze_distribution,
    test_normality,
    calculate_skewness_kurtosis,
    fit_distribution,
    
    # Categorical Analysis
    analyze_categorical,
    calculate_chi_square,
    calculate_cramers_v,
    analyze_cross_tabulation,
    
    # Outlier Detection
    detect_outliers_iqr,
    detect_outliers_zscore,
    detect_outliers_isolation_forest,
    detect_outliers_mad,
    get_outlier_summary,
    
    # Missing Data
    analyze_missing_data,
    get_missing_patterns,
    calculate_missing_correlations,
    
    # Temporal Analysis
    analyze_temporal_patterns,
    calculate_time_series_stats,
    detect_seasonality,
    
    # Geospatial Analysis
    analyze_spatial_distribution,
    calculate_spatial_autocorrelation,
    create_location_clusters,
    
    # Summary Generation
    generate_full_report,
    generate_executive_summary,
    export_statistics
)
from app.analytics.qualitative import (
    analyze_sentiment,
    analyze_sentiment_batch
)

# Import text analysis functions
try:
    from app.analytics.qualitative.text_analysis import analyze_text_frequency, preprocess_text
except ImportError:
    # Fallback implementations
    def analyze_text_frequency(text: str):
        """Fallback text frequency analysis"""
        words = text.lower().split()
        from collections import Counter
        return dict(Counter(words))
    
    def preprocess_text(text: str):
        """Fallback text preprocessing"""
        return text.lower().split()

logger = logging.getLogger(__name__)

class AnalyticsUtils:
    """Comprehensive analytics utilities for the FastAPI endpoints."""
    
    @staticmethod
    def normalize_uuid(uuid_str: str) -> str:
        """
        Normalize UUID string format to handle both with and without hyphens.
        Wrapper around global normalize_uuid function for convenience.
        """
        return normalize_uuid(uuid_str)
    
    @staticmethod
    async def get_project_data(project_id: str) -> pd.DataFrame:
        """Get project data as pandas DataFrame."""
        try:
            # Normalize UUID format to match database storage
            normalized_project_id = normalize_uuid(project_id)
            logger.info(f"Getting project data for {project_id} -> normalized: {normalized_project_id}")
            
            data = await get_project_data(normalized_project_id)
            if not data:
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            return AnalyticsUtils._prepare_dataframe(df)
        except Exception as e:
            logger.error(f"Error getting project data: {e}")
            return pd.DataFrame()
    
    @staticmethod
    async def get_project_stats(project_id: str) -> Dict[str, Any]:
        """Get basic project statistics."""
        try:
            # Normalize UUID format to match database storage
            normalized_project_id = normalize_uuid(project_id)
            logger.info(f"Getting project stats for {project_id} -> normalized: {normalized_project_id}")
            
            stats = await get_project_stats(normalized_project_id)
            if stats is None:
                raise ValueError(f"Project {project_id} not found")
            return stats
        except Exception as e:
            logger.error(f"Error getting project stats: {e}")
            raise e  # Re-raise the exception so the endpoint can handle it
    
    @staticmethod
    def _prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """Prepare DataFrame for analysis."""
        if df.empty:
            return df
        
        try:
            # Handle complex data types that cause issues with analytics
            for col in df.columns:
                if col in ['choice_selections', 'location_data', 'device_info', 'response_metadata']:
                    # Convert complex data to strings for analysis
                    df[col] = df[col].astype(str)
                
                # Check for other complex data types that might cause boolean evaluation issues
                col_dtype = str(df[col].dtype)
                if col_dtype == 'object':
                    # Check if column contains complex objects
                    sample_values = df[col].dropna().head(3)
                    if not sample_values.empty:
                        sample_val = sample_values.iloc[0]
                        if not isinstance(sample_val, (str, int, float, bool, type(None))):
                            logger.debug(f"Converting complex object column {col} to string")
                            df[col] = df[col].astype(str)
            
            # Convert datetime columns
            if 'collected_at' in df.columns:
                df['collected_at'] = pd.to_datetime(df['collected_at'], errors='coerce')
            if 'datetime_value' in df.columns:
                df['datetime_value'] = pd.to_datetime(df['datetime_value'], errors='coerce')
            
            # Convert numeric columns
            if 'numeric_value' in df.columns:
                df['numeric_value'] = pd.to_numeric(df['numeric_value'], errors='coerce')
            
            # Convert data quality score
            if 'data_quality_score' in df.columns:
                df['data_quality_score'] = pd.to_numeric(df['data_quality_score'], errors='coerce')
            
            # Drop columns that are not useful for analysis
            columns_to_drop = ['response_id', 'device_info', 'location_data']
            df = df.drop(columns=[col for col in columns_to_drop if col in df.columns])
            
            return df
            
        except Exception as e:
            logger.error(f"Error preparing DataFrame: {e}")
            # Return original DataFrame if preparation fails
            return df
    
    @staticmethod
    def convert_numpy_types(obj):
        """Convert numpy types to native Python types for JSON serialization"""
        if isinstance(obj, dict):
            return {key: AnalyticsUtils.convert_numpy_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [AnalyticsUtils.convert_numpy_types(item) for item in obj]
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, pd.DataFrame):
            # Handle DataFrames by converting to dict
            return obj.to_dict()
        elif isinstance(obj, pd.Series):
            # Handle Series by converting to dict or list
            return obj.to_dict()
        elif obj is None:
            return None
        elif isinstance(obj, (str, int, float, bool)):
            return obj
        else:
            # Check for pandas NA values using scalar check
            try:
                if pd.isna(obj) and not isinstance(obj, (pd.DataFrame, pd.Series)):
                    return None
            except (ValueError, TypeError):
                # If pd.isna() fails (e.g., on complex objects), continue
                pass
            return obj
    
    @staticmethod
    def analyze_data_characteristics(df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data characteristics for recommendations."""
        if df.empty:
            return {
                'sample_size': 0,
                'variable_count': 0,
                'numeric_variables': [],
                'categorical_variables': [],
                'text_variables': [],
                'datetime_variables': [],
                'completeness_score': 0,
                'sample_size_analysis': {
                    'current_size': 0,
                    'adequacy_status': 'insufficient',
                    'recommendations': {}
                }
            }

        try:
            # Use the standardized data profiler
            profiler = StandardizedDataProfiler()
            characteristics = profiler.profile_data(df)
            
            # Get current sample size
            current_sample_size = int(characteristics.n_observations)
            
            # Convert to the expected format and ensure all numpy types are converted
            result = {
                'sample_size': current_sample_size,
                'variable_count': int(characteristics.n_variables),
                'numeric_variables': [col for col, dtype in characteristics.variable_types.items() 
                                    if dtype.value in ['numeric_continuous', 'numeric_discrete']],
                'categorical_variables': [col for col, dtype in characteristics.variable_types.items() 
                                        if dtype.value in ['categorical', 'ordinal', 'binary']],
                'text_variables': [col for col, dtype in characteristics.variable_types.items() 
                                 if dtype.value == 'text'],
                'datetime_variables': [col for col, dtype in characteristics.variable_types.items() 
                                     if dtype.value == 'datetime'],
                'completeness_score': float(characteristics.completeness_score),
                'missing_data_summary': characteristics.missing_patterns.get('variables_with_missing', {}),
                'data_quality': {
                    'duplicate_rows': int(characteristics.duplicate_rows),
                    'constant_columns': characteristics.constant_columns,
                    'missing_percentage': float(characteristics.missing_percentage)
                }
            }
            
            # Add sample size adequacy analysis
            result['sample_size_analysis'] = AnalyticsUtils._analyze_sample_size_adequacy(
                current_sample_size, result
            )
            
            # Apply numpy type conversion to the entire result
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in analyze_data_characteristics: {e}")
            # Fallback to simple analysis
            current_sample_size = len(df)
            result = {
                'sample_size': current_sample_size,
                'variable_count': len(df.columns),
                'numeric_variables': list(df.select_dtypes(include=[np.number]).columns),
                'categorical_variables': list(df.select_dtypes(include=['object', 'category']).columns),
                'text_variables': [],
                'datetime_variables': list(df.select_dtypes(include=['datetime64']).columns),
                'completeness_score': 100 - (df.isna().sum().sum() / df.size * 100),
                'missing_data_summary': {},
                'data_quality': {
                    'duplicate_rows': df.duplicated().sum(),
                    'constant_columns': [],
                    'missing_percentage': df.isna().sum().sum() / df.size * 100
                }
            }
            
            # Add sample size adequacy analysis for fallback too
            result['sample_size_analysis'] = AnalyticsUtils._analyze_sample_size_adequacy(
                current_sample_size, result
            )
            
            # Apply numpy type conversion to the fallback result
            return AnalyticsUtils.convert_numpy_types(result)
    
    @staticmethod
    def _analyze_sample_size_adequacy(current_size: int, characteristics: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze whether current sample size is adequate for common statistical tests."""
        try:
            
            numeric_vars = len(characteristics.get('numeric_variables', []))
            categorical_vars = len(characteristics.get('categorical_variables', []))
            
            recommendations = {}
            adequacy_scores = []
            
            # Common effect sizes for recommendations
            small_effect = 0.2
            medium_effect = 0.5
            large_effect = 0.8
            
            # T-test recommendations (if we have numeric variables)
            if numeric_vars >= 2:
                t_test_small = calculate_sample_size_t_test(
                    effect_size=small_effect,
                    power=0.80,
                    test_type='two-sample'
                )
                t_test_medium = calculate_sample_size_t_test(
                    effect_size=medium_effect,
                    power=0.80,
                    test_type='two-sample'
                )
                
                recommendations['t_test'] = {
                    'test_type': 'Independent t-test',
                    'current_size': current_size,
                    'needed_for_small_effect': t_test_small.get('total_sample_size', 0),
                    'needed_for_medium_effect': t_test_medium.get('total_sample_size', 0),
                    'adequacy': 'adequate' if current_size >= t_test_medium.get('total_sample_size', 0) else 'insufficient',
                    'recommendation': f"For medium effect size (Cohen's d=0.5), need {t_test_medium.get('total_sample_size', 0)} total participants"
                }
                
                # Calculate adequacy score for t-test
                if current_size >= t_test_small.get('total_sample_size', 0):
                    adequacy_scores.append(1.0)
                elif current_size >= t_test_medium.get('total_sample_size', 0):
                    adequacy_scores.append(0.8)
                else:
                    adequacy_scores.append(0.3)
            
            # ANOVA recommendations (if we have numeric + categorical variables)
            if numeric_vars >= 1 and categorical_vars >= 1:
                # Assume 3 groups for ANOVA calculation
                anova_medium = calculate_sample_size_anova(
                    effect_size=0.25,  # Cohen's f for medium effect
                    n_groups=3,
                    power=0.80
                )
                
                recommendations['anova'] = {
                    'test_type': 'One-way ANOVA',
                    'current_size': current_size,
                    'needed_for_medium_effect': anova_medium.get('total_sample_size', 0),
                    'per_group_needed': anova_medium.get('n_per_group', 0),
                    'adequacy': 'adequate' if current_size >= anova_medium.get('total_sample_size', 0) else 'insufficient',
                    'recommendation': f"For 3-group ANOVA with medium effect, need {anova_medium.get('total_sample_size', 0)} total participants ({anova_medium.get('n_per_group', 0)} per group)"
                }
                
                # Calculate adequacy score for ANOVA
                if current_size >= anova_medium.get('total_sample_size', 0):
                    adequacy_scores.append(0.9)
                else:
                    adequacy_scores.append(0.4)
            
            # Correlation recommendations (if we have multiple numeric variables)
            if numeric_vars >= 2:
                corr_medium = calculate_sample_size_correlation(
                    r=0.3,  # Medium correlation
                    power=0.80
                )
                
                recommendations['correlation'] = {
                    'test_type': 'Correlation analysis',
                    'current_size': current_size,
                    'needed_for_medium_effect': corr_medium.get('sample_size', 0),
                    'adequacy': 'adequate' if current_size >= corr_medium.get('sample_size', 0) else 'insufficient',
                    'recommendation': f"For detecting r=0.3 correlation, need {corr_medium.get('sample_size', 0)} participants"
                }
                
                # Calculate adequacy score for correlation
                if current_size >= corr_medium.get('sample_size', 0):
                    adequacy_scores.append(0.8)
                else:
                    adequacy_scores.append(0.5)
            
            # Basic descriptive statistics adequacy (general rule of thumb)
            descriptive_adequate = current_size >= 30
            recommendations['descriptive'] = {
                'test_type': 'Descriptive statistics',
                'current_size': current_size,
                'minimum_needed': 30,
                'adequacy': 'adequate' if descriptive_adequate else 'insufficient',
                'recommendation': "For reliable descriptive statistics, minimum 30 participants recommended"
            }
            
            if descriptive_adequate:
                adequacy_scores.append(0.7)
            else:
                adequacy_scores.append(0.2)
            
            # Overall adequacy assessment
            if not adequacy_scores:
                overall_adequacy = 'unknown'
                overall_score = 0.0
            else:
                overall_score = sum(adequacy_scores) / len(adequacy_scores)
                if overall_score >= 0.8:
                    overall_adequacy = 'excellent'
                elif overall_score >= 0.6:
                    overall_adequacy = 'adequate'
                elif overall_score >= 0.4:
                    overall_adequacy = 'marginal'
                else:
                    overall_adequacy = 'insufficient'
            
            return {
                'current_size': current_size,
                'adequacy_status': overall_adequacy,
                'adequacy_score': round(overall_score, 2),
                'recommendations': recommendations,
                'summary': {
                    'tests_assessed': len(recommendations),
                    'adequate_for': len([r for r in recommendations.values() if r.get('adequacy') == 'adequate']),
                    'general_guidance': AnalyticsUtils._get_sample_size_guidance(current_size, overall_adequacy)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in sample size adequacy analysis: {e}")
            return {
                'current_size': current_size,
                'adequacy_status': 'unknown',
                'adequacy_score': 0.0,
                'recommendations': {},
                'summary': {
                    'tests_assessed': 0,
                    'adequate_for': 0,
                    'general_guidance': f"Unable to assess sample size adequacy: {str(e)}"
                }
            }
    
    @staticmethod
    def _get_sample_size_guidance(current_size: int, adequacy: str) -> str:
        """Get general guidance based on current sample size and adequacy."""
        if adequacy == 'excellent':
            return f"Your sample size of {current_size:,} is excellent for most statistical analyses."
        elif adequacy == 'adequate':
            return f"Your sample size of {current_size:,} is adequate for most common statistical tests."
        elif adequacy == 'marginal':
            return f"Your sample size of {current_size:,} is marginal. Consider collecting more data for robust analysis."
        elif adequacy == 'insufficient':
            if current_size < 30:
                return f"Your sample size of {current_size:,} is too small for most statistical tests. Aim for at least 30-50 participants."
            else:
                return f"Your sample size of {current_size:,} may be insufficient for detecting smaller effect sizes. Consider increasing sample size."
        else:
            return f"Unable to assess adequacy of sample size {current_size:,}."
    
    @staticmethod
    def generate_analysis_recommendations(characteristics: Dict[str, Any]) -> Dict[str, Any]:
        """Generate smart analysis recommendations using auto-detection modules."""
        try:
            # Use the sophisticated auto-detection modules
            from app.analytics.descriptive.auto_detection import DescriptiveAutoDetector
            from app.analytics.qualitative.auto_detection import QualitativeAutoDetector
            
            # Create a simple DataFrame for the auto-detection modules
            import pandas as pd
            
            # Create a dummy DataFrame based on characteristics for auto-detection
            sample_size = characteristics.get('sample_size', 100)
            variable_count = characteristics.get('variable_count', 10)
            
            # Create synthetic data structure for auto-detection
            data_dict = {}
            
            # Add numeric variables
            numeric_vars = characteristics.get('numeric_variables', [])
            for var in numeric_vars[:5]:  # Limit to prevent too much processing
                data_dict[var] = [1.0] * min(sample_size, 100)
            
            # Add categorical variables  
            categorical_vars = characteristics.get('categorical_variables', [])
            for var in categorical_vars[:5]:
                data_dict[var] = ['category_1'] * min(sample_size, 100)
            
            # Add text variables
            text_vars = characteristics.get('text_variables', [])
            for var in text_vars[:3]:
                data_dict[var] = ['sample text response'] * min(sample_size, 100)
            
            # Ensure we have at least some data
            if not data_dict:
                data_dict = {'sample_var': [1] * min(sample_size, 100)}
            
            df = pd.DataFrame(data_dict)
            
            # Use descriptive auto-detector
            descriptive_detector = DescriptiveAutoDetector()
            descriptive_suggestions = descriptive_detector.suggest_analyses(df)
            
            # Use qualitative auto-detector for text data
            qualitative_suggestions = None
            if text_vars:
                qualitative_detector = QualitativeAutoDetector()
                sample_texts = ['sample survey response text'] * min(len(text_vars) * 10, 50)
                qualitative_suggestions = qualitative_detector.suggest_analyses(df, texts=sample_texts)
            
            # Combine suggestions
            recommendations = {
                'primary_recommendations': [],
                'secondary_recommendations': [],
                'data_quality_warnings': []
            }
            
            # Convert from standardized format to legacy format
            if descriptive_suggestions:
                for rec in descriptive_suggestions.primary_recommendations:
                    recommendations['primary_recommendations'].append({
                        'method': rec.method,
                        'score': rec.score,
                        'rationale': rec.rationale,
                        'function_call': rec.function_call or 'run_descriptive_analysis()',
                        'category': 'descriptive'
                    })
                
                for rec in descriptive_suggestions.secondary_recommendations:
                    recommendations['secondary_recommendations'].append({
                        'method': rec.method,
                        'score': rec.score,
                        'rationale': rec.rationale,
                        'function_call': rec.function_call or 'run_descriptive_analysis()',
                        'category': 'descriptive'
                    })
                
                recommendations['data_quality_warnings'].extend(descriptive_suggestions.data_quality_warnings)
            
            # Add qualitative recommendations
            if qualitative_suggestions:
                for rec in qualitative_suggestions.primary_recommendations:
                    recommendations['secondary_recommendations'].append({
                        'method': rec.method,
                        'score': rec.score,
                        'rationale': rec.rationale,
                        'function_call': rec.function_call or 'run_text_analysis()',
                        'category': 'qualitative'
                    })
            
            # Add data quality warnings based on characteristics
            completeness_score = characteristics.get('completeness_score', 100)
            if completeness_score < 80:
                recommendations['data_quality_warnings'].append(
                    f'Data completeness is {completeness_score:.1f}% - consider missing data analysis'
                )
            
            # If no sophisticated recommendations, fall back to basic ones
            if not recommendations['primary_recommendations']:
                sample_size = characteristics.get('sample_size', 0)
                numeric_vars = len(characteristics.get('numeric_variables', []))
                categorical_vars = len(characteristics.get('categorical_variables', []))
                text_vars = len(characteristics.get('text_variables', []))
                
                recommendations['primary_recommendations'].append({
                    'method': 'basic_statistics',
                    'score': 0.9,
                    'rationale': f'Basic statistics suitable for {sample_size} responses',
                    'function_call': 'run_descriptive_analysis()',
                    'category': 'descriptive'
                })
                
                if categorical_vars >= 1:
                    recommendations['secondary_recommendations'].append({
                        'method': 'categorical_analysis',
                        'score': 0.75,
                        'rationale': f'Categorical analysis for {categorical_vars} categorical variables',
                        'function_call': 'run_categorical_analysis()',
                        'category': 'descriptive'
                    })
                
                if text_vars >= 1:
                    recommendations['secondary_recommendations'].append({
                        'method': 'text_analysis',
                        'score': 0.8,
                        'rationale': f'Text analysis for {text_vars} text fields',
                        'function_call': 'run_text_analysis()',
                        'category': 'qualitative'
                    })
            
            # Apply numpy type conversion to ensure serialization
            return AnalyticsUtils.convert_numpy_types(recommendations)
            
        except Exception as e:
            logger.error(f"Error generating sophisticated recommendations: {e}")
            # Fallback to basic recommendations
            return AnalyticsUtils._generate_basic_recommendations(characteristics)
    
    @staticmethod
    def _generate_basic_recommendations(characteristics: Dict[str, Any]) -> Dict[str, Any]:
        """Generate basic fallback recommendations when sophisticated auto-detection fails."""
        recommendations = {
            'primary_recommendations': [],
            'secondary_recommendations': [],
            'data_quality_warnings': []
        }
        
        try:
            sample_size = characteristics.get('sample_size', 0)
            numeric_vars = len(characteristics.get('numeric_variables', []))
            categorical_vars = len(characteristics.get('categorical_variables', []))
            text_vars = len(characteristics.get('text_variables', []))
            
            if sample_size > 0:
                # Basic statistics always recommended
                recommendations['primary_recommendations'].append({
                    'method': 'basic_statistics',
                    'score': 0.9,
                    'rationale': f'Basic statistics suitable for {sample_size} responses',
                    'function_call': 'run_descriptive_analysis()',
                    'category': 'descriptive'
                })
                
                if numeric_vars >= 2:
                    recommendations['secondary_recommendations'].append({
                        'method': 'correlation_analysis',
                        'score': 0.85,
                        'rationale': f'Correlation analysis for {numeric_vars} numeric variables',
                        'function_call': 'run_correlation_analysis()',
                        'category': 'descriptive'
                    })
                    
                if categorical_vars >= 1:
                    recommendations['secondary_recommendations'].append({
                        'method': 'categorical_analysis',
                        'score': 0.75,
                        'rationale': f'Categorical analysis for {categorical_vars} categorical variables',
                        'function_call': 'run_categorical_analysis()',
                        'category': 'descriptive'
                    })
                    
                if text_vars >= 1:
                    recommendations['secondary_recommendations'].append({
                        'method': 'text_analysis',
                        'score': 0.8,
                        'rationale': f'Text analysis for {text_vars} text fields',
                        'function_call': 'run_text_analysis()',
                        'category': 'qualitative'
                    })
            
            # Data quality warnings
            completeness_score = characteristics.get('completeness_score', 100)
            if completeness_score < 80:
                recommendations['data_quality_warnings'].append(
                    f'Data completeness is {completeness_score:.1f}% - consider missing data analysis'
                )
            
            return AnalyticsUtils.convert_numpy_types(recommendations)
            
        except Exception as e:
            logger.error(f"Error generating basic recommendations: {e}")
            return AnalyticsUtils.convert_numpy_types(recommendations)
    
    @staticmethod
    def run_descriptive_analysis(df: pd.DataFrame, analysis_type: str = "comprehensive", 
                                target_variables: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run comprehensive descriptive statistical analysis."""
        if df.empty:
            return {'error': 'No data available for analysis'}
        
        try:
            logger.info(f"Starting descriptive analysis with type: {analysis_type}")
            logger.info(f"DataFrame shape: {df.shape}")
            logger.info(f"DataFrame columns: {list(df.columns)}")
            logger.info(f"DataFrame dtypes: {df.dtypes.to_dict()}")
            
            # Ensure we have a proper DataFrame
            if not isinstance(df, pd.DataFrame):
                logger.error(f"Expected DataFrame, got {type(df)}")
                return {'error': f'Expected DataFrame, got {type(df)}'}
            
            # Check for problematic data types that might cause boolean evaluation issues
            for col in df.columns:
                col_type = str(df[col].dtype)
                logger.debug(f"Column {col}: dtype={col_type}, sample values: {df[col].head(3).tolist()}")
                
                # Handle complex data types that might cause issues
                if col_type == 'object':
                    # Check if the column contains complex objects that might cause boolean evaluation issues
                    sample_val = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
                    if sample_val is not None and not isinstance(sample_val, (str, int, float, bool)):
                        logger.warning(f"Column {col} contains complex objects: {type(sample_val)}")
            
            # Use the comprehensive descriptive analytics functions
            results = analyze_descriptive_data(
                df, 
                analysis_type=analysis_type,
                target_variables=target_variables
            )
            
            # Check if results contain error
            if isinstance(results, dict) and 'error' in results:
                logger.error(f"Error from analyze_descriptive_data: {results['error']}")
                return results
            
            # Add summary information
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
            datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
            
            results['summary'] = {
                'analysis_type': analysis_type,
                'variables_analyzed': len(df.columns),
                'observations': len(df),
                'numeric_variables': len(numeric_cols),
                'categorical_variables': len(categorical_cols),
                'datetime_variables': len(datetime_cols),
                'data_shape': df.shape,
                'memory_usage_mb': df.memory_usage(deep=True).sum() / 1024 / 1024
            }
            
            # Apply numpy type conversion
            return AnalyticsUtils.convert_numpy_types(results)
            
        except Exception as e:
            logger.error(f"Error in descriptive analysis: {e}")
            logger.error(f"DataFrame info: shape={df.shape if hasattr(df, 'shape') else 'unknown'}")
            logger.error(f"DataFrame type: {type(df)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {'error': f'Descriptive analysis failed: {str(e)}'}
    
    @staticmethod
    def run_basic_statistics(df: pd.DataFrame, variables: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run basic statistical analysis only - for numeric response types."""
        if df.empty:
            return {'error': 'No data available for analysis'}

        try:
            # Check if we have survey data in long format
            if 'question_text' in df.columns:
                # Filter to only NUMERIC response types
                # Check response_type column for numeric types
                if 'response_type' in df.columns:
                    numeric_types = ['numeric_integer', 'numeric_decimal', 'scale_rating', 'number']
                    numeric_df = df[df['response_type'].isin(numeric_types)].copy()
                elif 'response_data_type' in df.columns:
                    numeric_df = df[df['response_data_type'] == 'numeric'].copy()
                elif 'analytics_category' in df.columns:
                    numeric_df = df[df['analytics_category'] == 'descriptive'].copy()
                else:
                    # Fallback: use rows where numeric_value is not null
                    numeric_df = df[df['numeric_value'].notna()].copy()

                # Workaround for data quality issue: response_type might be incorrect
                # Also try to find numeric data by attempting to convert response_value
                if numeric_df.empty and 'response_value' in df.columns:
                    # Try to convert all response_values to numeric
                    df_test = df.copy()
                    df_test['_is_numeric'] = pd.to_numeric(df_test['response_value'], errors='coerce').notna()
                    # Find questions where most responses are numeric
                    numeric_questions = df_test.groupby('question_text')['_is_numeric'].mean()
                    numeric_questions = numeric_questions[numeric_questions > 0.5].index.tolist()
                    if numeric_questions:
                        numeric_df = df[df['question_text'].isin(numeric_questions)].copy()

                if numeric_df.empty:
                    return {
                        'results': {},
                        'summary': {
                            'variables_analyzed': 0,
                            'variable_names': [],
                            'observations': 0,
                            'message': 'No numeric response types found. This analysis requires questions with numeric, decimal, or rating scale response types.'
                        }
                    }

                # Convert response_value to numeric for numeric questions
                # (numeric_value column might be NULL if not properly populated)
                numeric_df['value_to_analyze'] = pd.to_numeric(numeric_df['response_value'], errors='coerce')

                # If value_to_analyze is all NaN, try numeric_value column
                if numeric_df['value_to_analyze'].isna().all() and 'numeric_value' in numeric_df.columns:
                    numeric_df['value_to_analyze'] = numeric_df['numeric_value']

                # Pivot the numeric data from long to wide format
                pivoted = numeric_df.pivot_table(
                    index='respondent_id',
                    columns='question_text',
                    values='value_to_analyze',
                    aggfunc='first'
                )

                df_to_analyze = pivoted
            else:
                # Already in wide format
                df_to_analyze = df

            # Select variables or use all numeric ones
            if variables:
                numeric_cols = [col for col in variables if col in df_to_analyze.columns and
                               pd.api.types.is_numeric_dtype(df_to_analyze[col])]
            else:
                numeric_cols = df_to_analyze.select_dtypes(include=[np.number]).columns.tolist()

            if not numeric_cols:
                return {
                    'results': {},
                    'summary': {
                        'variables_analyzed': 0,
                        'variable_names': [],
                        'observations': len(df_to_analyze),
                        'message': 'No numeric variables found. Add numeric, decimal, or rating scale questions to your survey.'
                    }
                }

            basic_stats = calculate_basic_stats(df_to_analyze, numeric_cols)
            percentiles = calculate_percentiles(df_to_analyze, numeric_cols)

            # Merge basic stats and percentiles for each variable
            results = {}
            for col in numeric_cols:
                results[col] = {
                    **basic_stats.get(col, {}),
                    'percentiles': percentiles.get(col, {})
                }

            result = {
                'results': results,
                'summary': {
                    'variables_analyzed': len(numeric_cols),
                    'variable_names': numeric_cols,
                    'observations': len(df_to_analyze)
                }
            }

            return AnalyticsUtils.convert_numpy_types(result)

        except Exception as e:
            logger.error(f"Error in basic statistics: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return {'error': f'Basic statistics failed: {str(e)}'}
    
    @staticmethod
    def run_distribution_analysis(df: pd.DataFrame, variables: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run distribution analysis for numeric variables."""
        if df.empty:
            return {'error': 'No data available for analysis'}

        try:
            # Check if we have survey data in long format (same logic as basic statistics)
            if 'question_text' in df.columns:
                # Filter to only NUMERIC response types
                if 'response_type' in df.columns:
                    numeric_types = ['numeric_integer', 'numeric_decimal', 'scale_rating', 'number']
                    numeric_df = df[df['response_type'].isin(numeric_types)].copy()
                elif 'response_data_type' in df.columns:
                    numeric_df = df[df['response_data_type'] == 'numeric'].copy()
                else:
                    numeric_df = df.copy()

                # Workaround for data quality issue: response_type might be incorrect
                if numeric_df.empty and 'response_value' in df.columns:
                    df_test = df.copy()
                    df_test['_is_numeric'] = pd.to_numeric(df_test['response_value'], errors='coerce').notna()
                    numeric_questions = df_test.groupby('question_text')['_is_numeric'].mean()
                    numeric_questions = numeric_questions[numeric_questions > 0.5].index.tolist()
                    if numeric_questions:
                        numeric_df = df[df['question_text'].isin(numeric_questions)].copy()

                if numeric_df.empty:
                    return {'error': 'No numeric variables found for distribution analysis'}

                # Convert response_value to numeric
                numeric_df['value_to_analyze'] = pd.to_numeric(numeric_df['response_value'], errors='coerce')

                # Analyze each question separately
                results = {}
                for question_text in numeric_df['question_text'].unique():
                    question_data = numeric_df[numeric_df['question_text'] == question_text]
                    series = question_data['value_to_analyze'].dropna()
                    if len(series) > 0:
                        try:
                            analysis_result = {}

                            # Try each analysis separately to provide partial results
                            try:
                                analysis_result['distribution_analysis'] = analyze_distribution(series)
                            except Exception as e:
                                analysis_result['distribution_analysis'] = {'error': str(e)}

                            try:
                                analysis_result['normality_test'] = test_normality(series)
                            except Exception as e:
                                analysis_result['normality_test'] = {'error': str(e)}

                            try:
                                analysis_result['skewness_kurtosis'] = calculate_skewness_kurtosis(series)
                            except Exception as e:
                                analysis_result['skewness_kurtosis'] = {'error': str(e)}

                            try:
                                analysis_result['outliers'] = detect_outliers_iqr(series)
                            except Exception as e:
                                analysis_result['outliers'] = {'error': str(e)}

                            results[question_text] = analysis_result
                        except Exception as e:
                            results[question_text] = {'error': f'Analysis failed: {str(e)}'}
            else:
                # Wide format data - original logic
                if variables:
                    numeric_cols = [col for col in variables if col in df.columns and
                                   pd.api.types.is_numeric_dtype(df[col])]
                else:
                    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

                if not numeric_cols:
                    return {'error': 'No numeric variables found for distribution analysis'}

                results = {}
                for col in numeric_cols:
                    try:
                        series = df[col].dropna()
                        if len(series) > 0:
                            analysis_result = {}

                            # Try each analysis separately to provide partial results
                            try:
                                analysis_result['distribution_analysis'] = analyze_distribution(series)
                            except Exception as e:
                                analysis_result['distribution_analysis'] = {'error': str(e)}

                            try:
                                analysis_result['normality_test'] = test_normality(series)
                            except Exception as e:
                                analysis_result['normality_test'] = {'error': str(e)}

                            try:
                                analysis_result['skewness_kurtosis'] = calculate_skewness_kurtosis(series)
                            except Exception as e:
                                analysis_result['skewness_kurtosis'] = {'error': str(e)}

                            try:
                                analysis_result['outliers'] = detect_outliers_iqr(series)
                            except Exception as e:
                                analysis_result['outliers'] = {'error': str(e)}

                            results[col] = analysis_result
                    except Exception as e:
                        results[col] = {'error': f'Analysis failed: {str(e)}'}

            result = {
                'distribution_analysis': results,
                'summary': {
                    'variables_analyzed': len(results),
                    'variable_names': list(results.keys()),
                    'observations': len(df)
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in distribution analysis: {e}")
            return {'error': f'Distribution analysis failed: {str(e)}'}
    
    @staticmethod
    def run_categorical_analysis(df: pd.DataFrame, variables: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run categorical analysis for categorical variables."""
        if df.empty:
            return {'error': 'No data available for analysis'}

        try:
            # Check if DataFrame is in long format (has question_text and response_value columns)
            if 'question_text' in df.columns and 'response_value' in df.columns:
                # Filter for categorical/choice questions
                categorical_df = df[df['response_data_type'].isin(['choice', 'text', 'categorical'])]

                if variables:
                    # Filter by specific question texts
                    categorical_df = categorical_df[categorical_df['question_text'].isin(variables)]

                if categorical_df.empty:
                    return {'error': 'No categorical variables found for analysis'}

                # Analyze each question separately
                results = {}
                for question_text in categorical_df['question_text'].unique():
                    question_data = categorical_df[categorical_df['question_text'] == question_text]
                    series = question_data['response_value'].dropna()
                    if len(series) > 0:
                        try:
                            results[question_text] = analyze_categorical(series)
                        except Exception as e:
                            results[question_text] = {'error': f'Analysis failed: {str(e)}'}
            else:
                # Original logic for wide format DataFrames
                # Select variables or use all categorical ones
                if variables:
                    categorical_cols = [col for col in variables if col in df.columns and
                                      df[col].dtype in ['object', 'category']]
                else:
                    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

                if not categorical_cols:
                    return {'error': 'No categorical variables found for analysis'}

                results = {}
                for col in categorical_cols:
                    try:
                        series = df[col].dropna()
                        if len(series) > 0:
                            results[col] = analyze_categorical(series)
                    except Exception as e:
                        results[col] = {'error': f'Analysis failed: {str(e)}'}

            # Cross-tabulation analysis for pairs of categorical variables
            cross_tabs = {}
            if 'question_text' in df.columns:
                # For long format, we can't do cross-tabulation easily
                # Skip cross-tabs for now in long format
                pass
            elif len(results) >= 2:
                categorical_cols_list = list(results.keys())
                for i, col1 in enumerate(categorical_cols_list):
                    for col2 in categorical_cols_list[i+1:]:
                        try:
                            cross_tab_key = f"{col1}_vs_{col2}"
                            cross_tabs[cross_tab_key] = analyze_cross_tabulation(df, col1, col2)
                        except Exception as e:
                            cross_tabs[cross_tab_key] = {'error': f'Cross-tabulation failed: {str(e)}'}
            
            result = {
                'categorical_analysis': results,
                'cross_tabulations': cross_tabs,
                'summary': {
                    'variables_analyzed': len(results),
                    'variable_names': list(results.keys()),
                    'cross_tabs_computed': len(cross_tabs),
                    'observations': len(df)
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in categorical analysis: {e}")
            return {'error': f'Categorical analysis failed: {str(e)}'}
    
    @staticmethod
    def run_outlier_analysis(df: pd.DataFrame, variables: Optional[List[str]] = None,
                           methods: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run comprehensive outlier detection analysis."""
        if df.empty:
            return {'error': 'No data available for analysis'}

        try:
            # Check if we have survey data in long format
            if 'question_text' in df.columns:
                # Filter to only NUMERIC response types
                if 'response_type' in df.columns:
                    numeric_types = ['numeric_integer', 'numeric_decimal', 'scale_rating', 'number']
                    numeric_df = df[df['response_type'].isin(numeric_types)].copy()
                elif 'response_data_type' in df.columns:
                    numeric_df = df[df['response_data_type'] == 'numeric'].copy()
                else:
                    numeric_df = df.copy()

                # Workaround for data quality issue
                if numeric_df.empty and 'response_value' in df.columns:
                    df_test = df.copy()
                    df_test['_is_numeric'] = pd.to_numeric(df_test['response_value'], errors='coerce').notna()
                    numeric_questions = df_test.groupby('question_text')['_is_numeric'].mean()
                    numeric_questions = numeric_questions[numeric_questions > 0.5].index.tolist()
                    if numeric_questions:
                        numeric_df = df[df['question_text'].isin(numeric_questions)].copy()

                if numeric_df.empty:
                    return {'error': 'No numeric variables found for outlier analysis'}

                # Convert response_value to numeric
                numeric_df['value_to_analyze'] = pd.to_numeric(numeric_df['response_value'], errors='coerce')

                # Default methods if not specified
                if not methods:
                    methods = ['iqr', 'zscore']

                # Analyze each question separately
                results = {}
                for question_text in numeric_df['question_text'].unique():
                    question_data = numeric_df[numeric_df['question_text'] == question_text]
                    series = question_data['value_to_analyze'].dropna()
                    if len(series) > 0:
                        try:
                            col_results = {}

                            if 'iqr' in methods:
                                try:
                                    col_results['iqr_outliers'] = detect_outliers_iqr(series)
                                except Exception as e:
                                    col_results['iqr_outliers'] = {'error': str(e)}
                            if 'zscore' in methods:
                                try:
                                    col_results['zscore_outliers'] = detect_outliers_zscore(series)
                                except Exception as e:
                                    col_results['zscore_outliers'] = {'error': str(e)}
                            if 'isolation_forest' in methods and len(series) > 50:
                                try:
                                    col_results['isolation_forest_outliers'] = detect_outliers_isolation_forest(series)
                                except Exception as e:
                                    col_results['isolation_forest_outliers'] = {'error': str(e)}
                            if 'mad' in methods:
                                try:
                                    col_results['mad_outliers'] = detect_outliers_mad(series)
                                except Exception as e:
                                    col_results['mad_outliers'] = {'error': str(e)}

                            results[question_text] = col_results
                        except Exception as e:
                            results[question_text] = {'error': f'Outlier detection failed: {str(e)}'}

                result = {
                    'outlier_analysis': results,
                    'methods_used': methods,
                    'summary': {
                        'variables_analyzed': len(results),
                        'variable_names': list(results.keys()),
                        'observations': len(df)
                    }
                }

                return AnalyticsUtils.convert_numpy_types(result)

            else:
                # Wide format data - original logic
                if variables:
                    numeric_cols = [col for col in variables if col in df.columns and
                                   pd.api.types.is_numeric_dtype(df[col])]
                else:
                    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

                if not numeric_cols:
                    return {'error': 'No numeric variables found for outlier analysis'}
            
                # Default methods if not specified
                if not methods:
                    methods = ['iqr', 'zscore', 'isolation_forest'] if len(df) > 100 else ['iqr', 'zscore']

                results = {}
                for col in numeric_cols:
                    try:
                        series = df[col].dropna()
                        if len(series) > 0:
                            col_results = {}

                            if 'iqr' in methods:
                                try:
                                    col_results['iqr_outliers'] = detect_outliers_iqr(series)
                                except Exception as e:
                                    col_results['iqr_outliers'] = {'error': str(e)}
                            if 'zscore' in methods:
                                try:
                                    col_results['zscore_outliers'] = detect_outliers_zscore(series)
                                except Exception as e:
                                    col_results['zscore_outliers'] = {'error': str(e)}
                            if 'isolation_forest' in methods and len(series) > 50:
                                try:
                                    col_results['isolation_forest_outliers'] = detect_outliers_isolation_forest(series)
                                except Exception as e:
                                    col_results['isolation_forest_outliers'] = {'error': str(e)}
                            if 'mad' in methods:
                                try:
                                    col_results['mad_outliers'] = detect_outliers_mad(series)
                                except Exception as e:
                                    col_results['mad_outliers'] = {'error': str(e)}

                            results[col] = col_results
                    except Exception as e:
                        results[col] = {'error': f'Outlier detection failed: {str(e)}'}

                # Overall summary
                try:
                    outlier_summary = get_outlier_summary(df, numeric_cols)
                except Exception as e:
                    outlier_summary = {'error': f'Summary generation failed: {str(e)}'}

                result = {
                    'outlier_analysis': results,
                    'outlier_summary': outlier_summary,
                    'methods_used': methods,
                    'summary': {
                        'variables_analyzed': len(results),
                        'variable_names': list(results.keys()),
                        'observations': len(df)
                    }
                }

                return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in outlier analysis: {e}")
            return {'error': f'Outlier analysis failed: {str(e)}'}
    
    @staticmethod
    def run_missing_data_analysis(df: pd.DataFrame) -> Dict[str, Any]:
        """Run comprehensive missing data analysis."""
        if df.empty:
            return {'error': 'No data available for analysis'}
        
        try:
            missing_analysis = analyze_missing_data(df)
            missing_patterns = get_missing_patterns(df)
            missing_correlations = calculate_missing_correlations(df)
            
            result = {
                'missing_data_analysis': missing_analysis,
                'missing_patterns': missing_patterns,
                'missing_correlations': missing_correlations,
                'summary': {
                    'total_missing_values': df.isnull().sum().sum(),
                    'missing_percentage': (df.isnull().sum().sum() / df.size) * 100,
                    'columns_with_missing': df.isnull().sum()[df.isnull().sum() > 0].to_dict(),
                    'complete_cases': len(df.dropna()),
                    'observations': len(df)
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in missing data analysis: {e}")
            return {'error': f'Missing data analysis failed: {str(e)}'}
    
    @staticmethod
    def run_temporal_analysis(df: pd.DataFrame, date_column: str, 
                            value_columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """Run temporal pattern analysis."""
        if df.empty:
            return {'error': 'No data available for analysis'}
        
        if date_column not in df.columns:
            return {'error': f'Date column "{date_column}" not found in data'}
        
        try:
            # Convert date column if needed
            if not pd.api.types.is_datetime64_any_dtype(df[date_column]):
                df[date_column] = pd.to_datetime(df[date_column], errors='coerce')
            
            # Select value columns or use all numeric ones
            if value_columns:
                numeric_cols = [col for col in value_columns if col in df.columns and 
                               pd.api.types.is_numeric_dtype(df[col])]
            else:
                numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            
            if not numeric_cols:
                return {'error': 'No numeric variables found for temporal analysis'}
            
            temporal_patterns = analyze_temporal_patterns(df, date_column, numeric_cols)
            time_series_stats = calculate_time_series_stats(df, date_column, numeric_cols)
            
            # Seasonality detection for each numeric column
            seasonality_results = {}
            for col in numeric_cols:
                try:
                    seasonality_results[col] = detect_seasonality(df, date_column, col)
                except Exception as e:
                    seasonality_results[col] = {'error': f'Seasonality detection failed: {str(e)}'}
            
            result = {
                'temporal_patterns': temporal_patterns,
                'time_series_statistics': time_series_stats,
                'seasonality_analysis': seasonality_results,
                'summary': {
                    'date_column': date_column,
                    'value_columns': numeric_cols,
                    'date_range': {
                        'start': df[date_column].min().isoformat() if pd.notnull(df[date_column].min()) else None,
                        'end': df[date_column].max().isoformat() if pd.notnull(df[date_column].max()) else None
                    },
                    'observations': len(df)
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in temporal analysis: {e}")
            return {'error': f'Temporal analysis failed: {str(e)}'}
    
    @staticmethod
    def run_geospatial_analysis(df: pd.DataFrame, lat_column: str, lon_column: str) -> Dict[str, Any]:
        """Run geospatial analysis."""
        if df.empty:
            return {'error': 'No data available for analysis'}
        
        if lat_column not in df.columns or lon_column not in df.columns:
            return {'error': f'Location columns "{lat_column}" or "{lon_column}" not found in data'}
        
        try:
            spatial_distribution = analyze_spatial_distribution(df, lat_column, lon_column)
            spatial_autocorr = calculate_spatial_autocorrelation(df, lat_column, lon_column)
            location_clusters = create_location_clusters(df, lat_column, lon_column)
            
            result = {
                'spatial_distribution': spatial_distribution,
                'spatial_autocorrelation': spatial_autocorr,
                'location_clusters': location_clusters,
                'summary': {
                    'latitude_column': lat_column,
                    'longitude_column': lon_column,
                    'valid_coordinates': len(df.dropna(subset=[lat_column, lon_column])),
                    'observations': len(df)
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in geospatial analysis: {e}")
            return {'error': f'Geospatial analysis failed: {str(e)}'}
    
    @staticmethod
    def run_data_quality_analysis(df: pd.DataFrame) -> Dict[str, Any]:
        """Run comprehensive data quality analysis."""
        if df.empty:
            return {'error': 'No data available for analysis'}
        
        try:
            # Use the data quality analysis type
            results = analyze_descriptive_data(df, analysis_type="quality")
            
            # Add additional quality metrics
            quality_metrics = {
                'completeness': {
                    'overall_completeness': (1 - df.isnull().sum().sum() / df.size) * 100,
                    'column_completeness': ((1 - df.isnull().sum() / len(df)) * 100).to_dict()
                },
                'consistency': {
                    'duplicate_rows': df.duplicated().sum(),
                    'duplicate_percentage': (df.duplicated().sum() / len(df)) * 100
                },
                'validity': {
                    'data_types': df.dtypes.astype(str).to_dict(),
                    'unique_values_per_column': df.nunique().to_dict()
                }
            }
            
            results['quality_metrics'] = quality_metrics
            results['summary'] = {
                'analysis_type': 'data_quality',
                'overall_quality_score': min(100, max(0, 100 - (df.isnull().sum().sum() / df.size) * 100 - 
                                           (df.duplicated().sum() / len(df)) * 10)),
                'observations': len(df),
                'variables': len(df.columns)
            }
            
            return AnalyticsUtils.convert_numpy_types(results)
            
        except Exception as e:
            logger.error(f"Error in data quality analysis: {e}")
            return {'error': f'Data quality analysis failed: {str(e)}'}
    
    @staticmethod
    def generate_comprehensive_report(df: pd.DataFrame, include_plots: bool = False) -> Dict[str, Any]:
        """Generate a comprehensive descriptive statistics report."""
        if df.empty:
            return {'error': 'No data available for analysis'}
        
        try:
            # Generate comprehensive analysis
            comprehensive_results = analyze_descriptive_data(df, analysis_type="comprehensive")
            
            # Generate executive summary
            executive_summary = generate_executive_summary(df)
            
            # Generate full report
            full_report = generate_full_report(df)
            
            # Generate analysis workflow recommendations
            workflow = generate_analysis_workflow(df)
            
            result = {
                'comprehensive_analysis': comprehensive_results,
                'executive_summary': executive_summary,
                'full_report': full_report,
                'recommended_workflow': workflow,
                'report_metadata': {
                    'generated_at': datetime.now().isoformat(),
                    'data_shape': df.shape,
                    'include_plots': include_plots,
                    'report_type': 'comprehensive_descriptive'
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error generating comprehensive report: {e}")
            return {'error': f'Report generation failed: {str(e)}'}
    
    @staticmethod
    def run_basic_text_analysis(df: pd.DataFrame, text_columns: List[str]) -> Dict[str, Any]:
        """Run basic text analysis."""
        if df.empty or not text_columns:
            return {'error': 'No text data available for analysis'}
        
        try:
            results = {}
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna()
                    if len(text_data) > 0:
                        # Basic text statistics
                        results[col] = {
                            'total_entries': len(text_data),
                            'average_length': float(text_data.str.len().mean()),
                            'max_length': int(text_data.str.len().max()),
                            'min_length': int(text_data.str.len().min()),
                            'word_count': int(text_data.str.split().str.len().sum()),
                            'unique_entries': int(text_data.nunique())
                        }
            
            result = {
                'text_analysis': results,
                'summary': {
                    'columns_analyzed': len(results),
                    'total_text_entries': sum(r['total_entries'] for r in results.values())
                }
            }
            
            # Apply numpy type conversion
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in text analysis: {e}")
            return {'error': f'Text analysis failed: {str(e)}'}
    
    @staticmethod
    def run_sentiment_analysis(df: pd.DataFrame, text_columns: List[str], 
                             sentiment_method: str = "vader") -> Dict[str, Any]:
        """
        Run comprehensive sentiment analysis on text data.
        
        Args:
            df: DataFrame containing text data
            text_columns: List of text column names to analyze
            sentiment_method: Method to use ('vader', 'textblob')
            
        Returns:
            Dictionary with sentiment analysis results
        """
        if df.empty or not text_columns:
            return {'error': 'No text data available for sentiment analysis'}
        
        try:
            from app.analytics.qualitative.sentiment import analyze_sentiment_batch, analyze_sentiment_trends
            
            results = {}
            overall_sentiments = []
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna().astype(str).tolist()
                    if len(text_data) > 0:
                        # Run sentiment analysis
                        sentiments = analyze_sentiment_batch(text_data)
                        
                        # Calculate statistics
                        polarities = [s['polarity'] for s in sentiments]
                        subjectivities = [s['subjectivity'] for s in sentiments]
                        categories = [s['category'] for s in sentiments]
                        
                        from collections import Counter
                        category_dist = Counter(categories)
                        
                        results[col] = {
                            'sentiment_scores': sentiments,
                            'statistics': {
                                'mean_polarity': float(np.mean(polarities)),
                                'std_polarity': float(np.std(polarities)),
                                'mean_subjectivity': float(np.mean(subjectivities)),
                                'std_subjectivity': float(np.std(subjectivities)),
                                'total_responses': len(text_data)
                            },
                            'category_distribution': dict(category_dist),
                            'most_positive': text_data[np.argmax(polarities)] if polarities else None,
                            'most_negative': text_data[np.argmin(polarities)] if polarities else None
                        }
                        
                        overall_sentiments.extend(sentiments)
            
            # Overall summary
            if overall_sentiments:
                overall_polarities = [s['polarity'] for s in overall_sentiments]
                overall_categories = [s['category'] for s in overall_sentiments]
                
                summary = {
                    'overall_sentiment': float(np.mean(overall_polarities)),
                    'sentiment_distribution': dict(Counter(overall_categories)),
                    'total_texts_analyzed': len(overall_sentiments),
                    'method_used': sentiment_method
                }
            else:
                summary = {'error': 'No valid sentiments calculated'}
            
            return AnalyticsUtils.convert_numpy_types({
                'sentiment_analysis': results,
                'summary': summary
            })
            
        except Exception as e:
            logger.error(f"Error in sentiment analysis: {e}")
            return {'error': f'Sentiment analysis failed: {str(e)}'}
    
    @staticmethod
    def run_theme_analysis(df: pd.DataFrame, text_columns: List[str], 
                          num_themes: int = 5, theme_method: str = "lda") -> Dict[str, Any]:
        """
        Run thematic analysis on text data.
        
        Args:
            df: DataFrame containing text data
            text_columns: List of text column names to analyze
            num_themes: Number of themes to extract
            theme_method: Method to use ('lda', 'nmf', 'clustering')
            
        Returns:
            Dictionary with thematic analysis results
        """
        if df.empty or not text_columns:
            return {'error': 'No text data available for theme analysis'}
        
        try:
            from app.analytics.qualitative.thematic_analysis import ThematicAnalyzer
            
            analyzer = ThematicAnalyzer()
            results = {}
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna().astype(str).tolist()
                    if len(text_data) >= 5:  # Need minimum texts for theme analysis
                        if theme_method == "lda":
                            themes = analyzer.identify_themes_lda(text_data, num_themes)
                        else:
                            themes = analyzer.identify_themes_clustering(text_data, num_themes)
                        
                        # Extract key concepts
                        key_concepts = analyzer.extract_key_concepts(text_data, 20)
                        
                        results[col] = {
                            'themes': themes.get('themes', []),
                            'key_concepts': key_concepts,
                            'method_used': theme_method,
                            'num_texts_analyzed': len(text_data),
                            'coherence_score': themes.get('coherence_score', 0)
                        }
                    else:
                        results[col] = {
                            'error': f'Need at least 5 texts for theme analysis, found {len(text_data)}'
                        }
            
            # Generate overall summary
            valid_results = {k: v for k, v in results.items() if 'error' not in v}
            summary = {
                'columns_analyzed': len(valid_results),
                'total_themes_extracted': sum(len(r.get('themes', [])) for r in valid_results.values()),
                'method_used': theme_method
            }
            
            return AnalyticsUtils.convert_numpy_types({
                'theme_analysis': results,
                'summary': summary
            })
            
        except Exception as e:
            logger.error(f"Error in theme analysis: {e}")
            return {'error': f'Theme analysis failed: {str(e)}'}
    
    @staticmethod
    def run_word_frequency_analysis(df: pd.DataFrame, text_columns: List[str], 
                                   top_n: int = 50, min_word_length: int = 3,
                                   remove_stopwords: bool = True) -> Dict[str, Any]:
        """
        Run word frequency analysis on text data.
        
        Args:
            df: DataFrame containing text data
            text_columns: List of text column names to analyze
            top_n: Number of top words to return
            min_word_length: Minimum word length to include
            remove_stopwords: Whether to remove common stopwords
            
        Returns:
            Dictionary with word frequency analysis results
        """
        if df.empty or not text_columns:
            return {'error': 'No text data available for word frequency analysis'}
        
        try:
            import re
            from collections import Counter
            
            # Try to import NLTK stopwords
            try:
                from nltk.corpus import stopwords
                import nltk
                nltk.download('stopwords', quiet=True)
                stop_words = set(stopwords.words('english'))
            except:
                # Fallback stopwords
                stop_words = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'}
            
            results = {}
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna().astype(str)
                    if len(text_data) > 0:
                        # Combine all text
                        all_text = ' '.join(text_data).lower()
                        
                        # Extract words
                        words = re.findall(r'\b\w+\b', all_text)
                        
                        # Filter words
                        filtered_words = []
                        for word in words:
                            if len(word) >= min_word_length:
                                if not remove_stopwords or word not in stop_words:
                                    filtered_words.append(word)
                        
                        # Count frequencies
                        word_freq = Counter(filtered_words)
                        top_words = word_freq.most_common(top_n)
                        
                        # Calculate statistics
                        total_words = len(filtered_words)
                        unique_words = len(word_freq)
                        
                        results[col] = {
                            'word_frequencies': top_words,
                            'statistics': {
                                'total_words': total_words,
                                'unique_words': unique_words,
                                'lexical_diversity': unique_words / total_words if total_words > 0 else 0,
                                'most_frequent_word': top_words[0] if top_words else None
                            },
                            'parameters': {
                                'top_n': top_n,
                                'min_word_length': min_word_length,
                                'remove_stopwords': remove_stopwords
                            }
                        }
            
            return AnalyticsUtils.convert_numpy_types({
                'word_frequency_analysis': results,
                'summary': {
                    'columns_analyzed': len(results),
                    'parameters_used': {
                        'top_n': top_n,
                        'min_word_length': min_word_length,
                        'remove_stopwords': remove_stopwords
                    }
                }
            })
            
        except Exception as e:
            logger.error(f"Error in word frequency analysis: {e}")
            return {'error': f'Word frequency analysis failed: {str(e)}'}
    
    @staticmethod
    def run_content_analysis(df: pd.DataFrame, text_columns: List[str], 
                           analysis_framework: str = "inductive",
                           coding_scheme: Optional[Dict[str, List[str]]] = None) -> Dict[str, Any]:
        """
        Run content analysis on text data using specified framework.
        
        Args:
            df: DataFrame containing text data
            text_columns: List of text column names to analyze
            analysis_framework: Framework to use ('inductive', 'deductive', 'mixed')
            coding_scheme: Optional predefined coding scheme for deductive analysis
            
        Returns:
            Dictionary with content analysis results
        """
        if df.empty or not text_columns:
            return {'error': 'No text data available for content analysis'}
        
        try:
            from app.analytics.qualitative.content_analysis import ContentAnalyzer
            
            analyzer = ContentAnalyzer()
            results = {}
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna().astype(str).tolist()
                    if len(text_data) > 0:
                        # Run comprehensive content analysis
                        structure = analyzer.analyze_content_structure(text_data)
                        categories = analyzer.analyze_content_categories(text_data, coding_scheme)
                        linguistic = analyzer.analyze_linguistic_features(text_data)
                        patterns = analyzer.analyze_content_patterns(text_data)
                        
                        results[col] = {
                            'structure_analysis': structure,
                            'category_analysis': categories,
                            'linguistic_analysis': linguistic,
                            'pattern_analysis': patterns,
                            'framework_used': analysis_framework,
                            'coding_scheme_applied': coding_scheme is not None
                        }
            
            return AnalyticsUtils.convert_numpy_types({
                'content_analysis': results,
                'summary': {
                    'columns_analyzed': len(results),
                    'framework_used': analysis_framework,
                    'custom_coding_scheme': coding_scheme is not None
                }
            })
            
        except Exception as e:
            logger.error(f"Error in content analysis: {e}")
            return {'error': f'Content analysis failed: {str(e)}'}
    
    @staticmethod
    def run_qualitative_coding(df: pd.DataFrame, text_columns: List[str], 
                             coding_method: str = "open", auto_code: bool = True) -> Dict[str, Any]:
        """
        Run qualitative coding analysis on text data.
        
        Args:
            df: DataFrame containing text data
            text_columns: List of text column names to analyze
            coding_method: Coding method ('open', 'axial', 'selective')
            auto_code: Whether to use automated coding assistance
            
        Returns:
            Dictionary with qualitative coding results
        """
        if df.empty or not text_columns:
            return {'error': 'No text data available for qualitative coding'}
        
        try:
            from app.analytics.qualitative.thematic_analysis import ThematicAnalyzer
            from collections import Counter
            
            analyzer = ThematicAnalyzer()
            results = {}
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna().astype(str).tolist()
                    if len(text_data) > 0:
                        # Extract key concepts for coding
                        key_concepts = analyzer.extract_key_concepts(text_data, 30)
                        
                        # Perform basic theme clustering for code development
                        if len(text_data) >= 3:
                            themes = analyzer.identify_themes_clustering(text_data, min(5, len(text_data)//2))
                            code_categories = themes.get('themes', [])
                        else:
                            code_categories = []
                        
                        # Create coding structure
                        codes = {}
                        for i, theme in enumerate(code_categories):
                            code_name = f"code_{i+1}"
                            codes[code_name] = {
                                'keywords': theme.get('keywords', []),
                                'description': f"Auto-generated code based on {coding_method} coding",
                                'frequency': theme.get('weight', 0),
                                'representative_texts': theme.get('representative_texts', [])[:3]
                            }
                        
                        results[col] = {
                            'coding_scheme': codes,
                            'key_concepts': key_concepts,
                            'coding_method': coding_method,
                            'auto_coded': auto_code,
                            'total_codes_generated': len(codes),
                            'texts_coded': len(text_data)
                        }
            
            return AnalyticsUtils.convert_numpy_types({
                'qualitative_coding': results,
                'summary': {
                    'columns_analyzed': len(results),
                    'coding_method': coding_method,
                    'auto_coding_enabled': auto_code
                }
            })
            
        except Exception as e:
            logger.error(f"Error in qualitative coding: {e}")
            return {'error': f'Qualitative coding failed: {str(e)}'}
    
    @staticmethod
    def run_survey_analysis(df: pd.DataFrame, response_columns: List[str], 
                          question_metadata: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Run comprehensive survey analysis on qualitative responses.
        
        Args:
            df: DataFrame containing survey response data
            response_columns: List of response column names to analyze
            question_metadata: Optional question descriptions
            
        Returns:
            Dictionary with survey analysis results
        """
        if df.empty or not response_columns:
            return {'error': 'No survey data available for analysis'}
        
        try:
            from app.analytics.qualitative.survey_analysis import SurveyAnalyzer
            
            analyzer = SurveyAnalyzer()
            
            # Prepare survey data format
            survey_data = {}
            for col in response_columns:
                if col in df.columns:
                    survey_data[col] = df[col].fillna('').astype(str).tolist()
            
            if not survey_data:
                return {'error': 'No valid survey columns found'}
            
            # Run comprehensive survey analysis
            question_analysis = analyzer.analyze_survey_by_questions(survey_data)
            comparison = analyzer.compare_questions(survey_data)
            respondent_patterns = analyzer.analyze_respondent_patterns(survey_data)
            
            # Generate summary report
            report = analyzer.generate_survey_report(survey_data, question_metadata)
            
            return AnalyticsUtils.convert_numpy_types({
                'survey_analysis': {
                    'question_analysis': question_analysis,
                    'question_comparison': comparison,
                    'respondent_patterns': respondent_patterns
                },
                'summary_report': report,
                'metadata': {
                    'total_questions': len(survey_data),
                    'total_respondents': len(list(survey_data.values())[0]) if survey_data else 0,
                    'questions_with_metadata': len(question_metadata) if question_metadata else 0
                }
            })
            
        except Exception as e:
            logger.error(f"Error in survey analysis: {e}")
            return {'error': f'Survey analysis failed: {str(e)}'}
    
    @staticmethod
    def run_qualitative_statistics(df: pd.DataFrame, text_columns: List[str], 
                                 analysis_type: str = "general") -> Dict[str, Any]:
        """
        Generate comprehensive qualitative statistics.
        
        Args:
            df: DataFrame containing text data
            text_columns: List of text column names to analyze
            analysis_type: Type of analysis ("survey", "interview", "general")
            
        Returns:
            Dictionary with comprehensive qualitative statistics
        """
        if df.empty or not text_columns:
            return {'error': 'No text data available for qualitative statistics'}
        
        try:
            from app.analytics.qualitative.qualitative_stats import QualitativeStatistics
            
            stats = QualitativeStatistics()
            results = {}
            
            for col in text_columns:
                if col in df.columns:
                    text_data = df[col].dropna().astype(str).tolist()
                    if len(text_data) > 0:
                        # Generate comprehensive summary
                        summary = stats.generate_comprehensive_summary(text_data, None, analysis_type)
                        results[col] = summary
            
            # Overall statistics across all columns
            all_texts = []
            for col in text_columns:
                if col in df.columns:
                    all_texts.extend(df[col].dropna().astype(str).tolist())
            
            if all_texts:
                overall_summary = stats.generate_comprehensive_summary(all_texts, None, analysis_type)
                
                return AnalyticsUtils.convert_numpy_types({
                    'column_statistics': results,
                    'overall_statistics': overall_summary,
                    'metadata': {
                        'analysis_type': analysis_type,
                        'columns_analyzed': len(results),
                        'total_texts': len(all_texts)
                    }
                })
            else:
                return {'error': 'No valid text data found for analysis'}
                
        except Exception as e:
            logger.error(f"Error in qualitative statistics: {e}")
            return {'error': f'Qualitative statistics failed: {str(e)}'}
    
    @staticmethod
    def format_api_response(status: str, data: Any, message: str = None) -> Dict[str, Any]:
        """Format API response with proper serialization."""
        response = {
            'status': status,
            'data': AnalyticsUtils.convert_numpy_types(data) if data is not None else None,
            'timestamp': datetime.now().isoformat()
        }
        
        if message:
            response['message'] = message
            
        return response
    
    @staticmethod
    def handle_analysis_error(error: Exception, context: str) -> Dict[str, Any]:
        """Handle analysis errors with proper formatting."""
        error_message = f"{context} failed: {str(error)}"
        logger.error(error_message)
        
        return AnalyticsUtils.format_api_response('error', None, error_message)
    
    # INFERENTIAL ANALYTICS METHODS
    
    @staticmethod
    def run_correlation_analysis(
        df: pd.DataFrame,
        variables: Optional[List[str]] = None,
        correlation_method: str = "pearson",
        significance_level: float = 0.05
    ) -> Dict[str, Any]:
        """Enhanced correlation analysis with significance testing."""
        if df.empty:
            return {'error': 'No data available for correlation analysis'}

        try:
            # Check if we have survey data in long format
            if 'question_text' in df.columns and 'response_value' in df.columns:
                # Filter to only NUMERIC response types
                if 'response_type' in df.columns:
                    numeric_types = ['numeric_integer', 'numeric_decimal', 'scale_rating', 'number']
                    numeric_df = df[df['response_type'].isin(numeric_types)].copy()
                elif 'response_data_type' in df.columns:
                    numeric_df = df[df['response_data_type'] == 'numeric'].copy()
                else:
                    numeric_df = df.copy()

                # Workaround for data quality issue
                if numeric_df.empty and 'response_value' in df.columns:
                    df_test = df.copy()
                    df_test['_is_numeric'] = pd.to_numeric(df_test['response_value'], errors='coerce').notna()
                    numeric_questions = df_test.groupby('question_text')['_is_numeric'].mean()
                    numeric_questions = numeric_questions[numeric_questions > 0.5].index.tolist()
                    if numeric_questions:
                        numeric_df = df[df['question_text'].isin(numeric_questions)].copy()

                if numeric_df.empty:
                    return {'error': 'No numeric variables found for correlation analysis'}

                # Convert response_value to numeric
                numeric_df['value_to_analyze'] = pd.to_numeric(numeric_df['response_value'], errors='coerce')

                # Pivot to wide format for correlation analysis
                pivoted = numeric_df.pivot_table(
                    index='respondent_id',
                    columns='question_text',
                    values='value_to_analyze',
                    aggfunc='first'
                )

                # Filter to specified variables if provided
                if variables:
                    available_vars = [var for var in variables if var in pivoted.columns]
                    if len(available_vars) < 2:
                        return {'error': 'Need at least 2 numeric variables for correlation analysis'}
                    numeric_df = pivoted[available_vars]
                else:
                    numeric_df = pivoted

                if len(numeric_df.columns) < 2:
                    return {'error': 'Need at least 2 numeric variables for correlation analysis'}

            else:
                # Wide format data - original logic
                # Get numeric columns for correlation
                numeric_df = df.select_dtypes(include=[np.number])

                if variables:
                    # Filter to specified variables
                    available_vars = [var for var in variables if var in numeric_df.columns]
                    if len(available_vars) < 2:
                        return {'error': 'Need at least 2 numeric variables for correlation analysis'}
                    numeric_df = numeric_df[available_vars]
                elif len(numeric_df.columns) < 2:
                    return {'error': 'Need at least 2 numeric variables for correlation analysis'}
            
            # Calculate correlation matrix
            correlations = {}
            p_values = {}
            
            for col1 in numeric_df.columns:
                for col2 in numeric_df.columns:
                    if col1 != col2:
                        result = perform_correlation_test(
                            numeric_df, col1, col2, correlation_method, significance_level
                        )
                        if 'error' not in result:
                            key = f"{col1}_{col2}"
                            correlations[key] = result['correlation']
                            p_values[key] = result['p_value']
            
            # Get correlation matrix for overview
            correlation_matrix = numeric_df.corr(method=correlation_method)
            
            result = {
                'correlation_matrix': correlation_matrix.to_dict(),
                'pairwise_correlations': correlations,
                'p_values': p_values,
                'method': correlation_method,
                'significance_level': significance_level,
                'variables_included': list(numeric_df.columns),
                'summary': {
                    'variables_analyzed': len(numeric_df.columns),
                    'total_pairs': len(correlations),
                    'significant_pairs': sum(1 for p in p_values.values() if p < significance_level)
                }
            }
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in correlation analysis: {e}")
            return {'error': f'Correlation analysis failed: {str(e)}'}
    
    @staticmethod
    def run_t_test(
        df: pd.DataFrame,
        dependent_variable: str,
        independent_variable: Optional[str] = None,
        test_type: str = "two_sample",
        alternative: str = "two_sided",
        confidence_level: float = 0.95
    ) -> Dict[str, Any]:
        """Run t-test analysis."""
        if df.empty:
            return {'error': 'No data available for t-test analysis'}
        
        try:
            if dependent_variable not in df.columns:
                return {'error': f'Dependent variable {dependent_variable} not found'}
                
            if test_type == "one_sample":
                # One-sample t-test
                data = df[dependent_variable].dropna()
                result = perform_t_test(data, pd.Series([0] * len(data)), alternative='two-sided')
                
            elif test_type == "paired":
                # Paired t-test
                if not independent_variable or independent_variable not in df.columns:
                    return {'error': 'Independent variable required for paired t-test'}
                    
                data1 = df[dependent_variable].dropna()
                data2 = df[independent_variable].dropna()
                result = perform_paired_t_test(data1, data2, alternative)
                
            else:  # two_sample
                # Two-sample t-test
                if not independent_variable or independent_variable not in df.columns:
                    return {'error': 'Independent variable required for two-sample t-test'}
                
                # Group by independent variable
                groups = df.groupby(independent_variable)[dependent_variable].apply(lambda x: x.dropna())
                group_names = list(groups.index)
                
                if len(group_names) != 2:
                    return {'error': 'Two-sample t-test requires exactly 2 groups'}
                    
                data1, data2 = groups.iloc[0], groups.iloc[1]
                result = perform_t_test(data1, data2, alternative)
            
            # Add confidence interval
            alpha = 1 - confidence_level
            result['confidence_level'] = confidence_level
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in t-test analysis: {e}")
            return {'error': f'T-test analysis failed: {str(e)}'}
    
    @staticmethod
    def run_anova(
        df: pd.DataFrame,
        dependent_variable: str,
        independent_variables: List[str],
        anova_type: str = "one_way",
        post_hoc: bool = True,
        post_hoc_method: str = "tukey"
    ) -> Dict[str, Any]:
        """Run ANOVA analysis."""
        if df.empty:
            return {'error': 'No data available for ANOVA analysis'}
        
        try:
            if dependent_variable not in df.columns:
                return {'error': f'Dependent variable {dependent_variable} not found'}
                
            for var in independent_variables:
                if var not in df.columns:
                    return {'error': f'Independent variable {var} not found'}
            
            if anova_type == "one_way":
                if len(independent_variables) != 1:
                    return {'error': 'One-way ANOVA requires exactly one independent variable'}
                    
                result = perform_anova(df, independent_variables[0], dependent_variable, post_hoc=post_hoc)
                
                # Add post-hoc tests if requested
                if post_hoc and post_hoc_method == "tukey":
                    post_hoc_result = tukey_hsd_test(df, independent_variables[0], dependent_variable)
                    result['post_hoc_tests'] = post_hoc_result
                    
            elif anova_type == "two_way":
                if len(independent_variables) != 2:
                    return {'error': 'Two-way ANOVA requires exactly two independent variables'}
                    
                result = perform_two_way_anova(
                    df, independent_variables[0], independent_variables[1], dependent_variable
                )
                
            elif anova_type == "repeated_measures":
                if len(independent_variables) < 2:
                    return {'error': 'Repeated measures ANOVA requires subject and within variables'}
                    
                subject_var = independent_variables[0]
                within_var = independent_variables[1]
                between_var = independent_variables[2] if len(independent_variables) > 2 else None
                
                result = perform_repeated_measures_anova(
                    df, subject_var, within_var, dependent_variable, between_var
                )
            else:
                return {'error': f'Unknown ANOVA type: {anova_type}'}
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in ANOVA analysis: {e}")
            return {'error': f'ANOVA analysis failed: {str(e)}'}
    
    @staticmethod
    def run_regression_analysis(
        df: pd.DataFrame,
        dependent_variable: str,
        independent_variables: List[str],
        regression_type: str = "linear",
        include_diagnostics: bool = True,
        confidence_level: float = 0.95
    ) -> Dict[str, Any]:
        """Run regression analysis."""
        if df.empty:
            return {'error': 'No data available for regression analysis'}
        
        try:
            if dependent_variable not in df.columns:
                return {'error': f'Dependent variable {dependent_variable} not found'}
                
            for var in independent_variables:
                if var not in df.columns:
                    return {'error': f'Independent variable {var} not found'}
            
            alpha = 1 - confidence_level
            
            if regression_type == "linear":
                result = perform_linear_regression(df, dependent_variable, independent_variables, alpha=alpha)
                
            elif regression_type == "multiple":
                result = perform_multiple_regression(df, dependent_variable, independent_variables, alpha=alpha)
                
            elif regression_type == "logistic":
                result = perform_logistic_regression(df, dependent_variable, independent_variables, alpha=alpha)
                
            elif regression_type == "poisson":
                result = perform_poisson_regression(df, dependent_variable, independent_variables, alpha=alpha)
                
            elif regression_type == "ridge":
                result = perform_ridge_regression(df, dependent_variable, independent_variables)
                
            elif regression_type == "lasso":
                result = perform_lasso_regression(df, dependent_variable, independent_variables)
                
            elif regression_type == "robust":
                result = perform_robust_regression(df, dependent_variable, independent_variables)
                
            else:
                return {'error': f'Unknown regression type: {regression_type}'}
            
            # Add diagnostics if requested and supported
            if include_diagnostics and regression_type in ["linear", "multiple"]:
                try:
                    # This would require the actual model object - simplified for now
                    result['diagnostics_note'] = "Diagnostics available in detailed analysis"
                except:
                    pass
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in regression analysis: {e}")
            return {'error': f'Regression analysis failed: {str(e)}'}
    
    @staticmethod
    def run_chi_square_test(
        df: pd.DataFrame,
        variable1: str,
        variable2: Optional[str] = None,
        test_type: str = "independence",
        expected_frequencies: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """Run chi-square tests."""
        if df.empty:
            return {'error': 'No data available for chi-square test'}
        
        try:
            if variable1 not in df.columns:
                return {'error': f'Variable {variable1} not found'}
            
            if test_type == "independence":
                if not variable2 or variable2 not in df.columns:
                    return {'error': 'Second variable required for independence test'}
                    
                # Create contingency table
                contingency_table = pd.crosstab(df[variable1], df[variable2])
                result = perform_chi_square_test(contingency_table)
                
                # Add Cramér's V effect size
                cramers_v_result = calculate_cramers_v(contingency_table)
                result['effect_size'] = cramers_v_result
                
            elif test_type == "goodness_of_fit":
                # Goodness of fit test
                observed = df[variable1].value_counts().sort_index()
                
                if expected_frequencies:
                    expected = pd.Series(expected_frequencies, index=observed.index)
                else:
                    # Equal expected frequencies
                    expected = pd.Series([len(df) / len(observed)] * len(observed), index=observed.index)
                
                result = perform_chi_square_test(observed, expected)
            else:
                return {'error': f'Unknown chi-square test type: {test_type}'}
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in chi-square test: {e}")
            return {'error': f'Chi-square test failed: {str(e)}'}
    
    @staticmethod
    def run_hypothesis_test(
        df: pd.DataFrame,
        test_type: str,
        variables: List[str],
        null_hypothesis: str,
        alternative_hypothesis: str,
        significance_level: float = 0.05,
        test_parameters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Run general hypothesis testing."""
        if df.empty:
            return {'error': 'No data available for hypothesis test'}
        
        try:
            # Validate variables exist
            for var in variables:
                if var not in df.columns:
                    return {'error': f'Variable {var} not found'}
            
            test_params = test_parameters or {}
            
            if test_type == "z_test":
                # Z-test (using t-test as approximation for large samples)
                if len(variables) < 2:
                    return {'error': 'Z-test requires at least 2 variables or groups'}
                    
                data1 = df[variables[0]].dropna()
                data2 = df[variables[1]].dropna() if len(variables) > 1 else pd.Series([0] * len(data1))
                
                result = perform_t_test(data1, data2, alternative='two-sided')
                result['test_type'] = 'z_test (approximated with t-test)'
                
            elif test_type == "t_test":
                data1 = df[variables[0]].dropna()
                data2 = df[variables[1]].dropna() if len(variables) > 1 else pd.Series([0] * len(data1))
                
                result = perform_t_test(data1, data2, alternative='two-sided')
                
            elif test_type == "mann_whitney":
                if len(variables) < 2:
                    return {'error': 'Mann-Whitney test requires 2 variables'}
                    
                data1 = df[variables[0]].dropna()
                data2 = df[variables[1]].dropna()
                
                result = mann_whitney_u_test(data1, data2, alternative='two-sided')
                
            elif test_type == "wilcoxon":
                if len(variables) < 2:
                    return {'error': 'Wilcoxon test requires 2 variables'}
                    
                data1 = df[variables[0]].dropna()
                data2 = df[variables[1]].dropna()
                
                result = wilcoxon_signed_rank_test(data1, data2, alternative='two-sided')
                
            else:
                return {'error': f'Unknown test type: {test_type}'}
            
            # Add hypothesis information
            result['null_hypothesis'] = null_hypothesis
            result['alternative_hypothesis'] = alternative_hypothesis
            result['significance_level'] = significance_level
            result['decision'] = 'Reject null hypothesis' if result.get('p_value', 1) < significance_level else 'Fail to reject null hypothesis'
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in hypothesis test: {e}")
            return {'error': f'Hypothesis test failed: {str(e)}'}
    
    @staticmethod
    def calculate_confidence_intervals(
        df: pd.DataFrame,
        variables: List[str],
        confidence_level: float = 0.95,
        interval_type: str = "mean",
        bootstrap_samples: int = 1000
    ) -> Dict[str, Any]:
        """Calculate confidence intervals for variables."""
        if df.empty:
            return {'error': 'No data available for confidence intervals'}
        
        try:
            results = {}
            
            for var in variables:
                if var not in df.columns:
                    results[var] = {'error': f'Variable {var} not found'}
                    continue
                
                data = df[var].dropna()
                
                if interval_type == "mean":
                    result = calculate_mean_ci(data, confidence_level)
                elif interval_type == "median":
                    result = calculate_median_ci(data, confidence_level)
                elif interval_type == "proportion":
                    # For proportion, need to count successes
                    if data.dtype == bool:
                        successes = data.sum()
                        n = len(data)
                        result = calculate_proportion_ci(successes, n, confidence_level)
                    else:
                        # Assume binary 0/1 data
                        successes = (data == 1).sum()
                        n = len(data)
                        result = calculate_proportion_ci(successes, n, confidence_level)
                elif interval_type == "variance":
                    # Bootstrap CI for variance
                    def var_func(x): return x.var()
                    result = calculate_bootstrap_ci(data, var_func, confidence_level, bootstrap_samples)
                else:
                    result = {'error': f'Unknown interval type: {interval_type}'}
                
                results[var] = result
            
            summary = {
                'confidence_level': confidence_level,
                'interval_type': interval_type,
                'variables_processed': len(variables),
                'successful_calculations': sum(1 for r in results.values() if 'error' not in r)
            }
            
            return AnalyticsUtils.convert_numpy_types({
                'results': results,
                'summary': summary
            })
            
        except Exception as e:
            logger.error(f"Error calculating confidence intervals: {e}")
            return {'error': f'Confidence interval calculation failed: {str(e)}'}
    
    @staticmethod
    def calculate_effect_size(
        df: pd.DataFrame,
        dependent_variable: str,
        independent_variable: str,
        effect_size_measure: str = "cohen_d"
    ) -> Dict[str, Any]:
        """Calculate effect sizes for statistical comparisons."""
        if df.empty:
            return {'error': 'No data available for effect size calculation'}
        
        try:
            if dependent_variable not in df.columns:
                return {'error': f'Dependent variable {dependent_variable} not found'}
            if independent_variable not in df.columns:
                return {'error': f'Independent variable {independent_variable} not found'}
            
            # Group data by independent variable
            groups = df.groupby(independent_variable)[dependent_variable].apply(lambda x: x.dropna())
            
            if effect_size_measure in ["cohen_d", "hedges_g", "glass_delta"]:
                if len(groups) != 2:
                    return {'error': f'{effect_size_measure} requires exactly 2 groups'}
                    
                group1, group2 = groups.iloc[0], groups.iloc[1]
                
                if effect_size_measure == "cohen_d":
                    result = calculate_cohens_d(group1, group2)
                elif effect_size_measure == "hedges_g":
                    result = calculate_hedges_g(group1, group2)
                elif effect_size_measure == "glass_delta":
                    result = calculate_glass_delta(group1, group2)
                    
            elif effect_size_measure == "eta_squared":
                result = calculate_eta_squared(df, independent_variable, dependent_variable)
                
            elif effect_size_measure == "omega_squared":
                result = calculate_omega_squared(df, independent_variable, dependent_variable)
                
            elif effect_size_measure == "cramers_v":
                # Create contingency table
                contingency_table = pd.crosstab(df[independent_variable], df[dependent_variable])
                result = calculate_cramers_v(contingency_table)
                
            elif effect_size_measure == "odds_ratio":
                # Create 2x2 contingency table
                contingency_table = pd.crosstab(df[independent_variable], df[dependent_variable])
                if contingency_table.shape != (2, 2):
                    return {'error': 'Odds ratio requires 2x2 contingency table'}
                result = calculate_odds_ratio(contingency_table)
                
            else:
                return {'error': f'Unknown effect size measure: {effect_size_measure}'}
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error calculating effect size: {e}")
            return {'error': f'Effect size calculation failed: {str(e)}'}
    
    @staticmethod
    def run_power_analysis(
        df: pd.DataFrame,
        test_type: str,
        effect_size: Optional[float] = None,
        sample_size: Optional[int] = None,
        power: Optional[float] = None,
        significance_level: float = 0.05
    ) -> Dict[str, Any]:
        """Run statistical power analysis."""
        try:
            # Get sample size from data if not provided
            if sample_size is None and not df.empty:
                sample_size = len(df)
            
            if test_type == "t_test":
                if power is None:
                    # Calculate power given effect size and sample size
                    if effect_size is None or sample_size is None:
                        return {'error': 'Need effect size and sample size to calculate power'}
                    result = calculate_power_t_test(sample_size, effect_size, significance_level)
                elif effect_size is None:
                    # Calculate effect size needed for given power and sample size
                    if power is None or sample_size is None:
                        return {'error': 'Need power and sample size to calculate effect size'}
                    result = calculate_effect_size_needed(sample_size, significance_level, power)
                elif sample_size is None:
                    # Calculate sample size needed for given effect size and power
                    if effect_size is None or power is None:
                        return {'error': 'Need effect size and power to calculate sample size'}
                    result = calculate_sample_size_t_test(effect_size, significance_level, power)
                else:
                    # Post-hoc power analysis
                    result = post_hoc_power_analysis(effect_size, sample_size, significance_level)
                    
            elif test_type == "anova":
                n_groups = 3  # Default assumption
                if power is None:
                    if effect_size is None or sample_size is None:
                        return {'error': 'Need effect size and sample size to calculate power'}
                    result = calculate_power_anova(sample_size, effect_size, n_groups, significance_level)
                elif sample_size is None:
                    if effect_size is None or power is None:
                        return {'error': 'Need effect size and power to calculate sample size'}
                    result = calculate_sample_size_anova(effect_size, n_groups, significance_level, power)
                else:
                    return {'error': 'Power analysis configuration not supported for ANOVA'}
                    
            elif test_type == "correlation":
                if sample_size is None:
                    if effect_size is None or power is None:
                        return {'error': 'Need effect size and power to calculate sample size'}
                    result = calculate_sample_size_correlation(effect_size, significance_level, power)
                else:
                    return {'error': 'Power analysis configuration not supported for correlation'}
                    
            else:
                return {'error': f'Unknown test type for power analysis: {test_type}'}
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in power analysis: {e}")
            return {'error': f'Power analysis failed: {str(e)}'}
    
    @staticmethod
    def run_nonparametric_test(
        df: pd.DataFrame,
        test_type: str,
        variables: List[str],
        groups: Optional[str] = None,
        alternative: str = "two_sided"
    ) -> Dict[str, Any]:
        """Run non-parametric statistical tests."""
        if df.empty:
            return {'error': 'No data available for non-parametric test'}
        
        try:
            # Validate variables exist
            for var in variables:
                if var not in df.columns:
                    return {'error': f'Variable {var} not found'}
            
            if test_type == "mann_whitney":
                if len(variables) < 2:
                    return {'error': 'Mann-Whitney test requires 2 variables'}
                    
                data1 = df[variables[0]].dropna()
                data2 = df[variables[1]].dropna()
                result = mann_whitney_u_test(data1, data2, alternative)
                
            elif test_type == "wilcoxon":
                if len(variables) < 2:
                    return {'error': 'Wilcoxon test requires 2 variables'}
                    
                data1 = df[variables[0]].dropna()
                data2 = df[variables[1]].dropna()
                result = wilcoxon_signed_rank_test(data1, data2, alternative)
                
            elif test_type == "kruskal_wallis":
                if not groups or groups not in df.columns:
                    return {'error': 'Kruskal-Wallis test requires groups variable'}
                if len(variables) != 1:
                    return {'error': 'Kruskal-Wallis test requires exactly one dependent variable'}
                    
                result = kruskal_wallis_test(df, groups, variables[0])
                
            elif test_type == "friedman":
                if len(variables) < 3:
                    return {'error': 'Friedman test requires at least 3 variables'}
                    
                result = friedman_test(df, variables)
                
            elif test_type == "kolmogorov_smirnov":
                if len(variables) < 1:
                    return {'error': 'Kolmogorov-Smirnov test requires at least 1 variable'}
                    
                data = df[variables[0]].dropna()
                if len(variables) == 1:
                    # One-sample KS test against normal distribution
                    result = kolmogorov_smirnov_test(data, 'norm')
                else:
                    # Two-sample KS test
                    data2 = df[variables[1]].dropna()
                    result = kolmogorov_smirnov_test(data, data2)
                    
            elif test_type == "shapiro_wilk":
                if len(variables) != 1:
                    return {'error': 'Shapiro-Wilk test requires exactly one variable'}
                    
                data = df[variables[0]].dropna()
                result = shapiro_wilk_test(data)
                
            elif test_type == "anderson_darling":
                if len(variables) != 1:
                    return {'error': 'Anderson-Darling test requires exactly one variable'}
                    
                data = df[variables[0]].dropna()
                result = anderson_darling_test(data)
                
            elif test_type == "runs_test":
                if len(variables) != 1:
                    return {'error': 'Runs test requires exactly one variable'}
                    
                data = df[variables[0]].dropna()
                result = runs_test(data)
                
            else:
                return {'error': f'Unknown non-parametric test type: {test_type}'}
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in non-parametric test: {e}")
            return {'error': f'Non-parametric test failed: {str(e)}'}
    
    # BAYESIAN INFERENCE METHODS
    
    @staticmethod
    def run_bayesian_t_test(
        df: pd.DataFrame,
        variable1: str,
        variable2: str,
        prior_mean: float = 0,
        prior_variance: float = 1,
        credible_level: float = 0.95
    ) -> Dict[str, Any]:
        """Run Bayesian t-test."""
        if df.empty:
            return {'error': 'No data available for Bayesian t-test'}
        
        try:
            if variable1 not in df.columns or variable2 not in df.columns:
                return {'error': 'Variables not found in dataset'}
            
            data1 = df[variable1].dropna()
            data2 = df[variable2].dropna()
            
            result = bayesian_t_test(data1, data2, prior_mean, prior_variance, credible_level)
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in Bayesian t-test: {e}")
            return {'error': f'Bayesian t-test failed: {str(e)}'}
    
    @staticmethod
    def run_bayesian_proportion_test(
        df: pd.DataFrame,
        group_variable: str,
        success_variable: str,
        prior_alpha: float = 1,
        prior_beta: float = 1,
        credible_level: float = 0.95
    ) -> Dict[str, Any]:
        """Run Bayesian proportion test."""
        if df.empty:
            return {'error': 'No data available for Bayesian proportion test'}
        
        try:
            if group_variable not in df.columns or success_variable not in df.columns:
                return {'error': 'Variables not found in dataset'}
            
            # Get group counts
            groups = df[group_variable].unique()
            if len(groups) != 2:
                return {'error': 'Bayesian proportion test requires exactly 2 groups'}
            
            group1_data = df[df[group_variable] == groups[0]]
            group2_data = df[df[group_variable] == groups[1]]
            
            successes1 = group1_data[success_variable].sum()
            n1 = len(group1_data)
            successes2 = group2_data[success_variable].sum()
            n2 = len(group2_data)
            
            result = bayesian_proportion_test(
                successes1, n1, successes2, n2, prior_alpha, prior_beta, credible_level
            )
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in Bayesian proportion test: {e}")
            return {'error': f'Bayesian proportion test failed: {str(e)}'}
    
    # MULTIPLE COMPARISONS METHODS
    
    @staticmethod
    def run_multiple_comparisons_correction(
        p_values: List[float],
        alpha: float = 0.05,
        methods: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Apply multiple comparisons corrections."""
        try:
            if not methods:
                methods = ['bonferroni', 'holm', 'benjamini_hochberg']
            
            result = apply_multiple_corrections(p_values, alpha, methods)
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in multiple comparisons correction: {e}")
            return {'error': f'Multiple comparisons correction failed: {str(e)}'}
    
    @staticmethod
    def run_post_hoc_tests(
        df: pd.DataFrame,
        group_variable: str,
        dependent_variable: str,
        test_type: str = "tukey",
        alpha: float = 0.05
    ) -> Dict[str, Any]:
        """Run post-hoc tests after ANOVA."""
        if df.empty:
            return {'error': 'No data available for post-hoc tests'}
        
        try:
            if group_variable not in df.columns or dependent_variable not in df.columns:
                return {'error': 'Variables not found in dataset'}
            
            if test_type == "tukey":
                result = tukey_hsd_test(df, group_variable, dependent_variable, alpha)
            elif test_type == "games_howell":
                result = games_howell_test(df, group_variable, dependent_variable, alpha)
            elif test_type == "dunnett":
                # Need control group - use first group as control
                control_group = df[group_variable].iloc[0]
                result = dunnett_test(df, group_variable, dependent_variable, control_group, alpha)
            else:
                return {'error': f'Unknown post-hoc test type: {test_type}'}
            
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in post-hoc tests: {e}")
            return {'error': f'Post-hoc tests failed: {str(e)}'}
    
    # TIME SERIES INFERENCE METHODS
    
    @staticmethod
    def run_stationarity_test(
        df: pd.DataFrame,
        variable: str,
        test_types: List[str] = ['adf', 'kpss'],
        alpha: float = 0.05
    ) -> Dict[str, Any]:
        """Test for stationarity in time series."""
        if df.empty:
            return {'error': 'No data available for stationarity test'}
        
        try:
            if variable not in df.columns:
                return {'error': f'Variable {variable} not found'}
            
            series = df[variable].dropna()
            result = test_stationarity(series, test_types, alpha)
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in stationarity test: {e}")
            return {'error': f'Stationarity test failed: {str(e)}'}
    
    @staticmethod
    def run_granger_causality_test(
        df: pd.DataFrame,
        cause_variable: str,
        effect_variable: str,
        max_lag: int = 10,
        alpha: float = 0.05
    ) -> Dict[str, Any]:
        """Test for Granger causality."""
        if df.empty:
            return {'error': 'No data available for Granger causality test'}
        
        try:
            if cause_variable not in df.columns or effect_variable not in df.columns:
                return {'error': 'Variables not found in dataset'}
            
            result = granger_causality_test(df, cause_variable, effect_variable, max_lag, alpha)
            return AnalyticsUtils.convert_numpy_types(result)
            
        except Exception as e:
            logger.error(f"Error in Granger causality test: {e}")
            return {'error': f'Granger causality test failed: {str(e)}'}
    
    @staticmethod
    def get_django_db_connection():
        """Get Django database connection."""
        from core.database import get_django_db_connection
        return get_django_db_connection() 