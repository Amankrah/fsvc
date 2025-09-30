"""
Distribution analysis and testing.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from scipy import stats
from scipy.stats import normaltest, shapiro, kstest, anderson
import warnings

def analyze_distribution(series: pd.Series) -> Dict[str, Any]:
    """
    Comprehensive distribution analysis for a numeric series.
    
    Args:
        series: Pandas Series containing numeric data
        
    Returns:
        Dictionary containing distribution characteristics
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 3:
        return {"error": "Insufficient data for distribution analysis"}
    
    # Basic distribution metrics
    distribution_info = {
        "n": len(clean_series),
        "mean": float(clean_series.mean()),
        "median": float(clean_series.median()),
        "std": float(clean_series.std()),
        "skewness": float(clean_series.skew()),
        "kurtosis": float(clean_series.kurtosis()),
        "excess_kurtosis": float(clean_series.kurtosis() - 3),
    }
    
    # Quartiles and percentiles
    distribution_info["percentiles"] = {
        "p1": float(clean_series.quantile(0.01)),
        "p5": float(clean_series.quantile(0.05)),
        "p10": float(clean_series.quantile(0.10)),
        "p25": float(clean_series.quantile(0.25)),
        "p50": float(clean_series.quantile(0.50)),
        "p75": float(clean_series.quantile(0.75)),
        "p90": float(clean_series.quantile(0.90)),
        "p95": float(clean_series.quantile(0.95)),
        "p99": float(clean_series.quantile(0.99))
    }
    
    # Distribution shape classification
    skewness = distribution_info["skewness"]
    kurtosis = distribution_info["excess_kurtosis"]
    
    if abs(skewness) < 0.5:
        skew_interpretation = "approximately symmetric"
    elif skewness < -0.5:
        skew_interpretation = "left-skewed (negative skew)"
    else:
        skew_interpretation = "right-skewed (positive skew)"
    
    if abs(kurtosis) < 0.5:
        kurt_interpretation = "mesokurtic (normal-like tails)"
    elif kurtosis < -0.5:
        kurt_interpretation = "platykurtic (thin tails)"
    else:
        kurt_interpretation = "leptokurtic (heavy tails)"
    
    distribution_info["shape_interpretation"] = {
        "skewness": skew_interpretation,
        "kurtosis": kurt_interpretation
    }
    
    return distribution_info

def test_normality(series: pd.Series, alpha: float = 0.05) -> Dict[str, Any]:
    """
    Perform multiple normality tests.
    
    Args:
        series: Pandas Series containing numeric data
        alpha: Significance level
        
    Returns:
        Dictionary containing test results
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 3:
        return {"error": "Insufficient data for normality testing"}
    
    results = {
        "sample_size": len(clean_series),
        "alpha": alpha
    }
    
    # Shapiro-Wilk test (best for small samples)
    if len(clean_series) <= 5000:
        shapiro_stat, shapiro_p = shapiro(clean_series)
        results["shapiro_wilk"] = {
            "statistic": float(shapiro_stat),
            "p_value": float(shapiro_p),
            "is_normal": shapiro_p > alpha,
            "interpretation": "Data is normally distributed" if shapiro_p > alpha else "Data is not normally distributed"
        }
    
    # D'Agostino-Pearson test (good for larger samples)
    if len(clean_series) >= 20:
        dagostino_stat, dagostino_p = normaltest(clean_series)
        results["dagostino_pearson"] = {
            "statistic": float(dagostino_stat),
            "p_value": float(dagostino_p),
            "is_normal": dagostino_p > alpha,
            "interpretation": "Data is normally distributed" if dagostino_p > alpha else "Data is not normally distributed"
        }
    
    # Kolmogorov-Smirnov test
    ks_stat, ks_p = kstest(clean_series, 'norm', args=(clean_series.mean(), clean_series.std()))
    results["kolmogorov_smirnov"] = {
        "statistic": float(ks_stat),
        "p_value": float(ks_p),
        "is_normal": ks_p > alpha,
        "interpretation": "Data is normally distributed" if ks_p > alpha else "Data is not normally distributed"
    }
    
    # Anderson-Darling test
    anderson_result = anderson(clean_series, dist='norm')
    results["anderson_darling"] = {
        "statistic": float(anderson_result.statistic),
        "critical_values": {f"{sl}%": float(cv) for sl, cv in zip(anderson_result.significance_level, anderson_result.critical_values)},
        "interpretation": "Check if statistic is less than critical values for normality"
    }
    
    # Overall assessment
    normal_count = sum([
        results.get("shapiro_wilk", {}).get("is_normal", False),
        results.get("dagostino_pearson", {}).get("is_normal", False),
        results.get("kolmogorov_smirnov", {}).get("is_normal", False)
    ])
    
    results["overall_assessment"] = {
        "is_normal": normal_count >= 2,
        "confidence": f"{normal_count}/3 tests suggest normality"
    }
    
    return results

def calculate_skewness_kurtosis(series: pd.Series) -> Dict[str, Any]:
    """
    Calculate detailed skewness and kurtosis metrics with interpretations.
    
    Args:
        series: Pandas Series containing numeric data
        
    Returns:
        Dictionary containing skewness and kurtosis analysis
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 3:
        return {"error": "Insufficient data"}
    
    # Calculate metrics
    skewness = float(clean_series.skew())
    kurtosis = float(clean_series.kurtosis())
    excess_kurtosis = kurtosis - 3
    
    # Standard errors
    n = len(clean_series)
    se_skewness = np.sqrt(6 * n * (n - 1) / ((n - 2) * (n + 1) * (n + 3)))
    se_kurtosis = 2 * se_skewness * np.sqrt((n**2 - 1) / ((n - 3) * (n + 5)))
    
    # Z-scores for testing significance
    z_skewness = skewness / se_skewness if se_skewness > 0 else 0
    z_kurtosis = excess_kurtosis / se_kurtosis if se_kurtosis > 0 else 0
    
    return {
        "skewness": {
            "value": skewness,
            "standard_error": float(se_skewness),
            "z_score": float(z_skewness),
            "is_significant": abs(z_skewness) > 1.96,
            "interpretation": _interpret_skewness(skewness)
        },
        "kurtosis": {
            "value": kurtosis,
            "excess_kurtosis": excess_kurtosis,
            "standard_error": float(se_kurtosis),
            "z_score": float(z_kurtosis),
            "is_significant": abs(z_kurtosis) > 1.96,
            "interpretation": _interpret_kurtosis(excess_kurtosis)
        }
    }

