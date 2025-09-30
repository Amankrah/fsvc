"""
Utility functions for inferential statistics.

Common functions used across inferential statistics modules for data validation,
assumption testing, result formatting, and statistical calculations.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List, Tuple, Optional, Union, Callable
import warnings
from enum import Enum


class EffectSizeInterpretation(Enum):
    """Standard interpretations for effect sizes."""
    NEGLIGIBLE = "negligible"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    VERY_LARGE = "very large"


# ============================================================================
# DATA VALIDATION AND CLEANING
# ============================================================================

def validate_series_data(
    data: pd.Series,
    min_observations: int = 2,
    name: str = "data"
) -> Dict[str, Any]:
    """
    Validate and clean series data for statistical analysis.
    
    Args:
        data: Input series
        min_observations: Minimum required observations
        name: Name for error messages
        
    Returns:
        Dictionary with validation results and cleaned data
    """
    if not isinstance(data, pd.Series):
        return {
            "valid": False,
            "error": f"{name} must be a pandas Series",
            "clean_data": None
        }
    
    # Clean data
    clean_data = data.dropna()
    n_original = len(data)
    n_clean = len(clean_data)
    n_missing = n_original - n_clean
    
    if n_clean < min_observations:
        return {
            "valid": False,
            "error": f"{name} needs at least {min_observations} observations (got {n_clean})",
            "clean_data": None
        }
    
    return {
        "valid": True,
        "clean_data": clean_data,
        "n_original": n_original,
        "n_clean": n_clean,
        "n_missing": n_missing,
        "missing_percentage": (n_missing / n_original) * 100 if n_original > 0 else 0
    }


def validate_two_samples(
    data1: pd.Series,
    data2: pd.Series,
    min_observations: int = 2,
    names: Tuple[str, str] = ("data1", "data2")
) -> Dict[str, Any]:
    """
    Validate two samples for comparative analysis.
    
    Args:
        data1: First sample
        data2: Second sample
        min_observations: Minimum observations per sample
        names: Names for error messages
        
    Returns:
        Dictionary with validation results
    """
    val1 = validate_series_data(data1, min_observations, names[0])
    val2 = validate_series_data(data2, min_observations, names[1])
    
    if not val1["valid"]:
        return val1
    if not val2["valid"]:
        return val2
    
    return {
        "valid": True,
        "sample1": val1,
        "sample2": val2,
        "total_n": val1["n_clean"] + val2["n_clean"]
    }


def validate_dataframe_columns(
    data: pd.DataFrame,
    required_columns: List[str],
    min_observations: int = 2
) -> Dict[str, Any]:
    """
    Validate DataFrame has required columns with sufficient data.
    
    Args:
        data: Input DataFrame
        required_columns: List of required column names
        min_observations: Minimum observations after cleaning
        
    Returns:
        Dictionary with validation results
    """
    if not isinstance(data, pd.DataFrame):
        return {
            "valid": False,
            "error": "Input must be a pandas DataFrame",
            "clean_data": None
        }
    
    # Check columns exist
    missing_cols = [col for col in required_columns if col not in data.columns]
    if missing_cols:
        return {
            "valid": False,
            "error": f"Missing columns: {missing_cols}",
            "clean_data": None
        }
    
    # Clean data
    clean_data = data[required_columns].dropna()
    n_original = len(data)
    n_clean = len(clean_data)
    
    if n_clean < min_observations:
        return {
            "valid": False,
            "error": f"Need at least {min_observations} complete observations (got {n_clean})",
            "clean_data": None
        }
    
    return {
        "valid": True,
        "clean_data": clean_data,
        "n_original": n_original,
        "n_clean": n_clean,
        "missing_percentage": ((n_original - n_clean) / n_original) * 100
    }


# ============================================================================
# ASSUMPTION TESTING
# ============================================================================

def test_normality(
    data: pd.Series,
    alpha: float = 0.05,
    test: str = 'shapiro'
) -> Dict[str, Any]:
    """
    Test normality assumption.
    
    Args:
        data: Sample data
        alpha: Significance level
        test: 'shapiro', 'anderson', or 'ks'
        
    Returns:
        Dictionary with normality test results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 3:
        return {"error": "Need at least 3 observations for normality test"}
    
    if test == 'shapiro':
        if n > 5000:
            warnings.warn("Shapiro-Wilk test not reliable for n > 5000, using Anderson-Darling")
            return test_normality(data, alpha, 'anderson')
        
        statistic, p_value = stats.shapiro(clean_data)
        test_name = "Shapiro-Wilk"
        
    elif test == 'anderson':
        result = stats.anderson(clean_data, dist='norm')
        # Use 5% critical value
        critical_5 = result.critical_values[2]  # 5% level
        statistic = result.statistic
        p_value = None  # Anderson-Darling doesn't give exact p-value
        is_normal = statistic < critical_5
        test_name = "Anderson-Darling"
        
        return {
            "test": test_name,
            "statistic": float(statistic),
            "critical_value": float(critical_5),
            "normal": is_normal,
            "assumption_met": is_normal,
            "n_observations": n
        }
        
    elif test == 'ks':
        # Kolmogorov-Smirnov against normal distribution
        mean, std = clean_data.mean(), clean_data.std()
        statistic, p_value = stats.kstest(clean_data, lambda x: stats.norm.cdf(x, mean, std))
        test_name = "Kolmogorov-Smirnov"
        
    else:
        return {"error": f"Unknown normality test: {test}"}
    
    is_normal = p_value > alpha if p_value is not None else False
    
    return {
        "test": test_name,
        "statistic": float(statistic),
        "p_value": float(p_value) if p_value is not None else None,
        "normal": is_normal,
        "assumption_met": is_normal,
        "alpha": alpha,
        "n_observations": n
    }


