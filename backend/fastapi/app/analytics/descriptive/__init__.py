"""
Descriptive statistics module for comprehensive data analysis.
"""

import pandas as pd
import numpy as np

from .basic_statistics import (
    calculate_basic_stats,
    calculate_percentiles,
    calculate_grouped_stats,
    calculate_weighted_stats,
    calculate_correlation_matrix,
    calculate_covariance_matrix
)

from .distributions import (
    analyze_distribution,
    test_normality,
    calculate_skewness_kurtosis,
    fit_distribution
)

from .categorical_analysis import (
    analyze_categorical,
    calculate_chi_square,
    calculate_cramers_v,
    analyze_cross_tabulation,
    calculate_diversity_metrics,
    analyze_categorical_associations
)

from .outlier_detection import (
    detect_outliers_iqr,
    detect_outliers_zscore,
    detect_outliers_isolation_forest,
    detect_outliers_mad,
    get_outlier_summary
)

from .missing_data import (
    analyze_missing_data,
    get_missing_patterns,
    calculate_missing_correlations,
    create_missing_data_heatmap,
    analyze_missing_by_group
)

from .temporal_analysis import (
    analyze_temporal_patterns,
    calculate_time_series_stats,
    detect_seasonality
)

from .geospatial_analysis import (
    analyze_spatial_distribution,
    calculate_spatial_autocorrelation,
    create_location_clusters
)

from .summary_generator import (
    generate_full_report,
    generate_executive_summary,
    export_statistics
)

from .auto_detection import (
    DescriptiveAutoDetector,
    auto_analyze_descriptive_data,
    quick_descriptive_recommendation
)

