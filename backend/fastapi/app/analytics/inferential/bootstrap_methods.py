"""
Bootstrap and resampling methods for inference.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List, Optional, Union, Callable, Tuple
import warnings

def bootstrap_mean(
    data: pd.Series,
    n_bootstrap: int = 10000,
    confidence: float = 0.95,
    method: str = 'percentile'
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for mean.
    
    Args:
        data: Sample data
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        method: 'percentile', 'bca', or 'basic'
        
    Returns:
        Dictionary with bootstrap results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    # Original statistic
    original_mean = clean_data.mean()
    
    # Bootstrap
    bootstrap_means = []
    for _ in range(n_bootstrap):
        sample = clean_data.sample(n=n, replace=True)
        bootstrap_means.append(sample.mean())
    
    bootstrap_means = np.array(bootstrap_means)
    
    # Calculate confidence interval
    result = _calculate_bootstrap_ci(
        original_mean,
        bootstrap_means,
        confidence,
        method,
        clean_data
    )
    
    result.update({
        "statistic": "mean",
        "n_observations": n,
        "n_bootstrap": n_bootstrap,
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_means)),
            "std": float(np.std(bootstrap_means)),
            "bias": float(np.mean(bootstrap_means) - original_mean)
        }
    })
    
    return result

def bootstrap_median(
    data: pd.Series,
    n_bootstrap: int = 10000,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for median.
    
    Args:
        data: Sample data
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        
    Returns:
        Dictionary with bootstrap results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    # Original statistic
    original_median = clean_data.median()
    
    # Bootstrap
    bootstrap_medians = []
    for _ in range(n_bootstrap):
        sample = clean_data.sample(n=n, replace=True)
        bootstrap_medians.append(sample.median())
    
    bootstrap_medians = np.array(bootstrap_medians)
    
    # Confidence interval (percentile method)
    alpha = 1 - confidence
    ci_lower = np.percentile(bootstrap_medians, 100 * alpha/2)
    ci_upper = np.percentile(bootstrap_medians, 100 * (1 - alpha/2))
    
    return {
        "statistic": "median",
        "observed_value": float(original_median),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": confidence
        },
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_medians)),
            "std": float(np.std(bootstrap_medians))
        },
        "n_observations": n,
        "n_bootstrap": n_bootstrap
    }

def bootstrap_correlation(
    data: pd.DataFrame,
    var1: str,
    var2: str,
    n_bootstrap: int = 10000,
    confidence: float = 0.95,
    method: str = 'pearson'
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for correlation.
    
    Args:
        data: DataFrame with two variables
        var1: First variable name
        var2: Second variable name
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        method: Correlation method
        
    Returns:
        Dictionary with bootstrap results
    """
    # Clean data
    clean_data = data[[var1, var2]].dropna()
    n = len(clean_data)
    
    if n < 3:
        return {"error": "Need at least 3 observations"}
    
    # Original correlation
    if method == 'pearson':
        original_corr = clean_data[var1].corr(clean_data[var2])
    elif method == 'spearman':
        original_corr = clean_data[var1].corr(clean_data[var2], method='spearman')
    else:
        return {"error": f"Unknown correlation method: {method}"}
    
    # Bootstrap
    bootstrap_corrs = []
    for _ in range(n_bootstrap):
        indices = np.random.choice(n, n, replace=True)
        sample = clean_data.iloc[indices]
        
        if method == 'pearson':
            corr = sample[var1].corr(sample[var2])
        else:
            corr = sample[var1].corr(sample[var2], method=method)
        
        bootstrap_corrs.append(corr)
    
    bootstrap_corrs = np.array(bootstrap_corrs)
    
    # Remove NaN values
    bootstrap_corrs = bootstrap_corrs[~np.isnan(bootstrap_corrs)]
    
    # BCa confidence interval
    result = _calculate_bootstrap_ci(
        original_corr,
        bootstrap_corrs,
        confidence,
        'bca',
        clean_data
    )
    
    result.update({
        "statistic": f"{method} correlation",
        "variables": [var1, var2],
        "n_observations": n,
        "n_bootstrap": n_bootstrap,
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_corrs)),
            "std": float(np.std(bootstrap_corrs))
        }
    })
    
    return result

