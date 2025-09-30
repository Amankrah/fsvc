"""
Confidence interval calculations for various statistics.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Tuple, Optional, Union
import warnings

def calculate_mean_ci(
    data: pd.Series,
    confidence: float = 0.95,
    method: str = 't'
) -> Dict[str, Any]:
    """
    Calculate confidence interval for mean.
    
    Args:
        data: Sample data
        confidence: Confidence level (0-1)
        method: 't' for t-distribution, 'z' for normal
        
    Returns:
        Dictionary with CI information
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations for confidence interval"}
    
    mean = clean_data.mean()
    se = clean_data.std() / np.sqrt(n)
    
    if method == 't':
        # Use t-distribution
        df = n - 1
        t_critical = stats.t.ppf((1 + confidence) / 2, df)
        margin_error = t_critical * se
    else:
        # Use normal distribution
        z_critical = stats.norm.ppf((1 + confidence) / 2)
        margin_error = z_critical * se
    
    return {
        "mean": float(mean),
        "standard_error": float(se),
        "margin_of_error": float(margin_error),
        "confidence_interval": {
            "lower": float(mean - margin_error),
            "upper": float(mean + margin_error)
        },
        "confidence_level": confidence,
        "method": method,
        "sample_size": n,
        "degrees_of_freedom": n - 1 if method == 't' else None
    }

def calculate_proportion_ci(
    successes: int,
    n: int,
    confidence: float = 0.95,
    method: str = 'wilson'
) -> Dict[str, Any]:
    """
    Calculate confidence interval for proportion.
    
    Args:
        successes: Number of successes
        n: Total number of trials
        confidence: Confidence level
        method: 'wilson', 'wald', or 'exact'
        
    Returns:
        Dictionary with CI information
    """
    if n == 0:
        return {"error": "Sample size cannot be zero"}
    
    p = successes / n
    
    if method == 'wilson':
        # Wilson score interval (recommended)
        z = stats.norm.ppf((1 + confidence) / 2)
        denominator = 1 + z**2 / n
        center = (p + z**2 / (2 * n)) / denominator
        width = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denominator
        
        lower = max(0, center - width)
        upper = min(1, center + width)
        
    elif method == 'wald':
        # Wald interval (simple but not recommended for small n)
        z = stats.norm.ppf((1 + confidence) / 2)
        se = np.sqrt(p * (1 - p) / n)
        margin = z * se
        
        lower = max(0, p - margin)
        upper = min(1, p + margin)
        
    elif method == 'exact':
        # Clopper-Pearson exact interval
        alpha = 1 - confidence
        if successes == 0:
            lower = 0
            upper = 1 - (alpha/2)**(1/n)
        elif successes == n:
            lower = (alpha/2)**(1/n)
            upper = 1
        else:
            lower = stats.beta.ppf(alpha/2, successes, n - successes + 1)
            upper = stats.beta.ppf(1 - alpha/2, successes + 1, n - successes)
    else:
        return {"error": f"Unknown method: {method}"}
    
    return {
        "proportion": float(p),
        "successes": successes,
        "sample_size": n,
        "confidence_interval": {
            "lower": float(lower),
            "upper": float(upper)
        },
        "confidence_level": confidence,
        "method": method,
        "standard_error": float(np.sqrt(p * (1 - p) / n))
    }

def calculate_difference_ci(
    data1: pd.Series,
    data2: pd.Series,
    confidence: float = 0.95,
    paired: bool = False
) -> Dict[str, Any]:
    """
    Calculate confidence interval for difference between means.
    
    Args:
        data1: First sample
        data2: Second sample
        confidence: Confidence level
        paired: Whether samples are paired
        
    Returns:
        Dictionary with CI for difference
    """
    if paired:
        # Paired samples
        paired_data = pd.DataFrame({'data1': data1, 'data2': data2}).dropna()
        differences = paired_data['data1'] - paired_data['data2']
        
        n = len(differences)
        mean_diff = differences.mean()
        se_diff = differences.std() / np.sqrt(n)
        df = n - 1
        
    else:
        # Independent samples
        clean_data1 = data1.dropna()
        clean_data2 = data2.dropna()
        
        n1, n2 = len(clean_data1), len(clean_data2)
        mean1, mean2 = clean_data1.mean(), clean_data2.mean()
        var1, var2 = clean_data1.var(), clean_data2.var()
        
        mean_diff = mean1 - mean2
        
        # Pooled standard error
        se_diff = np.sqrt(var1/n1 + var2/n2)
        
        # Degrees of freedom (Welch's approximation)
        df = (var1/n1 + var2/n2)**2 / ((var1/n1)**2/(n1-1) + (var2/n2)**2/(n2-1))
    
    # Calculate confidence interval
    t_critical = stats.t.ppf((1 + confidence) / 2, df)
    margin_error = t_critical * se_diff
    
    return {
        "mean_difference": float(mean_diff),
        "standard_error": float(se_diff),
        "confidence_interval": {
            "lower": float(mean_diff - margin_error),
            "upper": float(mean_diff + margin_error)
        },
        "confidence_level": confidence,
        "degrees_of_freedom": float(df),
        "paired": paired
    }

