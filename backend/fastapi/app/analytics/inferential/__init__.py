"""
Inferential statistics module for research data analysis.
"""

import numpy as np

from .hypothesis_testing import (
    perform_t_test,
    perform_paired_t_test,
    perform_welch_t_test,
    perform_anova,
    perform_two_way_anova,
    perform_repeated_measures_anova,
    perform_chi_square_test,
    perform_fisher_exact_test,
    perform_mcnemar_test,
    perform_correlation_test,
    perform_partial_correlation,
    hypothesis_test_summary
)

from .confidence_intervals import (
    calculate_mean_ci,
    calculate_proportion_ci,
    calculate_difference_ci,
    calculate_correlation_ci,
    calculate_median_ci,
    calculate_bootstrap_ci,
    calculate_prediction_interval
)

from .power_analysis import (
    calculate_sample_size_t_test,
    calculate_sample_size_anova,
    calculate_sample_size_proportion,
    calculate_sample_size_correlation,
    calculate_power_t_test,
    calculate_power_anova,
    calculate_effect_size_needed,
    post_hoc_power_analysis
)

from .effect_sizes import (
    calculate_cohens_d,
    calculate_hedges_g,
    calculate_glass_delta,
    calculate_eta_squared,
    calculate_omega_squared,
    calculate_cohens_f,
    calculate_cramers_v,
    calculate_odds_ratio,
    calculate_risk_ratio,
    calculate_nnt
)

from .multiple_comparisons import (
    bonferroni_correction,
    holm_bonferroni_correction,
    benjamini_hochberg_correction,
    benjamini_yekutieli_correction,
    tukey_hsd_test,
    dunnett_test,
    games_howell_test
)

from .nonparametric_tests import (
    mann_whitney_u_test,
    wilcoxon_signed_rank_test,
    kruskal_wallis_test,
    friedman_test,
    runs_test,
    kolmogorov_smirnov_test,
    anderson_darling_test,
    shapiro_wilk_test,
    mood_median_test
)

from .regression_analysis import (
    perform_linear_regression,
    perform_multiple_regression,
    perform_logistic_regression,
    perform_poisson_regression,
    calculate_regression_diagnostics,
    calculate_vif,
    perform_ridge_regression,
    perform_lasso_regression,
    perform_robust_regression
)

from .time_series_inference import (
    test_stationarity,
    test_autocorrelation,
    test_seasonality,
    granger_causality_test,
    cointegration_test,
    change_point_detection,
    forecast_accuracy_tests
)

from .bayesian_inference import (
    bayesian_t_test,
    bayesian_proportion_test,
    calculate_bayes_factor,
    calculate_posterior_distribution,
    calculate_credible_interval,
    bayesian_ab_test
)

from .bootstrap_methods import (
    bootstrap_mean,
    bootstrap_median,
    bootstrap_std,
    bootstrap_quantile,
    bootstrap_difference_means,
    bootstrap_ratio_means,
    bootstrap_correlation,
    bootstrap_regression,
    permutation_test,
    jackknife_estimate,
    bootstrap_hypothesis_test
)

from .inference_utils import (
    validate_series_data,
    validate_two_samples,
    validate_dataframe_columns,
    test_normality,
    test_equal_variances,
    test_independence,
    calculate_standard_error,
    calculate_degrees_of_freedom,
    welch_degrees_of_freedom,
    pooled_variance,
    interpret_cohens_d,
    interpret_correlation,
    interpret_eta_squared,
    interpret_cramers_v,
    interpret_odds_ratio,
    format_p_value,
    format_confidence_interval,
    create_summary_statistics,
    check_test_assumptions,
    get_test_recommendations
)

from .auto_detection import (
    InferentialAutoDetector,
    auto_detect_statistical_tests,
    quick_test_suggestion
)

# Main analysis functions for easy access
def analyze_inferential_data(data, target_variable=None, grouping_variable=None, 
                           analysis_type="auto", **kwargs):
    """
    Main function to perform inferential analysis with automatic test selection.
    
    Args:
        data: Input data (DataFrame, Series, or dict)
        target_variable: Name of dependent/target variable
        grouping_variable: Name of independent/grouping variable
        analysis_type: Type of analysis ("auto", "t_test", "anova", "correlation", etc.)
        **kwargs: Additional parameters for specific analyses
        
    Returns:
        Dictionary with analysis results
    """
    if analysis_type == "auto":
        return auto_detect_statistical_tests(data, target_variable, grouping_variable, **kwargs)
    elif analysis_type == "t_test":
        # Implement specific t-test logic based on data structure
        if grouping_variable and target_variable:
            groups = data.groupby(grouping_variable)[target_variable]
            if len(groups) == 2:
                group_list = [group for _, group in groups]
                return perform_t_test(group_list[0], group_list[1], **kwargs)
        return {"error": "Invalid data structure for t-test"}
    elif analysis_type == "anova":
        if grouping_variable and target_variable:
            return perform_anova(data, grouping_variable, target_variable, **kwargs)
        return {"error": "ANOVA requires both grouping and target variables"}
    elif analysis_type == "correlation":
        if len(data.columns) >= 2:
            cols = data.select_dtypes(include=[np.number]).columns
            if len(cols) >= 2:
                return perform_correlation_test(data, cols[0], cols[1], **kwargs)
        return {"error": "Correlation requires at least 2 numeric variables"}
    else:
        return {"error": f"Unknown analysis type: {analysis_type}"}

# Convenience functions
def quick_compare_groups(group1, group2, paired=False):
    """Quick comparison between two groups with automatic test selection."""
    return quick_test_suggestion(group1, group2, paired)