def _interpret_skewness(skewness: float) -> str:
    """Interpret skewness value."""
    if abs(skewness) < 0.5:
        return "Fairly symmetrical"
    elif abs(skewness) < 1:
        return "Moderately skewed"
    else:
        return "Highly skewed"

def _interpret_kurtosis(excess_kurtosis: float) -> str:
    """Interpret excess kurtosis value."""
    if abs(excess_kurtosis) < 1:
        return "Mesokurtic (normal-like)"
    elif excess_kurtosis < -1:
        return "Platykurtic (flat, thin tails)"
    else:
        return "Leptokurtic (peaked, heavy tails)"

def fit_distribution(series: pd.Series, 
                    distributions: List[str] = None) -> Dict[str, Any]:
    """
    Fit various distributions to the data and find the best fit.
    
    Args:
        series: Pandas Series containing numeric data
        distributions: List of distribution names to try
        
    Returns:
        Dictionary containing fit results
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 10:
        return {"error": "Insufficient data for distribution fitting"}
    
    if distributions is None:
        distributions = ['norm', 'lognorm', 'expon', 'gamma', 'beta', 'uniform']
    
    results = {}
    best_fit = None
    best_aic = np.inf
    
    for dist_name in distributions:
        try:
            # Get distribution object
            dist = getattr(stats, dist_name)
            
            # Fit distribution
            with warnings.catch_warnings():
                warnings.filterwarnings('ignore')
                params = dist.fit(clean_series)
            
            # Calculate goodness of fit
            ks_stat, ks_p = stats.kstest(clean_series, lambda x: dist.cdf(x, *params))
            
            # Calculate AIC
            log_likelihood = np.sum(dist.logpdf(clean_series, *params))
            n_params = len(params)
            aic = 2 * n_params - 2 * log_likelihood
            
            results[dist_name] = {
                "parameters": {f"param_{i}": float(p) for i, p in enumerate(params)},
                "ks_statistic": float(ks_stat),
                "ks_p_value": float(ks_p),
                "aic": float(aic),
                "log_likelihood": float(log_likelihood)
            }
            
            if aic < best_aic:
                best_aic = aic
                best_fit = dist_name
                
        except Exception as e:
            results[dist_name] = {"error": str(e)}
    
    results["best_fit"] = {
        "distribution": best_fit,
        "aic": float(best_aic)
    }
    
    return results