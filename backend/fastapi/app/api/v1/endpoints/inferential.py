"""
Inferential Analytics Endpoints
Handles hypothesis testing, statistical inference, regression analysis, and advanced statistical methods.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import pandas as pd
from asgiref.sync import sync_to_async

from core.database import get_db
from app.utils.shared import AnalyticsUtils

router = APIRouter()

@router.post("/project/{project_id}/analyze/correlation")
async def analyze_correlations(
    project_id: str,
    variables: Optional[List[str]] = None,
    correlation_method: str = "pearson",
    significance_level: float = 0.05,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run correlation analysis on numeric variables.
    
    Args:
        project_id: Project identifier
        variables: Optional list of variables to correlate
        correlation_method: Correlation method (pearson, spearman, kendall)
        significance_level: Significance level for hypothesis testing
        db: Database session
        
    Returns:
        Correlation analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_correlation_analysis(
            df, variables, correlation_method, significance_level
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'correlation_analysis',
            'correlation_method': correlation_method,
            'significance_level': significance_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "correlation analysis")

@router.post("/project/{project_id}/analyze/t-test")
async def analyze_t_test(
    project_id: str,
    dependent_variable: str,
    independent_variable: Optional[str] = None,
    test_type: str = "two_sample",
    alternative: str = "two_sided",
    confidence_level: float = 0.95,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run t-test analysis.
    
    Args:
        project_id: Project identifier
        dependent_variable: Dependent variable for testing
        independent_variable: Independent variable (for two-sample tests)
        test_type: Type of t-test (one_sample, two_sample, paired)
        alternative: Alternative hypothesis (two_sided, less, greater)
        confidence_level: Confidence level for intervals
        db: Database session
        
    Returns:
        T-test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_t_test(
            df, dependent_variable, independent_variable, 
            test_type, alternative, confidence_level
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 't_test',
            'dependent_variable': dependent_variable,
            'independent_variable': independent_variable,
            'test_type': test_type,
            'alternative': alternative,
            'confidence_level': confidence_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "t-test analysis")

@router.post("/project/{project_id}/analyze/anova")
async def analyze_anova(
    project_id: str,
    dependent_variable: str,
    independent_variables: List[str],
    anova_type: str = "one_way",
    post_hoc: bool = True,
    post_hoc_method: str = "tukey",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run ANOVA (Analysis of Variance) analysis.
    
    Args:
        project_id: Project identifier
        dependent_variable: Dependent variable
        independent_variables: List of independent variables
        anova_type: Type of ANOVA (one_way, two_way, repeated_measures)
        post_hoc: Whether to run post-hoc tests
        post_hoc_method: Post-hoc test method (tukey, scheffe, bonferroni)
        db: Database session
        
    Returns:
        ANOVA results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_anova(
            df, dependent_variable, independent_variables,
            anova_type, post_hoc, post_hoc_method
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'anova',
            'dependent_variable': dependent_variable,
            'independent_variables': independent_variables,
            'anova_type': anova_type,
            'post_hoc_enabled': post_hoc,
            'post_hoc_method': post_hoc_method,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "ANOVA analysis")

@router.post("/project/{project_id}/analyze/regression")
async def analyze_regression(
    project_id: str,
    dependent_variable: str,
    independent_variables: List[str],
    regression_type: str = "linear",
    include_diagnostics: bool = True,
    confidence_level: float = 0.95,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run regression analysis.
    
    Args:
        project_id: Project identifier
        dependent_variable: Dependent variable
        independent_variables: List of independent variables
        regression_type: Type of regression (linear, logistic, polynomial, ridge, lasso)
        include_diagnostics: Whether to include regression diagnostics
        confidence_level: Confidence level for coefficients
        db: Database session
        
    Returns:
        Regression analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_regression_analysis(
            df, dependent_variable, independent_variables,
            regression_type, include_diagnostics, confidence_level
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'regression_analysis',
            'dependent_variable': dependent_variable,
            'independent_variables': independent_variables,
            'regression_type': regression_type,
            'include_diagnostics': include_diagnostics,
            'confidence_level': confidence_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "regression analysis")

@router.post("/project/{project_id}/analyze/chi-square")
async def analyze_chi_square(
    project_id: str,
    variable1: str,
    variable2: Optional[str] = None,
    test_type: str = "independence",
    expected_frequencies: Optional[List[float]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run chi-square tests.
    
    Args:
        project_id: Project identifier
        variable1: First categorical variable
        variable2: Second categorical variable (for independence test)
        test_type: Type of chi-square test (independence, goodness_of_fit)
        expected_frequencies: Expected frequencies (for goodness of fit test)
        db: Database session
        
    Returns:
        Chi-square test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_chi_square_test(
            df, variable1, variable2, test_type, expected_frequencies
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'chi_square_test',
            'variable1': variable1,
            'variable2': variable2,
            'test_type': test_type,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "chi-square test")

@router.post("/project/{project_id}/analyze/hypothesis-test")
async def analyze_hypothesis_test(
    project_id: str,
    test_type: str,
    variables: List[str],
    null_hypothesis: str,
    alternative_hypothesis: str,
    significance_level: float = 0.05,
    test_parameters: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run general hypothesis testing.
    
    Args:
        project_id: Project identifier
        test_type: Type of hypothesis test (z_test, t_test, mann_whitney, wilcoxon)
        variables: Variables for testing
        null_hypothesis: Description of null hypothesis
        alternative_hypothesis: Description of alternative hypothesis
        significance_level: Significance level
        test_parameters: Additional test-specific parameters
        db: Database session
        
    Returns:
        Hypothesis test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_hypothesis_test(
            df, test_type, variables, null_hypothesis,
            alternative_hypothesis, significance_level, test_parameters
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'hypothesis_test',
            'test_type': test_type,
            'variables': variables,
            'null_hypothesis': null_hypothesis,
            'alternative_hypothesis': alternative_hypothesis,
            'significance_level': significance_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "hypothesis test")

@router.post("/project/{project_id}/analyze/confidence-intervals")
async def analyze_confidence_intervals(
    project_id: str,
    variables: List[str],
    confidence_level: float = 0.95,
    interval_type: str = "mean",
    bootstrap_samples: int = 1000,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate confidence intervals for variables.
    
    Args:
        project_id: Project identifier
        variables: Variables to calculate intervals for
        confidence_level: Confidence level
        interval_type: Type of interval (mean, median, proportion, variance)
        bootstrap_samples: Number of bootstrap samples for non-parametric intervals
        db: Database session
        
    Returns:
        Confidence interval results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.calculate_confidence_intervals(
            df, variables, confidence_level, interval_type, bootstrap_samples
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'confidence_intervals',
            'variables': variables,
            'confidence_level': confidence_level,
            'interval_type': interval_type,
            'bootstrap_samples': bootstrap_samples,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "confidence intervals")

@router.post("/project/{project_id}/analyze/effect-size")
async def analyze_effect_size(
    project_id: str,
    dependent_variable: str,
    independent_variable: str,
    effect_size_measure: str = "cohen_d",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate effect sizes for statistical comparisons.
    
    Args:
        project_id: Project identifier
        dependent_variable: Dependent variable
        independent_variable: Independent variable
        effect_size_measure: Effect size measure (cohen_d, eta_squared, cramers_v, odds_ratio)
        db: Database session
        
    Returns:
        Effect size results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.calculate_effect_size(
            df, dependent_variable, independent_variable, effect_size_measure
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'effect_size',
            'dependent_variable': dependent_variable,
            'independent_variable': independent_variable,
            'effect_size_measure': effect_size_measure,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "effect size analysis")

@router.post("/project/{project_id}/analyze/power-analysis")
async def analyze_power(
    project_id: str,
    test_type: str,
    effect_size: Optional[float] = None,
    sample_size: Optional[int] = None,
    power: Optional[float] = None,
    significance_level: float = 0.05,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run statistical power analysis.
    
    Args:
        project_id: Project identifier
        test_type: Type of statistical test
        effect_size: Effect size (optional - can be calculated or specified)
        sample_size: Sample size (optional - can be calculated or specified)
        power: Statistical power (optional - can be calculated or specified)
        significance_level: Significance level
        db: Database session
        
    Returns:
        Power analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_power_analysis(
            df, test_type, effect_size, sample_size, power, significance_level
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'power_analysis',
            'test_type': test_type,
            'effect_size': effect_size,
            'sample_size': sample_size,
            'power': power,
            'significance_level': significance_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "power analysis")

@router.post("/project/{project_id}/analyze/nonparametric")
async def analyze_nonparametric(
    project_id: str,
    test_type: str,
    variables: List[str],
    groups: Optional[str] = None,
    alternative: str = "two_sided",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run non-parametric statistical tests.
    
    Args:
        project_id: Project identifier
        test_type: Type of non-parametric test (mann_whitney, wilcoxon, kruskal_wallis, friedman)
        variables: Variables for testing
        groups: Grouping variable (if applicable)
        alternative: Alternative hypothesis direction
        db: Database session
        
    Returns:
        Non-parametric test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_nonparametric_test(
            df, test_type, variables, groups, alternative
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'nonparametric_test',
            'test_type': test_type,
            'variables': variables,
            'groups': groups,
            'alternative': alternative,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "non-parametric test")

@router.post("/project/{project_id}/analyze/bayesian-t-test")
async def analyze_bayesian_t_test(
    project_id: str,
    variable1: str,
    variable2: str,
    prior_mean: float = 0,
    prior_variance: float = 1,
    credible_level: float = 0.95,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run Bayesian t-test analysis.
    
    Args:
        project_id: Project identifier
        variable1: First variable for comparison
        variable2: Second variable for comparison
        prior_mean: Prior mean for effect size
        prior_variance: Prior variance for effect size
        credible_level: Credible interval level
        db: Database session
        
    Returns:
        Bayesian t-test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_bayesian_t_test(
            df, variable1, variable2, prior_mean, prior_variance, credible_level
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'bayesian_t_test',
            'variable1': variable1,
            'variable2': variable2,
            'prior_mean': prior_mean,
            'prior_variance': prior_variance,
            'credible_level': credible_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "Bayesian t-test")

@router.post("/project/{project_id}/analyze/bayesian-proportion-test")
async def analyze_bayesian_proportion_test(
    project_id: str,
    group_variable: str,
    success_variable: str,
    prior_alpha: float = 1,
    prior_beta: float = 1,
    credible_level: float = 0.95,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run Bayesian proportion test.
    
    Args:
        project_id: Project identifier
        group_variable: Variable defining groups
        success_variable: Binary variable indicating success
        prior_alpha: Beta prior alpha parameter
        prior_beta: Beta prior beta parameter
        credible_level: Credible interval level
        db: Database session
        
    Returns:
        Bayesian proportion test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_bayesian_proportion_test(
            df, group_variable, success_variable, prior_alpha, prior_beta, credible_level
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'bayesian_proportion_test',
            'group_variable': group_variable,
            'success_variable': success_variable,
            'prior_alpha': prior_alpha,
            'prior_beta': prior_beta,
            'credible_level': credible_level,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "Bayesian proportion test")

@router.post("/project/{project_id}/analyze/multiple-comparisons")
async def analyze_multiple_comparisons(
    project_id: str,
    p_values: List[float],
    alpha: float = 0.05,
    correction_methods: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Apply multiple comparisons corrections to p-values.
    
    Args:
        project_id: Project identifier
        p_values: List of p-values to correct
        alpha: Family-wise error rate
        correction_methods: Methods to apply (bonferroni, holm, benjamini_hochberg, etc.)
        db: Database session
        
    Returns:
        Multiple comparisons correction results
    """
    try:
        if not correction_methods:
            correction_methods = ['bonferroni', 'holm', 'benjamini_hochberg']
        
        results = AnalyticsUtils.run_multiple_comparisons_correction(
            p_values, alpha, correction_methods
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'multiple_comparisons_correction',
            'original_p_values': p_values,
            'alpha': alpha,
            'correction_methods': correction_methods,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "multiple comparisons correction")

