"""
Effect size calculations for various statistical tests.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Union, Optional

def calculate_cohens_d(
    group1: pd.Series,
    group2: pd.Series,
    pooled: bool = True
) -> Dict[str, Any]:
    """
    Calculate Cohen's d effect size.
    
    Args:
        group1: First group data
        group2: Second group data
        pooled: Use pooled standard deviation
        
    Returns:
        Dictionary with effect size information
    """
    n1, n2 = len(group1), len(group2)
    mean1, mean2 = group1.mean(), group2.mean()
    
    if pooled:
        # Pooled standard deviation
        var1, var2 = group1.var(ddof=1), group2.var(ddof=1)
        pooled_sd = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
        d = (mean1 - mean2) / pooled_sd
    else:
        # Use control group SD (Glass's delta)
        d = (mean1 - mean2) / group2.std(ddof=1)
    
    # Confidence interval for d
    se_d = np.sqrt((n1 + n2) / (n1 * n2) + d**2 / (2 * (n1 + n2)))
    ci_lower = d - 1.96 * se_d
    ci_upper = d + 1.96 * se_d
    
    return {
        "cohens_d": float(d),
        "interpretation": _interpret_cohens_d(d),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper)
        },
        "mean_difference": float(mean1 - mean2),
        "pooled_sd": float(pooled_sd) if pooled else float(group2.std(ddof=1)),
        "sample_sizes": {"group1": n1, "group2": n2}
    }

def calculate_hedges_g(
    group1: pd.Series,
    group2: pd.Series
) -> Dict[str, Any]:
    """
    Calculate Hedges' g (bias-corrected Cohen's d).
    
    Args:
        group1: First group data
        group2: Second group data
        
    Returns:
        Dictionary with effect size information
    """
    # Start with Cohen's d
    d_result = calculate_cohens_d(group1, group2)
    d = d_result['cohens_d']
    
    # Apply Hedges' correction
    n1, n2 = len(group1), len(group2)
    df = n1 + n2 - 2
    correction = 1 - (3 / (4 * df - 1))
    g = d * correction
    
    # Adjust confidence interval
    ci_lower = d_result['confidence_interval']['lower'] * correction
    ci_upper = d_result['confidence_interval']['upper'] * correction
    
    return {
        "hedges_g": float(g),
        "interpretation": _interpret_cohens_d(g),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper)
        },
        "cohens_d": d,
        "correction_factor": float(correction),
        "sample_sizes": {"group1": n1, "group2": n2}
    }

def calculate_glass_delta(
    treatment: pd.Series,
    control: pd.Series
) -> Dict[str, Any]:
    """
    Calculate Glass's delta using control group SD.
    
    Args:
        treatment: Treatment group data
        control: Control group data
        
    Returns:
        Dictionary with effect size information
    """
    mean_diff = treatment.mean() - control.mean()
    control_sd = control.std(ddof=1)
    
    if control_sd == 0:
        return {"error": "Control group has zero variance"}
    
    delta = mean_diff / control_sd
    
    # Standard error
    n_t, n_c = len(treatment), len(control)
    se = np.sqrt(n_t + n_c / (n_t * n_c) + delta**2 / (2 * n_c))
    
    return {
        "glass_delta": float(delta),
        "interpretation": _interpret_cohens_d(delta),
        "mean_difference": float(mean_diff),
        "control_sd": float(control_sd),
        "standard_error": float(se),
        "sample_sizes": {"treatment": n_t, "control": n_c}
    }

def calculate_eta_squared(
    data: pd.DataFrame,
    group_column: str,
    value_column: str
) -> Dict[str, Any]:
    """
    Calculate eta squared for ANOVA.
    
    Args:
        data: DataFrame with group and value columns
        group_column: Column containing group labels
        value_column: Column containing values
        
    Returns:
        Dictionary with effect size information
    """
    # Calculate sum of squares
    grand_mean = data[value_column].mean()
    ss_total = ((data[value_column] - grand_mean) ** 2).sum()
    
    # Between group sum of squares
    group_means = data.groupby(group_column)[value_column].mean()
    group_counts = data.groupby(group_column)[value_column].count()
    ss_between = sum(n * (mean - grand_mean) ** 2 
                    for mean, n in zip(group_means, group_counts))
    
    # Eta squared
    eta_squared = ss_between / ss_total if ss_total > 0 else 0
    
    # Convert to Cohen's f
    f = np.sqrt(eta_squared / (1 - eta_squared)) if eta_squared < 1 else np.inf
    
    return {
        "eta_squared": float(eta_squared),
        "cohens_f": float(f),
        "interpretation": _interpret_eta_squared(eta_squared),
        "variance_explained": float(eta_squared * 100),
        "ss_between": float(ss_between),
        "ss_total": float(ss_total)
    }

def calculate_omega_squared(
    data: pd.DataFrame,
    group_column: str,
    value_column: str
) -> Dict[str, Any]:
    """
    Calculate omega squared (less biased than eta squared).
    
    Args:
        data: DataFrame with group and value columns
        group_column: Column containing group labels
        value_column: Column containing values
        
    Returns:
        Dictionary with effect size information
    """
    # Get eta squared first
    eta_result = calculate_eta_squared(data, group_column, value_column)
    ss_between = eta_result['ss_between']
    ss_total = eta_result['ss_total']
    
    # Calculate MS within
    k = data[group_column].nunique()  # number of groups
    n = len(data)
    df_between = k - 1
    df_within = n - k
    
    ss_within = ss_total - ss_between
    ms_within = ss_within / df_within
    
    # Omega squared
    omega_squared = (ss_between - df_between * ms_within) / (ss_total + ms_within)
    omega_squared = max(0, omega_squared)  # Can't be negative
    
    return {
        "omega_squared": float(omega_squared),
        "interpretation": _interpret_omega_squared(omega_squared),
        "variance_explained": float(omega_squared * 100),
        "eta_squared": eta_result['eta_squared'],
        "bias_reduction": float(eta_result['eta_squared'] - omega_squared)
    }

def calculate_cohens_f(
    eta_squared: Optional[float] = None,
    groups_means: Optional[list] = None,
    grand_mean: Optional[float] = None,
    pooled_sd: Optional[float] = None
) -> Dict[str, Any]:
    """
    Calculate Cohen's f for ANOVA.
    
    Args:
        eta_squared: Eta squared value
        groups_means: List of group means
        grand_mean: Grand mean
        pooled_sd: Pooled standard deviation
        
    Returns:
        Dictionary with effect size information
    """
    if eta_squared is not None:
        # Calculate from eta squared
        f = np.sqrt(eta_squared / (1 - eta_squared)) if eta_squared < 1 else np.inf
        
    elif all(x is not None for x in [groups_means, grand_mean, pooled_sd]):
        # Calculate from means
        variance_means = np.var(groups_means, ddof=1)
        f = np.sqrt(variance_means) / pooled_sd if pooled_sd > 0 else np.inf
        
    else:
        return {"error": "Insufficient information to calculate Cohen's f"}
    
    return {
        "cohens_f": float(f),
        "interpretation": _interpret_cohens_f(f),
        "f_squared": float(f ** 2)
    }

def calculate_cramers_v(
    contingency_table: pd.DataFrame
) -> Dict[str, Any]:
    """
    Calculate Cramér's V for contingency tables.
    
    Args:
        contingency_table: Contingency table
        
    Returns:
        Dictionary with effect size information
    """
    chi2 = stats.chi2_contingency(contingency_table)[0]
    n = contingency_table.sum().sum()
    r, c = contingency_table.shape
    
    # Cramér's V
    v = np.sqrt(chi2 / (n * min(r - 1, c - 1)))
    
    # Bias-corrected Cramér's V
    v_corrected = max(0, v**2 - ((r-1)*(c-1))/(n-1))
    v_corrected = np.sqrt(v_corrected)
    
    return {
        "cramers_v": float(v),
        "cramers_v_corrected": float(v_corrected),
        "interpretation": _interpret_cramers_v(v, min(r, c)),
        "chi_square": float(chi2),
        "sample_size": int(n),
        "table_dimensions": (r, c)
    }

def calculate_odds_ratio(
    table: pd.DataFrame,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Calculate odds ratio for 2x2 table.
    
    Args:
        table: 2x2 contingency table
        confidence: Confidence level
        
    Returns:
        Dictionary with odds ratio information
    """
    if table.shape != (2, 2):
        return {"error": "Odds ratio requires 2x2 table"}
    
    a, b = table.iloc[0, 0], table.iloc[0, 1]
    c, d = table.iloc[1, 0], table.iloc[1, 1]
    
    # Handle zeros
    if a == 0 or b == 0 or c == 0 or d == 0:
        # Add 0.5 to all cells
        a, b, c, d = a + 0.5, b + 0.5, c + 0.5, d + 0.5
    
    # Calculate OR
    or_value = (a * d) / (b * c)
    
    # Log OR and SE
    log_or = np.log(or_value)
    se_log_or = np.sqrt(1/a + 1/b + 1/c + 1/d)
    
    # Confidence interval
    z = stats.norm.ppf((1 + confidence) / 2)
    ci_lower = np.exp(log_or - z * se_log_or)
    ci_upper = np.exp(log_or + z * se_log_or)
    
    return {
        "odds_ratio": float(or_value),
        "log_odds_ratio": float(log_or),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper)
        },
        "standard_error": float(se_log_or),
        "interpretation": _interpret_odds_ratio(or_value),
        "significant": not (ci_lower <= 1 <= ci_upper)
    }