def test_equal_variances(
    data1: pd.Series,
    data2: pd.Series,
    alpha: float = 0.05,
    test: str = 'levene'
) -> Dict[str, Any]:
    """
    Test equal variances assumption.
    
    Args:
        data1: First sample
        data2: Second sample
        alpha: Significance level
        test: 'levene', 'bartlett', or 'fligner'
        
    Returns:
        Dictionary with equal variances test results
    """
    clean_data1 = data1.dropna()
    clean_data2 = data2.dropna()
    
    if len(clean_data1) < 2 or len(clean_data2) < 2:
        return {"error": "Need at least 2 observations per group"}
    
    if test == 'levene':
        statistic, p_value = stats.levene(clean_data1, clean_data2)
        test_name = "Levene's test"
        
    elif test == 'bartlett':
        statistic, p_value = stats.bartlett(clean_data1, clean_data2)
        test_name = "Bartlett's test"
        
    elif test == 'fligner':
        statistic, p_value = stats.fligner(clean_data1, clean_data2)
        test_name = "Fligner-Killeen test"
        
    else:
        return {"error": f"Unknown variance test: {test}"}
    
    equal_variances = p_value > alpha
    
    return {
        "test": test_name,
        "statistic": float(statistic),
        "p_value": float(p_value),
        "equal_variances": equal_variances,
        "assumption_met": equal_variances,
        "alpha": alpha,
        "sample_sizes": [len(clean_data1), len(clean_data2)],
        "variances": [float(clean_data1.var()), float(clean_data2.var())]
    }


def test_independence(
    data: pd.Series,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Test independence assumption using runs test.
    
    Args:
        data: Sample data (typically residuals)
        alpha: Significance level
        
    Returns:
        Dictionary with independence test results
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 10:
        return {"error": "Need at least 10 observations for runs test"}
    
    # Runs test for randomness
    median = clean_data.median()
    runs, n1, n2 = 0, 0, 0
    
    # Convert to binary sequence
    binary_seq = (clean_data > median).astype(int)
    n1 = sum(binary_seq)  # Above median
    n2 = n - n1          # Below median
    
    # Count runs
    if n1 > 0 and n2 > 0:
        runs = 1
        for i in range(1, len(binary_seq)):
            if binary_seq[i] != binary_seq[i-1]:
                runs += 1
    
    # Expected runs and variance
    expected_runs = (2 * n1 * n2) / n + 1
    var_runs = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n**2 * (n - 1))
    
    if var_runs > 0:
        z_stat = (runs - expected_runs) / np.sqrt(var_runs)
        p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
    else:
        z_stat = 0
        p_value = 1
    
    is_independent = p_value > alpha
    
    return {
        "test": "Runs test for independence",
        "runs_observed": runs,
        "runs_expected": float(expected_runs),
        "z_statistic": float(z_stat),
        "p_value": float(p_value),
        "independent": is_independent,
        "assumption_met": is_independent,
        "alpha": alpha,
        "n_observations": n
    }


# ============================================================================
# STATISTICAL HELPERS
# ============================================================================

def calculate_standard_error(
    data: pd.Series,
    statistic: str = 'mean'
) -> float:
    """Calculate standard error for various statistics."""
    clean_data = data.dropna()
    n = len(clean_data)
    
    if statistic == 'mean':
        return clean_data.std() / np.sqrt(n)
    elif statistic == 'proportion':
        p = clean_data.mean()  # Assumes 0/1 data
        return np.sqrt(p * (1 - p) / n)
    elif statistic == 'median':
        # Approximate SE for median
        return 1.2533 * clean_data.std() / np.sqrt(n)
    else:
        raise ValueError(f"Unknown statistic: {statistic}")