# Main analysis functions for easy access
def analyze_descriptive_data(data, analysis_type="auto", target_variables=None, **kwargs):
    """
    Main function to perform descriptive analysis with automatic method selection.
    
    Args:
        data: Input DataFrame
        analysis_type: Type of analysis ("auto", "basic", "comprehensive", "quality", etc.)
        target_variables: Optional list of target variables
        **kwargs: Additional parameters for specific analyses
        
    Returns:
        Dictionary with analysis results
    """
    try:
        # Ensure we have a proper DataFrame
        if not isinstance(data, pd.DataFrame):
            return {"error": f"Expected DataFrame, got {type(data)}"}
        
        # Check if DataFrame is empty using .empty property instead of boolean evaluation
        if data.empty:
            return {"error": "DataFrame is empty"}
        
        # Log basic info for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"Processing analysis_type: {analysis_type}, data shape: {data.shape}")
        
        if analysis_type == "auto":
            return auto_analyze_descriptive_data(data, **kwargs)
        elif analysis_type == "basic":
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            categorical_cols = data.select_dtypes(include=['object', 'category']).columns.tolist()
            
            results = {}
            if numeric_cols:
                results['basic_stats'] = calculate_basic_stats(data, numeric_cols)
            if categorical_cols:
                results['categorical_analysis'] = {col: analyze_categorical(data[col]) 
                                                 for col in categorical_cols}
            results['missing_analysis'] = analyze_missing_data(data)
            return results
            
        elif analysis_type == "comprehensive":
            results = {}
            numeric_cols = data.select_dtypes(include=['number']).columns.tolist()
            categorical_cols = data.select_dtypes(include=['object', 'category']).columns.tolist()
            
            # Numeric analyses
            if numeric_cols:
                results['basic_stats'] = calculate_basic_stats(data, numeric_cols)
                results['percentiles'] = calculate_percentiles(data, numeric_cols)
                if len(numeric_cols) >= 2:
                    results['correlations'] = calculate_correlation_matrix(data[numeric_cols])
                results['outliers'] = get_outlier_summary(data, numeric_cols)
                
            # Categorical analyses  
            if categorical_cols:
                results['categorical_analysis'] = {col: analyze_categorical(data[col]) 
                                                 for col in categorical_cols}
                
            # Cross-analyses
            results['missing_analysis'] = analyze_missing_data(data)
            results['full_report'] = generate_full_report(data)
            
            return results
            
        elif analysis_type == "quality":
            return {
                'missing_analysis': analyze_missing_data(data),
                'missing_patterns': get_missing_patterns(data),
                'outlier_summary': get_outlier_summary(data, data.select_dtypes(include=['number']).columns.tolist()),
                'data_overview': calculate_basic_stats(data, data.select_dtypes(include=['number']).columns.tolist())
            }
        else:
            return {"error": f"Unknown analysis type: {analysis_type}"}
            
    except Exception as e:
        import logging
        import traceback
        logger = logging.getLogger(__name__)
        logger.error(f"Error in analyze_descriptive_data: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"error": f"Analysis failed: {str(e)}"}

# Convenience functions
def quick_data_overview(data):
    """Get a quick overview of the dataset."""
    return quick_descriptive_recommendation(data, 'overview')

def auto_detect_analysis_needs(data, variable_metadata=None):
    """Automatically detect what analyses are needed for the data."""
    detector = DescriptiveAutoDetector()
    return detector.suggest_descriptive_analyses(data, variable_metadata)

def get_data_characteristics(data, variable_metadata=None):
    """Get comprehensive data characteristics."""
    detector = DescriptiveAutoDetector()
    return detector.detect_data_characteristics(data, variable_metadata)

def generate_analysis_workflow(data, analysis_goals=None):
    """Generate a complete descriptive analysis workflow."""
    detector = DescriptiveAutoDetector()
    suggestions = detector.suggest_descriptive_analyses(data, None, analysis_goals)
    
    workflow = {
        'step_1_data_overview': {
            'function': 'calculate_basic_stats',
            'description': 'Generate basic descriptive statistics',
            'priority': 'high'
        },
        'step_2_data_quality': {
            'function': 'analyze_missing_data',
            'description': 'Assess data quality and completeness',
            'priority': 'high'
        },
        'step_3_distributions': {
            'function': 'analyze_distribution',
            'description': 'Analyze variable distributions',
            'priority': 'medium'
        },
        'step_4_relationships': {
            'function': 'calculate_correlation_matrix',
            'description': 'Explore variable relationships',
            'priority': 'medium'
        },
        'step_5_outliers': {
            'function': 'get_outlier_summary',
            'description': 'Identify potential outliers',
            'priority': 'medium'
        }
    }
    
    # Customize workflow based on suggestions
    primary_methods = [rec['method'] for rec in suggestions['primary_recommendations']]
    
    if 'categorical_analysis' in primary_methods:
        workflow['step_6_categorical'] = {
            'function': 'analyze_categorical',
            'description': 'Analyze categorical variables',
            'priority': 'high'
        }
    
    if 'temporal_analysis' in primary_methods:
        workflow['step_7_temporal'] = {
            'function': 'analyze_temporal_patterns',
            'description': 'Analyze temporal patterns',
            'priority': 'medium'
        }
    
    if 'geospatial_analysis' in primary_methods:
        workflow['step_8_spatial'] = {
            'function': 'analyze_spatial_distribution',
            'description': 'Analyze spatial patterns',
            'priority': 'medium'
        }
    
    return workflow

__all__ = [
    # Main analysis functions
    'analyze_descriptive_data',
    'quick_data_overview',
    'auto_detect_analysis_needs',
    'get_data_characteristics',
    'generate_analysis_workflow',
    
    # Auto-detection classes and functions
    'DescriptiveAutoDetector',
    'auto_analyze_descriptive_data',
    'quick_descriptive_recommendation',
    
    # Basic Statistics
    'calculate_basic_stats',
    'calculate_percentiles',
    'calculate_grouped_stats',
    'calculate_weighted_stats',
    'calculate_correlation_matrix',
    'calculate_covariance_matrix',
    
    # Distributions
    'analyze_distribution',
    'test_normality',
    'calculate_skewness_kurtosis',
    'fit_distribution',
    
    # Categorical Analysis
    'analyze_categorical',
    'calculate_chi_square',
    'calculate_cramers_v',
    'analyze_cross_tabulation',
    
    # Outlier Detection
    'detect_outliers_iqr',
    'detect_outliers_zscore',
    'detect_outliers_isolation_forest',
    'detect_outliers_mad',
    'get_outlier_summary',
    
    # Missing Data
    'analyze_missing_data',
    'get_missing_patterns',
    'calculate_missing_correlations',
    
    # Temporal Analysis
    'analyze_temporal_patterns',
    'calculate_time_series_stats',
    'detect_seasonality',
    
    # Geospatial Analysis
    'analyze_spatial_distribution',
    'calculate_spatial_autocorrelation',
    'create_location_clusters',
    
    # Summary Generation
    'generate_full_report',
    'generate_executive_summary',
    'export_statistics'
]