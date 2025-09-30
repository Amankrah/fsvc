"""
Comprehensive hypothesis testing module for research data.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List, Tuple, Optional, Union
import warnings
from statsmodels.stats.anova import anova_lm
from statsmodels.formula.api import ols
import pingouin as pg

def perform_t_test(
    data1: pd.Series,
    data2: pd.Series,
    alternative: str = 'two-sided',
    equal_var: bool = True,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform independent samples t-test with comprehensive output.
    
    Args:
        data1: First sample
        data2: Second sample
        alternative: 'two-sided', 'less', or 'greater'
        equal_var: Assume equal variances
        alpha: Significance level
        
    Returns:
        Dictionary with detailed test results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    if len(data1_clean) < 2 or len(data2_clean) < 2:
        return {"error": "Insufficient data for t-test"}
    
    # Test assumptions
    assumptions = _test_t_test_assumptions(data1_clean, data2_clean)
    
    # Perform t-test
    t_stat, p_value = stats.ttest_ind(
        data1_clean, data2_clean, 
        alternative=alternative,
        equal_var=equal_var
    )
    
    # Calculate effect size
    from .effect_sizes import calculate_cohens_d
    effect_size = calculate_cohens_d(data1_clean, data2_clean)
    
    # Calculate confidence interval for difference
    from .confidence_intervals import calculate_difference_ci
    ci = calculate_difference_ci(data1_clean, data2_clean, confidence=1-alpha)
    
    # Descriptive statistics
    desc_stats = {
        "group1": {
            "n": len(data1_clean),
            "mean": float(data1_clean.mean()),
            "std": float(data1_clean.std()),
            "se": float(data1_clean.std() / np.sqrt(len(data1_clean)))
        },
        "group2": {
            "n": len(data2_clean),
            "mean": float(data2_clean.mean()),
            "std": float(data2_clean.std()),
            "se": float(data2_clean.std() / np.sqrt(len(data2_clean)))
        }
    }
    
    # Degrees of freedom
    if equal_var:
        df = len(data1_clean) + len(data2_clean) - 2
    else:
        # Welch's t-test degrees of freedom
        s1_sq = data1_clean.var()
        s2_sq = data2_clean.var()
        n1 = len(data1_clean)
        n2 = len(data2_clean)
        df = (s1_sq/n1 + s2_sq/n2)**2 / ((s1_sq/n1)**2/(n1-1) + (s2_sq/n2)**2/(n2-1))
    
    return {
        "test_type": "Independent samples t-test" if equal_var else "Welch's t-test",
        "alternative": alternative,
        "t_statistic": float(t_stat),
        "p_value": float(p_value),
        "degrees_of_freedom": float(df),
        "significant": p_value < alpha,
        "alpha": alpha,
        "effect_size": effect_size,
        "confidence_interval": ci,
        "descriptive_statistics": desc_stats,
        "assumptions": assumptions,
        "interpretation": _interpret_t_test(p_value, effect_size['cohens_d'], alternative)
    }

def perform_paired_t_test(
    data1: pd.Series,
    data2: pd.Series,
    alternative: str = 'two-sided',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform paired samples t-test.
    
    Args:
        data1: First measurement
        data2: Second measurement
        alternative: 'two-sided', 'less', or 'greater'
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    # Ensure paired data
    paired_data = pd.DataFrame({'data1': data1, 'data2': data2}).dropna()
    
    if len(paired_data) < 2:
        return {"error": "Insufficient paired data for t-test"}
    
    differences = paired_data['data1'] - paired_data['data2']
    
    # Test for normality of differences
    _, norm_p = stats.shapiro(differences)
    
    # Perform paired t-test
    t_stat, p_value = stats.ttest_rel(
        paired_data['data1'], 
        paired_data['data2'],
        alternative=alternative
    )
    
    # Effect size for paired data
    mean_diff = differences.mean()
    std_diff = differences.std()
    cohens_d = mean_diff / std_diff if std_diff > 0 else 0
    
    # Confidence interval for mean difference
    se_diff = std_diff / np.sqrt(len(differences))
    t_critical = stats.t.ppf(1 - alpha/2, len(differences) - 1)
    ci_lower = mean_diff - t_critical * se_diff
    ci_upper = mean_diff + t_critical * se_diff
    
    return {
        "test_type": "Paired samples t-test",
        "alternative": alternative,
        "t_statistic": float(t_stat),
        "p_value": float(p_value),
        "degrees_of_freedom": len(differences) - 1,
        "significant": p_value < alpha,
        "alpha": alpha,
        "mean_difference": float(mean_diff),
        "std_difference": float(std_diff),
        "effect_size": {
            "cohens_d": float(cohens_d),
            "interpretation": _interpret_cohens_d(cohens_d)
        },
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence_level": 1 - alpha
        },
        "n_pairs": len(paired_data),
        "normality_test": {
            "p_value": float(norm_p),
            "normal": norm_p > 0.05
        }
    }

def perform_welch_t_test(
    data1: pd.Series,
    data2: pd.Series,
    alternative: str = 'two-sided',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Welch's t-test (unequal variances).
    
    This is a wrapper that calls perform_t_test with equal_var=False.
    """
    return perform_t_test(data1, data2, alternative, equal_var=False, alpha=alpha)