def bootstrap_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    n_bootstrap: int = 1000,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Bootstrap confidence intervals for regression coefficients.
    
    Args:
        data: DataFrame with variables
        dependent_var: Dependent variable name
        independent_vars: List of independent variable names
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        
    Returns:
        Dictionary with bootstrap regression results
    """
    from sklearn.linear_model import LinearRegression
    
    # Clean data
    all_vars = [dependent_var] + independent_vars
    clean_data = data[all_vars].dropna()
    n = len(clean_data)
    
    if n < len(independent_vars) + 2:
        return {"error": "Insufficient observations for regression"}
    
    X = clean_data[independent_vars].values
    y = clean_data[dependent_var].values
    
    # Fit original model
    model = LinearRegression()
    model.fit(X, y)
    original_coefs = model.coef_
    original_intercept = model.intercept_
    
    # Bootstrap
    bootstrap_coefs = []
    bootstrap_intercepts = []
    
    for _ in range(n_bootstrap):
        indices = np.random.choice(n, n, replace=True)
        X_boot = X[indices]
        y_boot = y[indices]
        
        model_boot = LinearRegression()
        model_boot.fit(X_boot, y_boot)
        
        bootstrap_coefs.append(model_boot.coef_)
        bootstrap_intercepts.append(model_boot.intercept_)
    
    bootstrap_coefs = np.array(bootstrap_coefs)
    bootstrap_intercepts = np.array(bootstrap_intercepts)
    
    # Calculate confidence intervals
    alpha = 1 - confidence
    
    results = {
        "regression_type": "linear",
        "n_observations": n,
        "n_bootstrap": n_bootstrap,
        "coefficients": {}
    }
    
    # Intercept
    results["coefficients"]["intercept"] = {
        "estimate": float(original_intercept),
        "confidence_interval": {
            "lower": float(np.percentile(bootstrap_intercepts, 100 * alpha/2)),
            "upper": float(np.percentile(bootstrap_intercepts, 100 * (1 - alpha/2)))
        },
        "std_error": float(np.std(bootstrap_intercepts))
    }
    
    # Coefficients
    for i, var in enumerate(independent_vars):
        results["coefficients"][var] = {
            "estimate": float(original_coefs[i]),
            "confidence_interval": {
                "lower": float(np.percentile(bootstrap_coefs[:, i], 100 * alpha/2)),
                "upper": float(np.percentile(bootstrap_coefs[:, i], 100 * (1 - alpha/2)))
            },
            "std_error": float(np.std(bootstrap_coefs[:, i])),
            "significant": not (np.percentile(bootstrap_coefs[:, i], 100 * alpha/2) <= 0 <= 
                              np.percentile(bootstrap_coefs[:, i], 100 * (1 - alpha/2)))
        }
    
    return results

def bootstrap_std(
    data: pd.Series,
    n_bootstrap: int = 10000,
    confidence: float = 0.95,
    method: str = 'percentile'
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for standard deviation.
    
    Args:
        data: Sample data
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        method: 'percentile', 'bca', or 'basic'
        
    Returns:
        Dictionary with bootstrap results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    # Original statistic
    original_std = clean_data.std()
    
    # Bootstrap
    bootstrap_stds = []
    for _ in range(n_bootstrap):
        sample = clean_data.sample(n=n, replace=True)
        bootstrap_stds.append(sample.std())
    
    bootstrap_stds = np.array(bootstrap_stds)
    
    # Calculate confidence interval
    result = _calculate_bootstrap_ci(
        original_std,
        bootstrap_stds,
        confidence,
        method,
        clean_data
    )
    
    result.update({
        "statistic": "standard_deviation",
        "n_observations": n,
        "n_bootstrap": n_bootstrap,
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_stds)),
            "std": float(np.std(bootstrap_stds)),
            "bias": float(np.mean(bootstrap_stds) - original_std)
        }
    })
    
    return result

def bootstrap_quantile(
    data: pd.Series,
    quantile: float = 0.5,
    n_bootstrap: int = 10000,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for quantile.
    
    Args:
        data: Sample data
        quantile: Quantile to estimate (0 to 1)
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        
    Returns:
        Dictionary with bootstrap results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    if not 0 < quantile < 1:
        return {"error": "Quantile must be between 0 and 1"}
    
    # Original statistic
    original_quantile = clean_data.quantile(quantile)
    
    # Bootstrap
    bootstrap_quantiles = []
    for _ in range(n_bootstrap):
        sample = clean_data.sample(n=n, replace=True)
        bootstrap_quantiles.append(sample.quantile(quantile))
    
    bootstrap_quantiles = np.array(bootstrap_quantiles)
    
    # Confidence interval (percentile method)
    alpha = 1 - confidence
    ci_lower = np.percentile(bootstrap_quantiles, 100 * alpha/2)
    ci_upper = np.percentile(bootstrap_quantiles, 100 * (1 - alpha/2))
    
    return {
        "statistic": f"{quantile:.2f} quantile",
        "observed_value": float(original_quantile),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": confidence
        },
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_quantiles)),
            "std": float(np.std(bootstrap_quantiles))
        },
        "n_observations": n,
        "n_bootstrap": n_bootstrap
    }

def bootstrap_difference_means(
    data1: pd.Series,
    data2: pd.Series,
    n_bootstrap: int = 10000,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for difference between two means.
    
    Args:
        data1: First sample
        data2: Second sample
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        
    Returns:
        Dictionary with bootstrap results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    n1, n2 = len(data1_clean), len(data2_clean)
    
    if n1 < 2 or n2 < 2:
        return {"error": "Need at least 2 observations per group"}
    
    # Original difference
    original_diff = data1_clean.mean() - data2_clean.mean()
    
    # Bootstrap
    bootstrap_diffs = []
    for _ in range(n_bootstrap):
        sample1 = data1_clean.sample(n=n1, replace=True)
        sample2 = data2_clean.sample(n=n2, replace=True)
        bootstrap_diffs.append(sample1.mean() - sample2.mean())
    
    bootstrap_diffs = np.array(bootstrap_diffs)
    
    # Confidence interval (percentile method)
    alpha = 1 - confidence
    ci_lower = np.percentile(bootstrap_diffs, 100 * alpha/2)
    ci_upper = np.percentile(bootstrap_diffs, 100 * (1 - alpha/2))
    
    # Effect size (Cohen's d)
    pooled_std = np.sqrt(((n1-1)*data1_clean.var() + (n2-1)*data2_clean.var()) / (n1+n2-2))
    effect_size = original_diff / pooled_std if pooled_std > 0 else 0
    
    return {
        "statistic": "difference_of_means",
        "observed_value": float(original_diff),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": confidence
        },
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_diffs)),
            "std": float(np.std(bootstrap_diffs)),
            "bias": float(np.mean(bootstrap_diffs) - original_diff)
        },
        "effect_size": float(effect_size),
        "sample_sizes": {"n1": n1, "n2": n2},
        "n_bootstrap": n_bootstrap,
        "interpretation": "Significant difference" if ci_lower > 0 or ci_upper < 0 else "No significant difference"
    }

def bootstrap_ratio_means(
    data1: pd.Series,
    data2: pd.Series,
    n_bootstrap: int = 10000,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Bootstrap confidence interval for ratio of two means.
    
    Args:
        data1: Numerator sample
        data2: Denominator sample
        n_bootstrap: Number of bootstrap samples
        confidence: Confidence level
        
    Returns:
        Dictionary with bootstrap results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    n1, n2 = len(data1_clean), len(data2_clean)
    
    if n1 < 2 or n2 < 2:
        return {"error": "Need at least 2 observations per group"}
    
    # Check for zero denominator
    if data2_clean.mean() == 0:
        return {"error": "Denominator mean is zero"}
    
    # Original ratio
    original_ratio = data1_clean.mean() / data2_clean.mean()
    
    # Bootstrap
    bootstrap_ratios = []
    for _ in range(n_bootstrap):
        sample1 = data1_clean.sample(n=n1, replace=True)
        sample2 = data2_clean.sample(n=n2, replace=True)
        
        mean2 = sample2.mean()
        if mean2 != 0:  # Avoid division by zero
            bootstrap_ratios.append(sample1.mean() / mean2)
    
    bootstrap_ratios = np.array(bootstrap_ratios)
    
    # Remove extreme outliers (likely due to near-zero denominators)
    q1, q99 = np.percentile(bootstrap_ratios, [1, 99])
    bootstrap_ratios = bootstrap_ratios[(bootstrap_ratios >= q1) & (bootstrap_ratios <= q99)]
    
    # Confidence interval (percentile method)
    alpha = 1 - confidence
    ci_lower = np.percentile(bootstrap_ratios, 100 * alpha/2)
    ci_upper = np.percentile(bootstrap_ratios, 100 * (1 - alpha/2))
    
    return {
        "statistic": "ratio_of_means",
        "observed_value": float(original_ratio),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": confidence
        },
        "bootstrap_distribution": {
            "mean": float(np.mean(bootstrap_ratios)),
            "std": float(np.std(bootstrap_ratios)),
            "bias": float(np.mean(bootstrap_ratios) - original_ratio)
        },
        "sample_sizes": {"n1": n1, "n2": n2},
        "n_bootstrap": len(bootstrap_ratios),
        "original_n_bootstrap": n_bootstrap,
        "interpretation": "Significant difference from 1" if ci_lower > 1 or ci_upper < 1 else "Not significantly different from 1"
    }

def permutation_test(
    data1: pd.Series,
    data2: pd.Series,
    statistic: str = 'mean_diff',
    n_permutations: int = 10000,
    alternative: str = 'two-sided'
) -> Dict[str, Any]:
    """
    Permutation test for two samples.
    
    Args:
        data1: First sample
        data2: Second sample
        statistic: Test statistic ('mean_diff', 'median_diff', 't')
        n_permutations: Number of permutations
        alternative: Alternative hypothesis
        
    Returns:
        Dictionary with permutation test results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    n1, n2 = len(data1_clean), len(data2_clean)
    
    if n1 < 2 or n2 < 2:
        return {"error": "Need at least 2 observations per group"}
    
    # Calculate observed statistic
    if statistic == 'mean_diff':
        observed_stat = data1_clean.mean() - data2_clean.mean()
        stat_func = lambda x, y: x.mean() - y.mean()
    elif statistic == 'median_diff':
        observed_stat = data1_clean.median() - data2_clean.median()
        stat_func = lambda x, y: x.median() - y.median()
    elif statistic == 't':
        observed_stat = stats.ttest_ind(data1_clean, data2_clean)[0]
        stat_func = lambda x, y: stats.ttest_ind(x, y)[0]
    else:
        return {"error": f"Unknown statistic: {statistic}"}
    
    # Combine data
    combined = np.concatenate([data1_clean, data2_clean])
    
    # Permutation test
    permuted_stats = []
    for _ in range(n_permutations):
        np.random.shuffle(combined)
        perm_data1 = combined[:n1]
        perm_data2 = combined[n1:]
        
        perm_stat = stat_func(pd.Series(perm_data1), pd.Series(perm_data2))
        permuted_stats.append(perm_stat)
    
    permuted_stats = np.array(permuted_stats)
    
    # Calculate p-value
    if alternative == 'two-sided':
        p_value = np.mean(np.abs(permuted_stats) >= np.abs(observed_stat))
    elif alternative == 'greater':
        p_value = np.mean(permuted_stats >= observed_stat)
    elif alternative == 'less':
        p_value = np.mean(permuted_stats <= observed_stat)
    else:
        return {"error": f"Unknown alternative: {alternative}"}
    
    # Effect size
    pooled_std = np.sqrt(((n1-1)*data1_clean.var() + (n2-1)*data2_clean.var()) / (n1+n2-2))
    effect_size = (data1_clean.mean() - data2_clean.mean()) / pooled_std if pooled_std > 0 else 0
    
    return {
        "test_type": "Permutation test",
        "statistic": statistic,
        "observed_value": float(observed_stat),
        "p_value": float(p_value),
        "alternative": alternative,
        "n_permutations": n_permutations,
        "permutation_distribution": {
            "mean": float(np.mean(permuted_stats)),
            "std": float(np.std(permuted_stats)),
            "percentile_95": float(np.percentile(np.abs(permuted_stats), 95))
        },
        "effect_size": float(effect_size),
        "sample_sizes": {"n1": n1, "n2": n2},
        "interpretation": "Significant difference" if p_value < 0.05 else "No significant difference"
    }