def calculate_correlation_ci(
    r: float,
    n: int,
    confidence: float = 0.95,
    method: str = 'pearson'
) -> Dict[str, Any]:
    """
    Calculate confidence interval for correlation coefficient.
    
    Args:
        r: Correlation coefficient
        n: Sample size
        confidence: Confidence level
        method: Type of correlation
        
    Returns:
        Dictionary with CI for correlation
    """
    if method == 'pearson':
        # Fisher's z transformation
        z = 0.5 * np.log((1 + r) / (1 - r))
        se_z = 1 / np.sqrt(n - 3)
        
        z_critical = stats.norm.ppf((1 + confidence) / 2)
        z_lower = z - z_critical * se_z
        z_upper = z + z_critical * se_z
        
        # Transform back
        lower = (np.exp(2 * z_lower) - 1) / (np.exp(2 * z_lower) + 1)
        upper = (np.exp(2 * z_upper) - 1) / (np.exp(2 * z_upper) + 1)
        
    else:
        # Bootstrap would be more appropriate for Spearman/Kendall
        # Using approximation here
        se = np.sqrt((1 - r**2) / (n - 2))
        t_critical = stats.t.ppf((1 + confidence) / 2, n - 2)
        margin = t_critical * se
        
        lower = max(-1, r - margin)
        upper = min(1, r + margin)
    
    return {
        "correlation": float(r),
        "confidence_interval": {
            "lower": float(lower),
            "upper": float(upper)
        },
        "confidence_level": confidence,
        "sample_size": n,
        "method": method
    }

def calculate_median_ci(
    data: pd.Series,
    confidence: float = 0.95,
    method: str = 'exact'
) -> Dict[str, Any]:
    """
    Calculate confidence interval for median.
    
    Args:
        data: Sample data
        confidence: Confidence level
        method: 'exact' or 'bootstrap'
        
    Returns:
        Dictionary with CI for median
    """
    clean_data = data.dropna().sort_values()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    median = clean_data.median()
    
    if method == 'exact':
        # Using binomial for exact CI
        alpha = 1 - confidence
        
        # Find ranks for CI
        k = stats.binom.ppf(alpha/2, n, 0.5)
        lower_idx = int(k) - 1
        upper_idx = n - lower_idx - 1
        
        if lower_idx < 0:
            lower_idx = 0
        if upper_idx >= n:
            upper_idx = n - 1
        
        lower = clean_data.iloc[lower_idx]
        upper = clean_data.iloc[upper_idx]
        
    else:
        # Bootstrap method
        from .bootstrap_methods import bootstrap_median
        result = bootstrap_median(clean_data, confidence=confidence)
        lower = result['confidence_interval']['lower']
        upper = result['confidence_interval']['upper']
    
    return {
        "median": float(median),
        "confidence_interval": {
            "lower": float(lower),
            "upper": float(upper)
        },
        "confidence_level": confidence,
        "sample_size": n,
        "method": method
    }