def perform_anova(
    data: pd.DataFrame,
    group_column: str,
    value_column: str,
    alpha: float = 0.05,
    post_hoc: bool = True
) -> Dict[str, Any]:
    """
    Perform one-way ANOVA with post-hoc tests.
    
    Args:
        data: DataFrame containing the data
        group_column: Column containing group labels
        value_column: Column containing values to test
        alpha: Significance level
        post_hoc: Whether to perform post-hoc tests
        
    Returns:
        Dictionary with ANOVA results
    """
    # Clean data
    clean_data = data[[group_column, value_column]].dropna()
    
    # Get groups
    groups = clean_data[group_column].unique()
    if len(groups) < 2:
        return {"error": "Need at least 2 groups for ANOVA"}
    
    # Prepare data for ANOVA
    group_data = [group_df[value_column].values 
                  for _, group_df in clean_data.groupby(group_column)]
    
    # Check sample sizes
    sample_sizes = [len(g) for g in group_data]
    if any(n < 2 for n in sample_sizes):
        return {"error": "Each group needs at least 2 observations"}
    
    # Test assumptions
    assumptions = _test_anova_assumptions(clean_data, group_column, value_column)
    
    # Perform ANOVA
    f_stat, p_value = stats.f_oneway(*group_data)
    
    # Calculate effect sizes
    from .effect_sizes import calculate_eta_squared, calculate_omega_squared
    eta_squared = calculate_eta_squared(clean_data, group_column, value_column)
    omega_squared = calculate_omega_squared(clean_data, group_column, value_column)
    
    # Descriptive statistics by group
    group_stats = clean_data.groupby(group_column)[value_column].agg([
        'count', 'mean', 'std', 'min', 'max'
    ]).to_dict('index')
    
    # Calculate degrees of freedom
    df_between = len(groups) - 1
    df_within = len(clean_data) - len(groups)
    df_total = len(clean_data) - 1
    
    result = {
        "test_type": "One-way ANOVA",
        "f_statistic": float(f_stat),
        "p_value": float(p_value),
        "degrees_of_freedom": {
            "between_groups": df_between,
            "within_groups": df_within,
            "total": df_total
        },
        "significant": p_value < alpha,
        "alpha": alpha,
        "effect_sizes": {
            "eta_squared": eta_squared,
            "omega_squared": omega_squared
        },
        "group_statistics": group_stats,
        "sample_sizes": dict(zip(groups, sample_sizes)),
        "assumptions": assumptions
    }
    
    # Post-hoc tests if significant
    if post_hoc and p_value < alpha and len(groups) > 2:
        from .multiple_comparisons import tukey_hsd_test
        result["post_hoc"] = tukey_hsd_test(clean_data, group_column, value_column)
    
    return result