def jackknife_estimate(
    data: pd.Series,
    statistic_func: Callable,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Jackknife estimation for bias and variance.
    
    Args:
        data: Sample data
        statistic_func: Function to calculate statistic
        confidence: Confidence level
        
    Returns:
        Dictionary with jackknife results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    # Original statistic
    original_stat = statistic_func(clean_data)
    
    # Jackknife samples
    jackknife_stats = []
    for i in range(n):
        jack_sample = clean_data.drop(clean_data.index[i])
        jack_stat = statistic_func(jack_sample)
        jackknife_stats.append(jack_stat)
    
    jackknife_stats = np.array(jackknife_stats)
    
    # Jackknife estimates
    jack_mean = np.mean(jackknife_stats)
    
    # Bias estimate
    bias = (n - 1) * (jack_mean - original_stat)
    
    # Variance estimate
    jack_var = ((n - 1) / n) * np.sum((jackknife_stats - jack_mean) ** 2)
    jack_se = np.sqrt(jack_var)
    
    # Bias-corrected estimate
    corrected_estimate = original_stat - bias
    
    # Confidence interval (normal approximation)
    alpha = 1 - confidence
    z = stats.norm.ppf(1 - alpha/2)
    ci_lower = corrected_estimate - z * jack_se
    ci_upper = corrected_estimate + z * jack_se
    
    return {
        "method": "Jackknife",
        "original_estimate": float(original_stat),
        "bias": float(bias),
        "bias_corrected_estimate": float(corrected_estimate),
        "standard_error": float(jack_se),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": confidence
        },
        "n_observations": n,
        "jackknife_values": {
            "mean": float(jack_mean),
            "std": float(np.std(jackknife_stats))
        }
    }