def calculate_bootstrap_ci(
    data: pd.Series,
    statistic_func: callable,
    confidence: float = 0.95,
    n_bootstrap: int = 10000,
    method: str = 'percentile'
) -> Dict[str, Any]:
    """
    Calculate bootstrap confidence interval for any statistic.
    
    Args:
        data: Sample data
        statistic_func: Function to calculate statistic
        confidence: Confidence level
        n_bootstrap: Number of bootstrap samples
        method: 'percentile', 'bca', or 'basic'
        
    Returns:
        Dictionary with bootstrap CI
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    # Original statistic
    original_stat = statistic_func(clean_data)
    
    # Bootstrap
    bootstrap_stats = []
    for _ in range(n_bootstrap):
        sample = clean_data.sample(n=n, replace=True)
        bootstrap_stats.append(statistic_func(sample))
    
    bootstrap_stats = np.array(bootstrap_stats)
    
    # Calculate CI based on method
    alpha = 1 - confidence
    
    if method == 'percentile':
        lower = np.percentile(bootstrap_stats, 100 * alpha/2)
        upper = np.percentile(bootstrap_stats, 100 * (1 - alpha/2))
        
    elif method == 'basic':
        lower = 2 * original_stat - np.percentile(bootstrap_stats, 100 * (1 - alpha/2))
        upper = 2 * original_stat - np.percentile(bootstrap_stats, 100 * alpha/2)
        
    elif method == 'bca':
        # BCa method (bias-corrected and accelerated)
        # Calculate bias correction
        z0 = stats.norm.ppf(np.mean(bootstrap_stats < original_stat))
        
        # Calculate acceleration
        jackknife_stats = []
        for i in range(n):
            jack_sample = clean_data.drop(clean_data.index[i])
            jackknife_stats.append(statistic_func(jack_sample))
        
        jackknife_mean = np.mean(jackknife_stats)
        acc_num = np.sum((jackknife_mean - jackknife_stats)**3)
        acc_den = 6 * (np.sum((jackknife_mean - jackknife_stats)**2))**1.5
        acc = acc_num / acc_den if acc_den != 0 else 0
        
        # Adjusted percentiles
        z_alpha_2 = stats.norm.ppf(alpha/2)
        z_1_alpha_2 = stats.norm.ppf(1 - alpha/2)
        
        p_lower = stats.norm.cdf(z0 + (z0 + z_alpha_2) / (1 - acc * (z0 + z_alpha_2)))
        p_upper = stats.norm.cdf(z0 + (z0 + z_1_alpha_2) / (1 - acc * (z0 + z_1_alpha_2)))
        
        lower = np.percentile(bootstrap_stats, 100 * p_lower)
        upper = np.percentile(bootstrap_stats, 100 * p_upper)
    
    else:
        return {"error": f"Unknown method: {method}"}
    
    return {
        "statistic": float(original_stat),
        "confidence_interval": {
            "lower": float(lower),
            "upper": float(upper)
        },
        "confidence_level": confidence,
        "n_bootstrap": n_bootstrap,
        "method": method,
        "bootstrap_mean": float(np.mean(bootstrap_stats)),
        "bootstrap_std": float(np.std(bootstrap_stats))
    }

def calculate_prediction_interval(
    model_predictions: pd.Series,
    residuals: pd.Series,
    new_x: Optional[pd.DataFrame] = None,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Calculate prediction interval for regression.
    
    Args:
        model_predictions: Model predictions
        residuals: Model residuals
        new_x: New data points (optional)
        confidence: Confidence level
        
    Returns:
        Dictionary with prediction intervals
    """
    n = len(residuals)
    
    if n < 3:
        return {"error": "Need at least 3 observations"}
    
    # Calculate standard error of residuals
    mse = np.mean(residuals**2)
    se_resid = np.sqrt(mse)
    
    # Degrees of freedom
    df = n - 2  # Simple case, adjust for multiple regression
    
    # Critical value
    t_critical = stats.t.ppf((1 + confidence) / 2, df)
    
    # Prediction intervals
    if new_x is None:
        # For existing predictions
        margin = t_critical * se_resid * np.sqrt(1 + 1/n)
        
        return {
            "predictions": model_predictions.tolist(),
            "prediction_intervals": {
                "lower": (model_predictions - margin).tolist(),
                "upper": (model_predictions + margin).tolist()
            },
            "confidence_level": confidence,
            "standard_error": float(se_resid),
            "degrees_of_freedom": df
        }
    else:
        # For new predictions (would need full model info)
        return {"error": "New predictions require full model information"}

def calculate_odds_ratio_ci(
    table: pd.DataFrame,
    confidence: float = 0.95,
    method: str = 'woolf'
) -> Dict[str, Any]:
    """
    Calculate confidence interval for odds ratio.
    
    Args:
        table: 2x2 contingency table
        confidence: Confidence level
        method: 'woolf' or 'exact'
        
    Returns:
        Dictionary with OR confidence interval
    """
    if table.shape != (2, 2):
        return {"error": "Requires 2x2 table"}
    
    a, b = table.iloc[0, 0], table.iloc[0, 1]
    c, d = table.iloc[1, 0], table.iloc[1, 1]
    
    # Handle zeros
    if a == 0 or b == 0 or c == 0 or d == 0:
        # Add 0.5 to all cells
        a, b, c, d = a + 0.5, b + 0.5, c + 0.5, d + 0.5
    
    # Calculate OR
    or_value = (a * d) / (b * c)
    
    if method == 'woolf':
        # Woolf's method (log transformation)
        log_or = np.log(or_value)
        se_log_or = np.sqrt(1/a + 1/b + 1/c + 1/d)
        
        z_critical = stats.norm.ppf((1 + confidence) / 2)
        log_lower = log_or - z_critical * se_log_or
        log_upper = log_or + z_critical * se_log_or
        
        lower = np.exp(log_lower)
        upper = np.exp(log_upper)
    
    else:
        return {"error": f"Unknown method: {method}"}
    
    return {
        "odds_ratio": float(or_value),
        "confidence_interval": {
            "lower": float(lower),
            "upper": float(upper)
        },
        "confidence_level": confidence,
        "method": method,
        "log_odds_ratio": float(np.log(or_value)),
        "standard_error_log_or": float(se_log_or) if method == 'woolf' else None
    }