def calculate_risk_ratio(
    table: pd.DataFrame,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Calculate risk ratio (relative risk) for 2x2 table.
    
    Args:
        table: 2x2 contingency table
        confidence: Confidence level
        
    Returns:
        Dictionary with risk ratio information
    """
    if table.shape != (2, 2):
        return {"error": "Risk ratio requires 2x2 table"}
    
    a, b = table.iloc[0, 0], table.iloc[0, 1]
    c, d = table.iloc[1, 0], table.iloc[1, 1]
    
    # Calculate risks
    risk1 = a / (a + b) if (a + b) > 0 else 0
    risk2 = c / (c + d) if (c + d) > 0 else 0
    
    if risk2 == 0:
        return {"error": "Zero risk in reference group"}
    
    # Risk ratio
    rr = risk1 / risk2
    
    # Log RR and SE
    log_rr = np.log(rr)
    se_log_rr = np.sqrt(1/a - 1/(a+b) + 1/c - 1/(c+d))
    
    # Confidence interval
    z = stats.norm.ppf((1 + confidence) / 2)
    ci_lower = np.exp(log_rr - z * se_log_rr)
    ci_upper = np.exp(log_rr + z * se_log_rr)
    
    return {
        "risk_ratio": float(rr),
        "risk_exposed": float(risk1),
        "risk_unexposed": float(risk2),
        "log_risk_ratio": float(log_rr),
        "confidence_interval": {
            "lower": float(ci_lower),
            "upper": float(ci_upper)
        },
        "standard_error": float(se_log_rr),
        "interpretation": _interpret_risk_ratio(rr),
        "significant": not (ci_lower <= 1 <= ci_upper)
    }

def calculate_nnt(
    risk_control: float,
    risk_treatment: float,
    confidence: float = 0.95
) -> Dict[str, Any]:
    """
    Calculate Number Needed to Treat (NNT).
    
    Args:
        risk_control: Risk in control group
        risk_treatment: Risk in treatment group
        confidence: Confidence level
        
    Returns:
        Dictionary with NNT information
    """
    # Absolute risk reduction
    arr = risk_control - risk_treatment
    
    if arr <= 0:
        return {"error": "Treatment does not reduce risk"}
    
    # NNT
    nnt = 1 / arr
    
    # Confidence interval (Altman method)
    # Would need sample sizes for proper CI
    
    return {
        "nnt": float(np.ceil(nnt)),
        "absolute_risk_reduction": float(arr),
        "relative_risk_reduction": float(arr / risk_control),
        "interpretation": f"Need to treat {int(np.ceil(nnt))} patients to prevent one event"
    }

# Helper functions

def _interpret_cohens_d(d: float) -> str:
    """Interpret Cohen's d."""
    d = abs(d)
    if d < 0.2:
        return "negligible effect"
    elif d < 0.5:
        return "small effect"
    elif d < 0.8:
        return "medium effect"
    else:
        return "large effect"

def _interpret_eta_squared(eta2: float) -> str:
    """Interpret eta squared."""
    if eta2 < 0.01:
        return "negligible effect"
    elif eta2 < 0.06:
        return "small effect"
    elif eta2 < 0.14:
        return "medium effect"
    else:
        return "large effect"

def _interpret_omega_squared(omega2: float) -> str:
    """Interpret omega squared."""
    if omega2 < 0.01:
        return "negligible effect"
    elif omega2 < 0.06:
        return "small effect"
    elif omega2 < 0.14:
        return "medium effect"
    else:
        return "large effect"

def _interpret_cohens_f(f: float) -> str:
    """Interpret Cohen's f."""
    if f < 0.1:
        return "negligible effect"
    elif f < 0.25:
        return "small effect"
    elif f < 0.4:
        return "medium effect"
    else:
        return "large effect"

def _interpret_cramers_v(v: float, df: int) -> str:
    """Interpret Cramér's V based on degrees of freedom."""
    if df == 2:  # 2x2 table
        thresholds = [0.1, 0.3, 0.5]
    elif df == 3:  # 2x3 or 3x2 table
        thresholds = [0.07, 0.21, 0.35]
    else:  # larger tables
        thresholds = [0.05, 0.15, 0.25]
    
    if v < thresholds[0]:
        return "negligible association"
    elif v < thresholds[1]:
        return "weak association"
    elif v < thresholds[2]:
        return "moderate association"
    else:
        return "strong association"

def _interpret_odds_ratio(or_value: float) -> str:
    """Interpret odds ratio."""
    if 0.67 <= or_value <= 1.5:
        return "little or no association"
    elif or_value < 0.67:
        if or_value < 0.33:
            return "strong negative association"
        else:
            return "moderate negative association"
    else:  # or_value > 1.5
        if or_value > 3.0:
            return "strong positive association"
        else:
            return "moderate positive association"

def _interpret_risk_ratio(rr: float) -> str:
    """Interpret risk ratio."""
    if 0.8 <= rr <= 1.25:
        return "little or no effect"
    elif rr < 0.8:
        if rr < 0.5:
            return "large protective effect"
        else:
            return "moderate protective effect"
    else:  # rr > 1.25
        if rr > 2.0:
            return "large harmful effect"
        else:
            return "moderate harmful effect"