@router.post("/project/{project_id}/analyze/post-hoc-tests")
async def analyze_post_hoc_tests(
    project_id: str,
    group_variable: str,
    dependent_variable: str,
    test_type: str = "tukey",
    alpha: float = 0.05,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run post-hoc tests after ANOVA.
    
    Args:
        project_id: Project identifier
        group_variable: Variable defining groups
        dependent_variable: Dependent variable
        test_type: Type of post-hoc test (tukey, games_howell, dunnett)
        alpha: Significance level
        db: Database session
        
    Returns:
        Post-hoc test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_post_hoc_tests(
            df, group_variable, dependent_variable, test_type, alpha
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'post_hoc_tests',
            'group_variable': group_variable,
            'dependent_variable': dependent_variable,
            'test_type': test_type,
            'alpha': alpha,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "post-hoc tests")

@router.post("/project/{project_id}/analyze/time-series/stationarity")
async def analyze_stationarity(
    project_id: str,
    variable: str,
    test_types: List[str] = None,
    alpha: float = 0.05,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test for stationarity in time series data.
    
    Args:
        project_id: Project identifier
        variable: Time series variable to test
        test_types: Types of stationarity tests (adf, kpss, pp)
        alpha: Significance level
        db: Database session
        
    Returns:
        Stationarity test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        if test_types is None:
            test_types = ['adf', 'kpss']
        
        results = AnalyticsUtils.run_stationarity_test(
            df, variable, test_types, alpha
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'stationarity_test',
            'variable': variable,
            'test_types': test_types,
            'alpha': alpha,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "stationarity test")

@router.post("/project/{project_id}/analyze/time-series/granger-causality")
async def analyze_granger_causality(
    project_id: str,
    cause_variable: str,
    effect_variable: str,
    max_lag: int = 10,
    alpha: float = 0.05,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Test for Granger causality between time series variables.
    
    Args:
        project_id: Project identifier
        cause_variable: Potential causal variable
        effect_variable: Effect variable
        max_lag: Maximum lag to test
        alpha: Significance level
        db: Database session
        
    Returns:
        Granger causality test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_granger_causality_test(
            df, cause_variable, effect_variable, max_lag, alpha
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'granger_causality_test',
            'cause_variable': cause_variable,
            'effect_variable': effect_variable,
            'max_lag': max_lag,
            'alpha': alpha,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "Granger causality test")

@router.get("/analysis-types")
async def get_inferential_analysis_types() -> Dict[str, Any]:
    """
    Get available inferential analysis types and methods.
    
    Returns:
        Available inferential analysis types
    """
    try:
        analysis_types = {
            'inferential_analysis_types': {
                'correlation': {
                    'description': 'Correlation analysis between variables',
                    'methods': ['pearson', 'spearman', 'kendall'],
                    'includes': ['correlation_matrix', 'significance_tests', 'confidence_intervals']
                },
                't_test': {
                    'description': 'Student\'s t-test for mean comparisons',
                    'types': ['one_sample', 'two_sample', 'paired'],
                    'includes': ['test_statistic', 'p_value', 'confidence_interval', 'effect_size']
                },
                'anova': {
                    'description': 'Analysis of Variance for group comparisons',
                    'types': ['one_way', 'two_way', 'repeated_measures'],
                    'includes': ['f_statistic', 'p_value', 'post_hoc_tests', 'effect_sizes']
                },
                'regression': {
                    'description': 'Regression analysis for predictive modeling',
                    'types': ['linear', 'multiple', 'logistic', 'poisson', 'ridge', 'lasso', 'robust'],
                    'includes': ['coefficients', 'r_squared', 'residual_analysis', 'diagnostics']
                },
                'chi_square': {
                    'description': 'Chi-square tests for categorical data',
                    'types': ['independence', 'goodness_of_fit'],
                    'includes': ['test_statistic', 'p_value', 'cramers_v', 'contingency_table']
                },
                'hypothesis_test': {
                    'description': 'General hypothesis testing framework',
                    'types': ['z_test', 't_test', 'mann_whitney', 'wilcoxon'],
                    'includes': ['test_statistic', 'p_value', 'critical_value', 'decision']
                },
                'confidence_intervals': {
                    'description': 'Confidence interval estimation',
                    'types': ['mean', 'median', 'proportion', 'variance'],
                    'methods': ['parametric', 'bootstrap', 'bayesian']
                },
                'effect_size': {
                    'description': 'Effect size calculations',
                    'measures': ['cohen_d', 'hedges_g', 'glass_delta', 'eta_squared', 'omega_squared', 'cramers_v', 'odds_ratio'],
                    'includes': ['magnitude_interpretation', 'confidence_intervals']
                },
                'power_analysis': {
                    'description': 'Statistical power analysis',
                    'applications': ['sample_size_calculation', 'power_calculation', 'effect_size_detection'],
                    'includes': ['power_curves', 'sensitivity_analysis']
                },
                'nonparametric': {
                    'description': 'Non-parametric statistical tests',
                    'tests': ['mann_whitney', 'wilcoxon', 'kruskal_wallis', 'friedman', 'kolmogorov_smirnov', 'shapiro_wilk', 'anderson_darling', 'runs_test'],
                    'includes': ['rank_based_tests', 'distribution_free_methods']
                },
                'bayesian_inference': {
                    'description': 'Bayesian statistical methods',
                    'tests': ['bayesian_t_test', 'bayesian_proportion_test', 'bayesian_ab_test'],
                    'includes': ['posterior_distributions', 'credible_intervals', 'bayes_factors', 'prior_specifications']
                },
                'multiple_comparisons': {
                    'description': 'Multiple comparisons and post-hoc tests',
                    'corrections': ['bonferroni', 'holm', 'benjamini_hochberg', 'benjamini_yekutieli'],
                    'post_hoc_tests': ['tukey_hsd', 'games_howell', 'dunnett'],
                    'includes': ['family_wise_error_control', 'false_discovery_rate']
                },
                'time_series_inference': {
                    'description': 'Time series statistical inference',
                    'tests': ['stationarity', 'autocorrelation', 'seasonality', 'granger_causality', 'cointegration'],
                    'includes': ['unit_root_tests', 'lag_selection', 'change_point_detection']
                }
            },
            'statistical_assumptions': {
                'normality': 'Data should be normally distributed',
                'independence': 'Observations should be independent',
                'homoscedasticity': 'Equal variances across groups',
                'linearity': 'Linear relationship between variables',
                'stationarity': 'Time series should be stationary (for time series tests)',
                'sphericity': 'Equal variances of differences (for repeated measures)'
            }
        }
        
        return AnalyticsUtils.format_api_response('success', analysis_types)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting inferential analysis types")

@router.get("/endpoints")
async def get_inferential_endpoints() -> Dict[str, Any]:
    """
    Get all available inferential analytics endpoints.
    
    Returns:
        List of all inferential analytics endpoints
    """
    try:
        endpoints = {
            'inferential_analytics_endpoints': {
                # Core statistical tests
                'POST /project/{project_id}/analyze/correlation': 'Run correlation analysis',
                'POST /project/{project_id}/analyze/t-test': 'Run t-test analysis',
                'POST /project/{project_id}/analyze/anova': 'Run ANOVA analysis',
                'POST /project/{project_id}/analyze/regression': 'Run regression analysis',
                'POST /project/{project_id}/analyze/chi-square': 'Run chi-square tests',
                'POST /project/{project_id}/analyze/hypothesis-test': 'Run general hypothesis testing',
                'POST /project/{project_id}/analyze/confidence-intervals': 'Calculate confidence intervals',
                'POST /project/{project_id}/analyze/effect-size': 'Calculate effect sizes',
                'POST /project/{project_id}/analyze/power-analysis': 'Run power analysis',
                'POST /project/{project_id}/analyze/nonparametric': 'Run non-parametric tests',
                
                # Bayesian inference
                'POST /project/{project_id}/analyze/bayesian-t-test': 'Run Bayesian t-test',
                'POST /project/{project_id}/analyze/bayesian-proportion-test': 'Run Bayesian proportion test',
                
                # Multiple comparisons and post-hoc tests
                'POST /project/{project_id}/analyze/multiple-comparisons': 'Apply multiple comparisons corrections',
                'POST /project/{project_id}/analyze/post-hoc-tests': 'Run post-hoc tests after ANOVA',
                
                # Time series inference
                'POST /project/{project_id}/analyze/time-series/stationarity': 'Test for stationarity in time series',
                'POST /project/{project_id}/analyze/time-series/granger-causality': 'Test for Granger causality',
                
                # Information endpoints
                'GET /analysis-types': 'Get available inferential analysis types',
                'GET /endpoints': 'Get all inferential analytics endpoints'
            }
        }
        
        return AnalyticsUtils.format_api_response('success', endpoints)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting inferential endpoints") 