def perform_two_way_anova(
    data: pd.DataFrame,
    factor1_column: str,
    factor2_column: str,
    value_column: str,
    interaction: bool = True,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform two-way ANOVA.
    
    Args:
        data: DataFrame containing the data
        factor1_column: First factor column
        factor2_column: Second factor column
        value_column: Dependent variable column
        interaction: Include interaction term
        alpha: Significance level
        
    Returns:
        Dictionary with two-way ANOVA results
    """
    # Clean data
    clean_data = data[[factor1_column, factor2_column, value_column]].dropna()
    
    if len(clean_data) < 4:
        return {"error": "Insufficient data for two-way ANOVA"}
    
    # Create formula
    if interaction:
        formula = f'{value_column} ~ C({factor1_column}) + C({factor2_column}) + C({factor1_column}):C({factor2_column})'
    else:
        formula = f'{value_column} ~ C({factor1_column}) + C({factor2_column})'
    
    try:
        # Fit model
        model = ols(formula, data=clean_data).fit()
        
        # Get ANOVA table
        anova_table = anova_lm(model, typ=2)
        
        # Extract results
        results = {
            "test_type": "Two-way ANOVA",
            "interaction_included": interaction,
            "factors": {
                factor1_column: {
                    "f_statistic": float(anova_table.loc[f'C({factor1_column})', 'F']),
                    "p_value": float(anova_table.loc[f'C({factor1_column})', 'PR(>F)']),
                    "df": int(anova_table.loc[f'C({factor1_column})', 'df']),
                    "sum_squares": float(anova_table.loc[f'C({factor1_column})', 'sum_sq']),
                    "significant": anova_table.loc[f'C({factor1_column})', 'PR(>F)'] < alpha
                },
                factor2_column: {
                    "f_statistic": float(anova_table.loc[f'C({factor2_column})', 'F']),
                    "p_value": float(anova_table.loc[f'C({factor2_column})', 'PR(>F)']),
                    "df": int(anova_table.loc[f'C({factor2_column})', 'df']),
                    "sum_squares": float(anova_table.loc[f'C({factor2_column})', 'sum_sq']),
                    "significant": anova_table.loc[f'C({factor2_column})', 'PR(>F)'] < alpha
                }
            },
            "residual": {
                "df": int(anova_table.loc['Residual', 'df']),
                "sum_squares": float(anova_table.loc['Residual', 'sum_sq']),
                "mean_squares": float(anova_table.loc['Residual', 'mean_sq'])
            },
            "r_squared": float(model.rsquared),
            "adj_r_squared": float(model.rsquared_adj),
            "n_observations": len(clean_data),
            "alpha": alpha
        }
        
        # Add interaction if included
        if interaction and f'C({factor1_column}):C({factor2_column})' in anova_table.index:
            results["interaction"] = {
                "f_statistic": float(anova_table.loc[f'C({factor1_column}):C({factor2_column})', 'F']),
                "p_value": float(anova_table.loc[f'C({factor1_column}):C({factor2_column})', 'PR(>F)']),
                "df": int(anova_table.loc[f'C({factor1_column}):C({factor2_column})', 'df']),
                "sum_squares": float(anova_table.loc[f'C({factor1_column}):C({factor2_column})', 'sum_sq']),
                "significant": anova_table.loc[f'C({factor1_column}):C({factor2_column})', 'PR(>F)'] < alpha
            }
        
        # Cell means
        cell_means = clean_data.groupby([factor1_column, factor2_column])[value_column].agg(['mean', 'std', 'count'])
        results["cell_statistics"] = cell_means.to_dict('index')
        
        return results
        
    except Exception as e:
        return {"error": f"Two-way ANOVA failed: {str(e)}"}

def perform_repeated_measures_anova(
    data: pd.DataFrame,
    subject_column: str,
    within_column: str,
    value_column: str,
    between_column: Optional[str] = None,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform repeated measures ANOVA.
    
    Args:
        data: DataFrame in long format
        subject_column: Column identifying subjects
        within_column: Within-subjects factor
        value_column: Dependent variable
        between_column: Between-subjects factor (optional)
        alpha: Significance level
        
    Returns:
        Dictionary with repeated measures ANOVA results
    """
    try:
        if between_column:
            # Mixed ANOVA
            aov = pg.mixed_anova(
                data=data,
                dv=value_column,
                within=within_column,
                between=between_column,
                subject=subject_column
            )
            test_type = "Mixed ANOVA"
        else:
            # Pure repeated measures
            aov = pg.rm_anova(
                data=data,
                dv=value_column,
                within=within_column,
                subject=subject_column
            )
            test_type = "Repeated measures ANOVA"
        
        # Extract results
        results = {
            "test_type": test_type,
            "effects": {}
        }
        
        for _, row in aov.iterrows():
            source = row['Source']
            results["effects"][source] = {
                "f_statistic": float(row['F']),
                "p_value": float(row['p-unc']),
                "df_num": int(row['DF1']),
                "df_den": int(row['DF2']),
                "partial_eta_squared": float(row['np2']),
                "significant": row['p-unc'] < alpha
            }
        
        results["alpha"] = alpha
        results["n_subjects"] = data[subject_column].nunique()
        results["n_observations"] = len(data)
        
        # Sphericity test if applicable
        if not between_column and data[within_column].nunique() > 2:
            sphericity = pg.sphericity(
                data=data,
                dv=value_column,
                within=within_column,
                subject=subject_column
            )
            results["sphericity_test"] = {
                "chi_square": float(sphericity['chi2']),
                "p_value": float(sphericity['pval']),
                "sphericity_assumed": sphericity['pval'] > 0.05
            }
        
        return results
        
    except Exception as e:
        return {"error": f"Repeated measures ANOVA failed: {str(e)}"}

def perform_chi_square_test(
    observed: Union[pd.DataFrame, pd.Series],
    expected: Optional[Union[pd.DataFrame, pd.Series]] = None,
    alpha: float = 0.05,
    correction: bool = True
) -> Dict[str, Any]:
    """
    Perform chi-square test of independence or goodness of fit.
    
    Args:
        observed: Observed frequencies (crosstab for independence test)
        expected: Expected frequencies (for goodness of fit)
        alpha: Significance level
        correction: Apply Yates' correction for 2x2 tables
        
    Returns:
        Dictionary with test results
    """
    # Determine test type
    if isinstance(observed, pd.DataFrame) and expected is None:
        # Test of independence
        chi2, p_value, dof, expected_freq = stats.chi2_contingency(observed, correction=correction)
        test_type = "Chi-square test of independence"
        
        # Calculate effect size
        from .effect_sizes import calculate_cramers_v
        cramers_v = calculate_cramers_v(observed)
        
        # Check expected frequencies
        min_expected = expected_freq.min()
        cells_below_5 = (expected_freq < 5).sum()
        
        result = {
            "test_type": test_type,
            "chi2_statistic": float(chi2),
            "p_value": float(p_value),
            "degrees_of_freedom": int(dof),
            "significant": p_value < alpha,
            "alpha": alpha,
            "effect_size": {
                "cramers_v": cramers_v['cramers_v'],
                "interpretation": cramers_v['interpretation']
            },
            "expected_frequencies": expected_freq.tolist(),
            "observed_frequencies": observed.values.tolist(),
            "table_dimensions": observed.shape,
            "assumptions": {
                "min_expected_frequency": float(min_expected),
                "cells_below_5": int(cells_below_5),
                "assumption_met": min_expected >= 5 and cells_below_5 == 0
            }
        }
        
        # Add residuals
        residuals = (observed - expected_freq) / np.sqrt(expected_freq)
        result["standardized_residuals"] = residuals.values.tolist()
        
    else:
        # Goodness of fit test
        if expected is None:
            # Equal expected frequencies
            n_categories = len(observed)
            expected = [observed.sum() / n_categories] * n_categories
        
        chi2, p_value = stats.chisquare(observed, expected)
        dof = len(observed) - 1
        
        result = {
            "test_type": "Chi-square goodness of fit test",
            "chi2_statistic": float(chi2),
            "p_value": float(p_value),
            "degrees_of_freedom": int(dof),
            "significant": p_value < alpha,
            "alpha": alpha,
            "observed": observed.tolist() if hasattr(observed, 'tolist') else list(observed),
            "expected": expected.tolist() if hasattr(expected, 'tolist') else list(expected)
        }
    
    return result

def perform_fisher_exact_test(
    table: pd.DataFrame,
    alternative: str = 'two-sided',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Fisher's exact test for 2x2 contingency tables.
    
    Args:
        table: 2x2 contingency table
        alternative: 'two-sided', 'less', or 'greater'
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    if table.shape != (2, 2):
        return {"error": "Fisher's exact test requires a 2x2 table"}
    
    # Perform test
    odds_ratio, p_value = stats.fisher_exact(table, alternative=alternative)
    
    # Calculate confidence interval for odds ratio
    from .confidence_intervals import calculate_odds_ratio_ci
    or_ci = calculate_odds_ratio_ci(table, confidence=1-alpha)
    
    return {
        "test_type": "Fisher's exact test",
        "alternative": alternative,
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "odds_ratio": float(odds_ratio),
        "odds_ratio_ci": or_ci,
        "table": table.values.tolist(),
        "interpretation": _interpret_odds_ratio(odds_ratio)
    }

def perform_mcnemar_test(
    table: pd.DataFrame,
    correction: bool = True,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform McNemar's test for paired categorical data.
    
    Args:
        table: 2x2 contingency table of paired data
        correction: Apply continuity correction
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    if table.shape != (2, 2):
        return {"error": "McNemar's test requires a 2x2 table"}
    
    # Extract values
    n01 = table.iloc[0, 1]
    n10 = table.iloc[1, 0]
    
    # Perform test
    if n01 + n10 == 0:
        return {"error": "No discordant pairs for McNemar's test"}
    
    if correction and n01 + n10 < 25:
        # Use exact binomial test
        p_value = stats.binom_test(n01, n01 + n10, 0.5)
        chi2_stat = None
        test_method = "exact"
    else:
        # Use chi-square approximation
        if correction:
            chi2_stat = (abs(n01 - n10) - 1)**2 / (n01 + n10)
        else:
            chi2_stat = (n01 - n10)**2 / (n01 + n10)
        p_value = stats.chi2.sf(chi2_stat, 1)
        test_method = "chi-square approximation"
    
    return {
        "test_type": "McNemar's test",
        "method": test_method,
        "chi2_statistic": float(chi2_stat) if chi2_stat else None,
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "discordant_pairs": {
            "n01": int(n01),
            "n10": int(n10),
            "total": int(n01 + n10)
        },
        "table": table.values.tolist()
    }

def perform_correlation_test(
    data: pd.DataFrame,
    x_column: str,
    y_column: str,
    method: str = "pearson",
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform correlation test with comprehensive output.
    
    Args:
        data: DataFrame containing the data
        x_column: First variable column
        y_column: Second variable column
        method: 'pearson', 'spearman', or 'kendall'
        alpha: Significance level
        
    Returns:
        Dictionary with correlation test results
    """
    # Clean data
    clean_data = data[[x_column, y_column]].dropna()
    
    if len(clean_data) < 3:
        return {"error": "Need at least 3 observations for correlation test"}
    
    x = clean_data[x_column]
    y = clean_data[y_column]
    
    # Perform correlation test
    if method == "pearson":
        corr, p_value = stats.pearsonr(x, y)
        test_assumptions = {
            "normality_x": stats.shapiro(x)[1] > 0.05,
            "normality_y": stats.shapiro(y)[1] > 0.05,
            "linear_relationship": True  # Would need to check residuals
        }
    elif method == "spearman":
        corr, p_value = stats.spearmanr(x, y)
        test_assumptions = {"monotonic_relationship": True}
    elif method == "kendall":
        corr, p_value = stats.kendalltau(x, y)
        test_assumptions = {"ordinal_data": True}
    else:
        return {"error": f"Unknown correlation method: {method}"}
    
    # Calculate confidence interval
    from .confidence_intervals import calculate_correlation_ci
    ci = calculate_correlation_ci(corr, len(clean_data), confidence=1-alpha, method=method)
    
    # Calculate R-squared
    r_squared = corr ** 2
    
    return {
        "test_type": f"{method.capitalize()} correlation",
        "correlation": float(corr),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "r_squared": float(r_squared),
        "confidence_interval": ci,
        "sample_size": len(clean_data),
        "interpretation": _interpret_correlation(corr),
        "assumptions": test_assumptions,
        "degrees_of_freedom": len(clean_data) - 2
    }

def perform_partial_correlation(
    data: pd.DataFrame,
    x_column: str,
    y_column: str,
    control_columns: List[str],
    method: str = "pearson",
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform partial correlation controlling for other variables.
    
    Args:
        data: DataFrame containing the data
        x_column: First variable
        y_column: Second variable
        control_columns: Variables to control for
        method: Correlation method
        alpha: Significance level
        
    Returns:
        Dictionary with partial correlation results
    """
    try:
        # Use pingouin for partial correlation
        result = pg.partial_corr(
            data=data,
            x=x_column,
            y=y_column,
            covar=control_columns,
            method=method
        )
        
        return {
            "test_type": f"Partial {method} correlation",
            "correlation": float(result['r'].iloc[0]),
            "p_value": float(result['p-val'].iloc[0]),
            "significant": result['p-val'].iloc[0] < alpha,
            "alpha": alpha,
            "controlled_variables": control_columns,
            "sample_size": len(data.dropna(subset=[x_column, y_column] + control_columns)),
            "confidence_interval": {
                "lower": float(result['CI95%'].iloc[0][0]),
                "upper": float(result['CI95%'].iloc[0][1])
            } if 'CI95%' in result.columns else None
        }
        
    except Exception as e:
        return {"error": f"Partial correlation failed: {str(e)}"}

def hypothesis_test_summary(
    data: pd.DataFrame,
    test_type: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Automated hypothesis test selection and execution.
    
    Args:
        data: DataFrame containing the data
        test_type: Type of test to perform
        **kwargs: Additional arguments for specific tests
        
    Returns:
        Dictionary with test results and recommendations
    """
    test_functions = {
        't-test': perform_t_test,
        'paired-t-test': perform_paired_t_test,
        'anova': perform_anova,
        'chi-square': perform_chi_square_test,
        'correlation': perform_correlation_test
    }
    
    if test_type not in test_functions:
        return {"error": f"Unknown test type: {test_type}"}
    
    # Perform the test
    result = test_functions[test_type](data, **kwargs)
    
    # Add recommendations
    if 'p_value' in result:
        result['recommendation'] = _get_test_recommendation(
            result.get('p_value'),
            result.get('effect_size'),
            result.get('sample_size', len(data))
        )
    
    return result

# Helper functions

def _test_t_test_assumptions(data1: pd.Series, data2: pd.Series) -> Dict[str, Any]:
    """Test assumptions for t-test."""
    # Normality tests
    _, norm_p1 = stats.shapiro(data1)
    _, norm_p2 = stats.shapiro(data2)
    
    # Levene's test for equal variances
    _, levene_p = stats.levene(data1, data2)
    
    return {
        "normality": {
            "group1_p_value": float(norm_p1),
            "group2_p_value": float(norm_p2),
            "both_normal": norm_p1 > 0.05 and norm_p2 > 0.05
        },
        "equal_variance": {
            "levene_p_value": float(levene_p),
            "equal_variance": levene_p > 0.05
        },
        "sample_sizes": {
            "group1": len(data1),
            "group2": len(data2),
            "balanced": abs(len(data1) - len(data2)) / max(len(data1), len(data2)) < 0.2
        }
    }

def _test_anova_assumptions(data: pd.DataFrame, group_col: str, value_col: str) -> Dict[str, Any]:
    """Test assumptions for ANOVA."""
    groups = data.groupby(group_col)[value_col]
    
    # Normality tests by group
    normality_tests = {}
    for name, group in groups:
        if len(group) >= 3:
            _, p_value = stats.shapiro(group)
            normality_tests[str(name)] = float(p_value)
    
    # Levene's test for homogeneity of variances
    group_data = [group.values for _, group in groups]
    _, levene_p = stats.levene(*group_data)
    
    return {
        "normality_by_group": normality_tests,
        "all_normal": all(p > 0.05 for p in normality_tests.values()),
        "homogeneity_of_variance": {
            "levene_p_value": float(levene_p),
            "equal_variance": levene_p > 0.05
        }
    }

def _interpret_t_test(p_value: float, cohens_d: float, alternative: str) -> str:
    """Interpret t-test results."""
    if p_value < 0.05:
        effect = _interpret_cohens_d(cohens_d)
        direction = "greater than" if cohens_d > 0 else "less than"
        if alternative == 'two-sided':
            return f"Significant difference found (p={p_value:.4f}) with {effect} effect size. Group 1 mean is {direction} Group 2 mean."
        else:
            return f"Significant difference found (p={p_value:.4f}) with {effect} effect size."
    else:
        return f"No significant difference found (p={p_value:.4f})."

def _interpret_cohens_d(d: float) -> str:
    """Interpret Cohen's d effect size."""
    d = abs(d)
    if d < 0.2:
        return "negligible"
    elif d < 0.5:
        return "small"
    elif d < 0.8:
        return "medium"
    else:
        return "large"

def _interpret_correlation(r: float) -> str:
    """Interpret correlation coefficient."""
    r_abs = abs(r)
    if r_abs < 0.1:
        strength = "negligible"
    elif r_abs < 0.3:
        strength = "weak"
    elif r_abs < 0.5:
        strength = "moderate"
    elif r_abs < 0.7:
        strength = "strong"
    else:
        strength = "very strong"
    
    direction = "positive" if r > 0 else "negative"
    return f"{strength} {direction} correlation"

def _interpret_odds_ratio(or_value: float) -> str:
    """Interpret odds ratio."""
    if or_value < 0.5:
        return "Strong negative association"
    elif or_value < 0.75:
        return "Moderate negative association"
    elif or_value < 1.5:
        return "Weak or no association"
    elif or_value < 3:
        return "Moderate positive association"
    else:
        return "Strong positive association"

def _get_test_recommendation(p_value: float, effect_size: Dict[str, Any], sample_size: int) -> str:
    """Get recommendation based on test results."""
    if p_value < 0.05:
        if effect_size and 'interpretation' in effect_size:
            effect_desc = effect_size['interpretation']
            if 'negligible' in effect_desc or 'weak' in effect_desc:
                return "Statistically significant but small practical effect. Consider if this difference is meaningful for your research."
            else:
                return "Statistically significant with meaningful effect size. Results support rejecting the null hypothesis."
        else:
            return "Statistically significant result. Consider calculating effect size for practical significance."
    else:
        if sample_size < 30:
            return "No significant difference found. Small sample size may limit power to detect effects."
        else:
            return "No significant difference found. Results do not support rejecting the null hypothesis."