def calculate_degrees_of_freedom(
    sample_sizes: List[int],
    test_type: str = 'one_sample'
) -> int:
    """Calculate degrees of freedom for various tests."""
    if test_type == 'one_sample':
        return sample_sizes[0] - 1
    elif test_type == 'two_sample':
        return sum(sample_sizes) - 2
    elif test_type == 'paired':
        return sample_sizes[0] - 1
    elif test_type == 'anova':
        return sum(sample_sizes) - len(sample_sizes)
    else:
        raise ValueError(f"Unknown test type: {test_type}")


def welch_degrees_of_freedom(
    var1: float,
    var2: float,
    n1: int,
    n2: int
) -> float:
    """Calculate Welch's degrees of freedom for unequal variances."""
    numerator = (var1/n1 + var2/n2)**2
    denominator = (var1/n1)**2/(n1-1) + (var2/n2)**2/(n2-1)
    return numerator / denominator


def pooled_variance(
    data1: pd.Series,
    data2: pd.Series
) -> float:
    """Calculate pooled variance for two samples."""
    n1, n2 = len(data1), len(data2)
    var1, var2 = data1.var(), data2.var()
    return ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)


# ============================================================================
# EFFECT SIZE INTERPRETATIONS
# ============================================================================

def interpret_cohens_d(d: float) -> str:
    """Interpret Cohen's d effect size."""
    abs_d = abs(d)
    if abs_d < 0.2:
        return EffectSizeInterpretation.NEGLIGIBLE.value
    elif abs_d < 0.5:
        return EffectSizeInterpretation.SMALL.value
    elif abs_d < 0.8:
        return EffectSizeInterpretation.MEDIUM.value
    else:
        return EffectSizeInterpretation.LARGE.value


def interpret_correlation(r: float) -> str:
    """Interpret correlation coefficient magnitude."""
    abs_r = abs(r)
    if abs_r < 0.1:
        return EffectSizeInterpretation.NEGLIGIBLE.value
    elif abs_r < 0.3:
        return EffectSizeInterpretation.SMALL.value
    elif abs_r < 0.5:
        return EffectSizeInterpretation.MEDIUM.value
    elif abs_r < 0.7:
        return EffectSizeInterpretation.LARGE.value
    else:
        return EffectSizeInterpretation.VERY_LARGE.value


def interpret_eta_squared(eta_sq: float) -> str:
    """Interpret eta squared effect size."""
    if eta_sq < 0.01:
        return EffectSizeInterpretation.NEGLIGIBLE.value
    elif eta_sq < 0.06:
        return EffectSizeInterpretation.SMALL.value
    elif eta_sq < 0.14:
        return EffectSizeInterpretation.MEDIUM.value
    else:
        return EffectSizeInterpretation.LARGE.value


def interpret_cramers_v(v: float) -> str:
    """Interpret Cramer's V effect size."""
    if v < 0.1:
        return EffectSizeInterpretation.NEGLIGIBLE.value
    elif v < 0.3:
        return EffectSizeInterpretation.SMALL.value
    elif v < 0.5:
        return EffectSizeInterpretation.MEDIUM.value
    else:
        return EffectSizeInterpretation.LARGE.value


def interpret_odds_ratio(or_value: float) -> str:
    """Interpret odds ratio magnitude."""
    if 0.9 <= or_value <= 1.1:
        return "negligible association"
    elif (0.5 <= or_value < 0.9) or (1.1 < or_value <= 2.0):
        return "small association"
    elif (0.2 <= or_value < 0.5) or (2.0 < or_value <= 5.0):
        return "medium association"
    else:
        return "large association"


# ============================================================================
# RESULT FORMATTING
# ============================================================================

def format_p_value(p_value: float, alpha: float = 0.05) -> Dict[str, Any]:
    """Format p-value with interpretation."""
    return {
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "formatted": f"p < 0.001" if p_value < 0.001 else f"p = {p_value:.3f}",
        "interpretation": "statistically significant" if p_value < alpha else "not statistically significant"
    }


def format_confidence_interval(
    lower: float,
    upper: float,
    confidence: float = 0.95,
    parameter: str = "parameter"
) -> Dict[str, Any]:
    """Format confidence interval with interpretation."""
    return {
        "lower": float(lower),
        "upper": float(upper),
        "confidence_level": confidence,
        "width": float(upper - lower),
        "formatted": f"{confidence*100:.0f}% CI [{lower:.3f}, {upper:.3f}]",
        "contains_zero": lower <= 0 <= upper,
        "contains_one": lower <= 1 <= upper,  # Useful for ratios
        "interpretation": f"{confidence*100:.0f}% confident the true {parameter} is between {lower:.3f} and {upper:.3f}"
    }