def auto_test_assumptions(data, target_variable=None, grouping_variable=None):
    """Automatically test statistical assumptions for the data."""
    detector = InferentialAutoDetector()
    characteristics = detector.detect_data_characteristics(data, target_variable, grouping_variable)
    return characteristics['statistical_assumptions']

def get_test_recommendations_smart(data, target_variable=None, grouping_variable=None):
    """Get smart recommendations for statistical tests."""
    detector = InferentialAutoDetector()
    return detector.suggest_statistical_tests(data, target_variable, grouping_variable)

def generate_analysis_workflow(data, target_variable=None, grouping_variable=None):
    """Generate a complete analysis workflow with step-by-step recommendations."""
    detector = InferentialAutoDetector()
    characteristics = detector.detect_data_characteristics(data, target_variable, grouping_variable)
    suggestions = detector.suggest_statistical_tests(data, target_variable, grouping_variable)
    
    workflow = {
        'step_1_data_exploration': {
            'function': 'create_summary_statistics',
            'description': 'Generate descriptive statistics',
            'data_characteristics': characteristics
        },
        'step_2_assumption_testing': {
            'function': 'check_test_assumptions',
            'description': 'Test statistical assumptions',
            'assumptions': characteristics['statistical_assumptions']
        },
        'step_3_primary_analysis': {
            'recommended_tests': suggestions['primary_recommendations'][:2],
            'description': 'Perform primary statistical analysis'
        },
        'step_4_effect_size': {
            'function': 'calculate_effect_sizes',
            'description': 'Calculate and interpret effect sizes'
        },
        'step_5_power_analysis': {
            'needed': suggestions['power_analysis_needed'],
            'description': 'Assess statistical power and sample size adequacy'
        }
    }
    
    return workflow

__all__ = [
    # Main analysis functions
    'analyze_inferential_data',
    'quick_compare_groups',
    'auto_test_assumptions',
    'get_test_recommendations_smart',
    'generate_analysis_workflow',
    
    # Auto-detection classes and functions
    'InferentialAutoDetector',
    'auto_detect_statistical_tests',
    'quick_test_suggestion',
    
    # Hypothesis Testing
    'perform_t_test', 'perform_paired_t_test', 'perform_welch_t_test',
    'perform_anova', 'perform_two_way_anova', 'perform_repeated_measures_anova',
    'perform_chi_square_test', 'perform_fisher_exact_test', 'perform_mcnemar_test',
    'perform_correlation_test', 'perform_partial_correlation', 'hypothesis_test_summary',
    
    # Confidence Intervals
    'calculate_mean_ci', 'calculate_proportion_ci', 'calculate_difference_ci',
    'calculate_correlation_ci', 'calculate_median_ci', 'calculate_bootstrap_ci',
    'calculate_prediction_interval',
    
    # Power Analysis
    'calculate_sample_size_t_test', 'calculate_sample_size_anova',
    'calculate_sample_size_proportion', 'calculate_sample_size_correlation',
    'calculate_power_t_test', 'calculate_power_anova', 'calculate_effect_size_needed',
    'post_hoc_power_analysis',
    
    # Effect Sizes
    'calculate_cohens_d', 'calculate_hedges_g', 'calculate_glass_delta',
    'calculate_eta_squared', 'calculate_omega_squared', 'calculate_cohens_f',
    'calculate_cramers_v', 'calculate_odds_ratio', 'calculate_risk_ratio',
    'calculate_nnt',
    
    # Multiple Comparisons
    'bonferroni_correction', 'holm_bonferroni_correction',
    'benjamini_hochberg_correction', 'benjamini_yekutieli_correction',
    'tukey_hsd_test', 'dunnett_test', 'games_howell_test',
    
    # Non-parametric Tests
    'mann_whitney_u_test', 'wilcoxon_signed_rank_test', 'kruskal_wallis_test',
    'friedman_test', 'runs_test', 'kolmogorov_smirnov_test',
    'anderson_darling_test', 'shapiro_wilk_test', 'mood_median_test',
    
    # Regression Analysis
    'perform_linear_regression', 'perform_multiple_regression',
    'perform_logistic_regression', 'perform_poisson_regression',
    'calculate_regression_diagnostics', 'calculate_vif',
    'perform_ridge_regression', 'perform_lasso_regression', 'perform_robust_regression',
    
    # Time Series Inference
    'test_stationarity', 'test_autocorrelation', 'test_seasonality',
    'granger_causality_test', 'cointegration_test', 'change_point_detection',
    'forecast_accuracy_tests',
    
    # Bayesian Inference
    'bayesian_t_test', 'bayesian_proportion_test', 'calculate_bayes_factor',
    'calculate_posterior_distribution', 'calculate_credible_interval',
    'bayesian_ab_test',
    
    # Bootstrap Methods
    'bootstrap_mean', 'bootstrap_median', 'bootstrap_std', 'bootstrap_quantile',
    'bootstrap_difference_means', 'bootstrap_ratio_means', 'bootstrap_correlation',
    'bootstrap_regression', 'permutation_test', 'jackknife_estimate',
    'bootstrap_hypothesis_test',
    
    # Inference Utilities
    'validate_series_data', 'validate_two_samples', 'validate_dataframe_columns',
    'test_normality', 'test_equal_variances', 'test_independence',
    'calculate_standard_error', 'calculate_degrees_of_freedom', 'welch_degrees_of_freedom',
    'pooled_variance', 'interpret_cohens_d', 'interpret_correlation',
    'interpret_eta_squared', 'interpret_cramers_v', 'interpret_odds_ratio',
    'format_p_value', 'format_confidence_interval', 'create_summary_statistics',
    'check_test_assumptions', 'get_test_recommendations'
]