def bootstrap_hypothesis_test(
    data1: pd.Series,
    data2: pd.Series,
    null_hypothesis: str = 'equal_means',
    n_bootstrap: int = 10000,
    alternative: str = 'two-sided'
) -> Dict[str, Any]:
    """
    Bootstrap hypothesis test for two samples.
    
    Args:
        data1: First sample
        data2: Second sample
        null_hypothesis: Type of null hypothesis
        n_bootstrap: Number of bootstrap samples
        alternative: Alternative hypothesis
        
    Returns:
        Dictionary with bootstrap test results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    n1, n2 = len(data1_clean), len(data2_clean)
    
    if n1 < 2 or n2 < 2:
        return {"error": "Need at least 2 observations per group"}
    
    if null_hypothesis == 'equal_means':
        # Test difference in means
        observed_diff = data1_clean.mean() - data2_clean.mean()
        
        # Bootstrap under null (shift data to have equal means)
        pooled_mean = (data1_clean.sum() + data2_clean.sum()) / (n1 + n2)
        data1_null = data1_clean - data1_clean.mean() + pooled_mean
        data2_null = data2_clean - data2_clean.mean() + pooled_mean
        
        # Bootstrap distribution under null
        bootstrap_diffs = []
        for _ in range(n_bootstrap):
            boot1 = data1_null.sample(n=n1, replace=True)
            boot2 = data2_null.sample(n=n2, replace=True)
            bootstrap_diffs.append(boot1.mean() - boot2.mean())
        
        bootstrap_diffs = np.array(bootstrap_diffs)
        
    else:
        return {"error": f"Unknown null hypothesis: {null_hypothesis}"}
    
    # Calculate p-value
    if alternative == 'two-sided':
        p_value = np.mean(np.abs(bootstrap_diffs) >= np.abs(observed_diff))
    elif alternative == 'greater':
        p_value = np.mean(bootstrap_diffs >= observed_diff)
    elif alternative == 'less':
        p_value = np.mean(bootstrap_diffs <= observed_diff)
    else:
        return {"error": f"Unknown alternative: {alternative}"}
    
    # Bootstrap confidence interval for difference
    bootstrap_actual_diffs = []
    for _ in range(n_bootstrap):
        boot1 = data1_clean.sample(n=n1, replace=True)
        boot2 = data2_clean.sample(n=n2, replace=True)
        bootstrap_actual_diffs.append(boot1.mean() - boot2.mean())
    
    bootstrap_actual_diffs = np.array(bootstrap_actual_diffs)
    ci_lower = np.percentile(bootstrap_actual_diffs, 2.5)
    ci_upper = np.percentile(bootstrap_actual_diffs, 97.5)
    
    return {
        "test_type": "Bootstrap hypothesis test",
        "null_hypothesis": null_hypothesis,
        "alternative": alternative,
        "observed_difference": float(observed_diff),
        "p_value": float(p_value),
        "significant": p_value < 0.05,
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": 0.95
        },
        "bootstrap_null_distribution": {
            "mean": float(np.mean(bootstrap_diffs)),
            "std": float(np.std(bootstrap_diffs))
        },
        "n_bootstrap": n_bootstrap,
        "sample_sizes": {"n1": n1, "n2": n2}
    }

# Helper functions

def _calculate_bootstrap_ci(
    original_stat: float,
    bootstrap_stats: np.ndarray,
    confidence: float,
    method: str,
    original_data: pd.Series
) -> Dict[str, Any]:
    """Calculate bootstrap confidence interval."""
    alpha = 1 - confidence
    
    if method == 'percentile':
        ci_lower = np.percentile(bootstrap_stats, 100 * alpha/2)
        ci_upper = np.percentile(bootstrap_stats, 100 * (1 - alpha/2))
        
    elif method == 'basic':
        ci_lower = 2 * original_stat - np.percentile(bootstrap_stats, 100 * (1 - alpha/2))
        ci_upper = 2 * original_stat - np.percentile(bootstrap_stats, 100 * alpha/2)
        
    elif method == 'bca':
        # Bias-corrected and accelerated
        # Calculate bias correction
        z0 = stats.norm.ppf(np.mean(bootstrap_stats < original_stat))
        
        # Calculate acceleration using jackknife
        n = len(original_data)
        jackknife_stats = []
        
        # Determine statistic type based on original data structure
        if hasattr(original_data, 'name') and len(original_data.shape) == 1:
            # For simple Series (mean, median, etc.)
            for i in range(n):
                jack_data = original_data.drop(original_data.index[i])
                jack_stat = jack_data.mean()  # Default to mean for univariate case
                jackknife_stats.append(jack_stat)
            
            # Calculate acceleration parameter
            jackknife_mean = np.mean(jackknife_stats)
            acc_num = np.sum((jackknife_mean - jackknife_stats)**3)
            acc_den = 6 * (np.sum((jackknife_mean - jackknife_stats)**2))**1.5
            acc = acc_num / acc_den if acc_den != 0 else 0
        else:
            # For more complex cases (like correlation), use simplified acceleration
            acc = 0
        
        # Adjusted percentiles
        z_alpha_2 = stats.norm.ppf(alpha/2)
        z_1_alpha_2 = stats.norm.ppf(1 - alpha/2)
        
        # Calculate adjusted percentiles with safety checks
        try:
            denom_lower = 1 - acc * (z0 + z_alpha_2)
            denom_upper = 1 - acc * (z0 + z_1_alpha_2)
            
            if abs(denom_lower) < 1e-10 or abs(denom_upper) < 1e-10:
                # Fall back to percentile method if acceleration is too extreme
                ci_lower = np.percentile(bootstrap_stats, 100 * alpha/2)
                ci_upper = np.percentile(bootstrap_stats, 100 * (1 - alpha/2))
            else:
                p_lower = stats.norm.cdf(z0 + (z0 + z_alpha_2) / denom_lower)
                p_upper = stats.norm.cdf(z0 + (z0 + z_1_alpha_2) / denom_upper)
                
                # Ensure valid percentile values
                p_lower = max(0.001, min(0.999, p_lower))
                p_upper = max(0.001, min(0.999, p_upper))
                
                # Get confidence interval bounds
                ci_lower = np.percentile(bootstrap_stats, 100 * p_lower)
                ci_upper = np.percentile(bootstrap_stats, 100 * p_upper)
                
        except (ValueError, RuntimeWarning):
            # Fall back to percentile method if BCa fails
            ci_lower = np.percentile(bootstrap_stats, 100 * alpha/2)
            ci_upper = np.percentile(bootstrap_stats, 100 * (1 - alpha/2))
    
    else:
        return {"error": f"Unknown method: {method}"}
    
    return {
        "observed_value": float(original_stat),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "confidence": confidence,
            "method": method
        }
    }