def create_summary_statistics(data: pd.Series) -> Dict[str, Any]:
    """Create comprehensive summary statistics."""
    clean_data = data.dropna()
    
    return {
        "n": len(clean_data),
        "mean": float(clean_data.mean()),
        "std": float(clean_data.std()),
        "se": float(clean_data.std() / np.sqrt(len(clean_data))),
        "min": float(clean_data.min()),
        "q1": float(clean_data.quantile(0.25)),
        "median": float(clean_data.median()),
        "q3": float(clean_data.quantile(0.75)),
        "max": float(clean_data.max()),
        "iqr": float(clean_data.quantile(0.75) - clean_data.quantile(0.25)),
        "skewness": float(clean_data.skew()),
        "kurtosis": float(clean_data.kurtosis()),
        "missing_count": len(data) - len(clean_data),
        "missing_percentage": ((len(data) - len(clean_data)) / len(data)) * 100 if len(data) > 0 else 0
    }


# ============================================================================
# POWER AND SAMPLE SIZE UTILITIES
# ============================================================================

def calculate_minimum_detectable_effect(
    n: int,
    alpha: float = 0.05,
    power: float = 0.8,
    test_type: str = 'two_sample'
) -> float:
    """Calculate minimum detectable effect size given sample size and power."""
    if test_type == 'two_sample':
        # For two-sample t-test
        z_alpha = stats.norm.ppf(1 - alpha/2)
        z_beta = stats.norm.ppf(power)
        return (z_alpha + z_beta) * np.sqrt(2/n)
    else:
        raise NotImplementedError(f"MDE calculation not implemented for {test_type}")


def suggest_sample_size_increase(
    current_n: int,
    observed_effect: float,
    desired_power: float = 0.8,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """Suggest sample size increase for adequate power."""
    # Simplified calculation for two-sample t-test
    z_alpha = stats.norm.ppf(1 - alpha/2)
    z_beta = stats.norm.ppf(desired_power)
    
    required_n_per_group = ((z_alpha + z_beta) / observed_effect) ** 2 * 2
    total_required = int(np.ceil(required_n_per_group * 2))
    
    return {
        "current_total_n": current_n,
        "required_total_n": total_required,
        "additional_n_needed": max(0, total_required - current_n),
        "power_achievable": desired_power if total_required <= current_n else None
    }


# ============================================================================
# DIAGNOSTIC UTILITIES
# ============================================================================

def check_test_assumptions(
    data1: pd.Series,
    data2: Optional[pd.Series] = None,
    test_type: str = 'two_sample_t',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """Comprehensive assumption checking for statistical tests."""
    assumptions = {}
    
    if test_type in ['one_sample_t', 'paired_t']:
        # Test normality
        assumptions['normality'] = test_normality(data1, alpha)
        
        if test_type == 'paired_t' and data2 is not None:
            # Test normality of differences
            differences = data1 - data2
            assumptions['normality_differences'] = test_normality(differences.dropna(), alpha)
    
    elif test_type == 'two_sample_t':
        if data2 is None:
            return {"error": "Two-sample test requires two datasets"}
        
        # Test normality for both groups
        assumptions['normality_group1'] = test_normality(data1, alpha)
        assumptions['normality_group2'] = test_normality(data2, alpha)
        
        # Test equal variances
        assumptions['equal_variances'] = test_equal_variances(data1, data2, alpha)
    
    # Overall assessment
    all_met = all(
        assumption.get('assumption_met', True) 
        for assumption in assumptions.values()
        if isinstance(assumption, dict) and 'assumption_met' in assumption
    )
    
    return {
        "assumptions": assumptions,
        "all_assumptions_met": all_met,
        "test_type": test_type,
        "alpha": alpha
    }


def get_test_recommendations(
    assumptions: Dict[str, Any],
    test_type: str
) -> List[str]:
    """Get recommendations based on assumption violations."""
    recommendations = []
    
    if test_type == 'two_sample_t':
        if not assumptions.get('equal_variances', {}).get('assumption_met', True):
            recommendations.append("Use Welch's t-test instead of Student's t-test")
        
        norm1 = assumptions.get('normality_group1', {}).get('assumption_met', True)
        norm2 = assumptions.get('normality_group2', {}).get('assumption_met', True)
        
        if not norm1 or not norm2:
            recommendations.append("Consider non-parametric Mann-Whitney U test")
            recommendations.append("Consider bootstrap methods")
    
    elif test_type == 'one_sample_t':
        if not assumptions.get('normality', {}).get('assumption_met', True):
            recommendations.append("Consider non-parametric Wilcoxon signed-rank test")
            recommendations.append("Consider bootstrap confidence intervals")
    
    return recommendations
