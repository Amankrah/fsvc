"""
Multiple comparisons corrections and post-hoc tests.
"""

import pandas as pd
import numpy as np
from scipy import stats
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.multicomp import pairwise_tukeyhsd, MultiComparison
from typing import Dict, Any, List, Tuple, Union
import warnings

def bonferroni_correction(
    p_values: Union[List[float], np.ndarray],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Apply Bonferroni correction for multiple comparisons.
    
    Args:
        p_values: List of p-values
        alpha: Family-wise error rate
        
    Returns:
        Dictionary with corrected results
    """
    p_values = np.array(p_values)
    n_comparisons = len(p_values)
    
    # Bonferroni correction
    corrected_alpha = alpha / n_comparisons
    reject = p_values < corrected_alpha
    adjusted_p = np.minimum(p_values * n_comparisons, 1.0)
    
    return {
        "method": "Bonferroni",
        "n_comparisons": n_comparisons,
        "original_alpha": alpha,
        "corrected_alpha": float(corrected_alpha),
        "original_p_values": p_values.tolist(),
        "adjusted_p_values": adjusted_p.tolist(),
        "reject_null": reject.tolist(),
        "n_significant": int(reject.sum()),
        "family_wise_error_rate": alpha
    }

def holm_bonferroni_correction(
    p_values: Union[List[float], np.ndarray],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Apply Holm-Bonferroni correction (sequentially rejective).
    
    Args:
        p_values: List of p-values
        alpha: Family-wise error rate
        
    Returns:
        Dictionary with corrected results
    """
    p_values = np.array(p_values)
    n = len(p_values)
    
    # Sort p-values
    sorted_idx = np.argsort(p_values)
    sorted_p = p_values[sorted_idx]
    
    # Holm-Bonferroni procedure
    reject = np.zeros(n, dtype=bool)
    adjusted_p = np.zeros(n)
    
    for i in range(n):
        threshold = alpha / (n - i)
        if sorted_p[i] <= threshold:
            reject[sorted_idx[i]] = True
            adjusted_p[sorted_idx[i]] = min(sorted_p[i] * (n - i), 1.0)
        else:
            # Stop testing
            adjusted_p[sorted_idx[i:]] = np.minimum(sorted_p[i:] * np.arange(n-i, 0, -1), 1.0)
            break
    
    return {
        "method": "Holm-Bonferroni",
        "n_comparisons": n,
        "original_alpha": alpha,
        "original_p_values": p_values.tolist(),
        "adjusted_p_values": adjusted_p.tolist(),
        "reject_null": reject.tolist(),
        "n_significant": int(reject.sum()),
        "family_wise_error_rate": alpha
    }

def benjamini_hochberg_correction(
    p_values: Union[List[float], np.ndarray],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Apply Benjamini-Hochberg FDR correction.
    
    Args:
        p_values: List of p-values
        alpha: False discovery rate
        
    Returns:
        Dictionary with corrected results
    """
    reject, adjusted_p, _, _ = multipletests(
        p_values, 
        alpha=alpha, 
        method='fdr_bh'
    )
    
    return {
        "method": "Benjamini-Hochberg",
        "n_comparisons": len(p_values),
        "original_alpha": alpha,
        "original_p_values": list(p_values),
        "adjusted_p_values": adjusted_p.tolist(),
        "reject_null": reject.tolist(),
        "n_significant": int(reject.sum()),
        "false_discovery_rate": alpha,
        "expected_false_discoveries": float(alpha * reject.sum())
    }

def benjamini_yekutieli_correction(
    p_values: Union[List[float], np.ndarray],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Apply Benjamini-Yekutieli FDR correction (for dependent tests).
    
    Args:
        p_values: List of p-values
        alpha: False discovery rate
        
    Returns:
        Dictionary with corrected results
    """
    reject, adjusted_p, _, _ = multipletests(
        p_values, 
        alpha=alpha, 
        method='fdr_by'
    )
    
    return {
        "method": "Benjamini-Yekutieli",
        "n_comparisons": len(p_values),
        "original_alpha": alpha,
        "original_p_values": list(p_values),
        "adjusted_p_values": adjusted_p.tolist(),
        "reject_null": reject.tolist(),
        "n_significant": int(reject.sum()),
        "false_discovery_rate": alpha,
        "note": "More conservative than BH, suitable for dependent tests"
    }

def tukey_hsd_test(
    data: pd.DataFrame,
    group_column: str,
    value_column: str,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Tukey's HSD test for pairwise comparisons.
    
    Args:
        data: DataFrame with group and value columns
        group_column: Column containing group labels
        value_column: Column containing values
        alpha: Significance level
        
    Returns:
        Dictionary with Tukey HSD results
    """
    # Prepare data
    clean_data = data[[group_column, value_column]].dropna()
    
    # Perform Tukey HSD
    mc = MultiComparison(clean_data[value_column], clean_data[group_column])
    tukey_result = mc.tukeyhsd(alpha=alpha)
    
    # Extract results
    comparisons = []
    for i in range(len(tukey_result.summary().data[1:])):
        row = tukey_result.summary().data[i+1]
        comparisons.append({
            "group1": row[0],
            "group2": row[1],
            "mean_diff": float(row[2]),
            "p_value": float(row[3]),
            "ci_lower": float(row[4]),
            "ci_upper": float(row[5]),
            "reject": row[6]
        })
    
    # Group statistics
    group_stats = clean_data.groupby(group_column)[value_column].agg(['mean', 'std', 'count'])
    
    return {
        "method": "Tukey HSD",
        "alpha": alpha,
        "comparisons": comparisons,
        "n_comparisons": len(comparisons),
        "n_significant": sum(c['reject'] for c in comparisons),
        "group_statistics": group_stats.to_dict('index'),
        "summary": str(tukey_result.summary())
    }

def dunnett_test(
    data: pd.DataFrame,
    group_column: str,
    value_column: str,
    control_group: str,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Dunnett's test (compare all groups to control).
    
    Args:
        data: DataFrame with group and value columns
        group_column: Column containing group labels
        value_column: Column containing values
        control_group: Name of control group
        alpha: Significance level
        
    Returns:
        Dictionary with Dunnett test results
    """
    # Prepare data
    clean_data = data[[group_column, value_column]].dropna()
    
    # Separate control and treatment groups
    control_data = clean_data[clean_data[group_column] == control_group][value_column]
    
    if len(control_data) == 0:
        return {"error": f"Control group '{control_group}' not found"}
    
    comparisons = []
    groups = clean_data[group_column].unique()
    treatment_groups = [g for g in groups if g != control_group]
    
    # Perform comparisons
    for group in treatment_groups:
        group_data = clean_data[clean_data[group_column] == group][value_column]
        
        # t-test against control
        t_stat, p_value = stats.ttest_ind(group_data, control_data)
        
        # Mean difference and CI
        mean_diff = group_data.mean() - control_data.mean()
        se_diff = np.sqrt(group_data.var()/len(group_data) + control_data.var()/len(control_data))
        
        # Dunnett's critical value (approximate)
        k = len(treatment_groups)  # number of treatment groups
        df = len(clean_data) - len(groups)
        
        # Use Bonferroni as approximation for Dunnett
        critical_value = stats.t.ppf(1 - alpha/(2*k), df)
        
        ci_lower = mean_diff - critical_value * se_diff
        ci_upper = mean_diff + critical_value * se_diff
        
        comparisons.append({
            "group": group,
            "vs_control": control_group,
            "mean_diff": float(mean_diff),
            "t_statistic": float(t_stat),
            "p_value": float(p_value),
            "adjusted_p": float(min(p_value * k, 1.0)),
            "ci_lower": float(ci_lower),
            "ci_upper": float(ci_upper),
            "significant": p_value * k < alpha
        })
    
    return {
        "method": "Dunnett's test",
        "control_group": control_group,
        "alpha": alpha,
        "comparisons": comparisons,
        "n_comparisons": len(comparisons),
        "n_significant": sum(c['significant'] for c in comparisons),
        "control_stats": {
            "mean": float(control_data.mean()),
            "std": float(control_data.std()),
            "n": len(control_data)
        }
    }

def games_howell_test(
    data: pd.DataFrame,
    group_column: str,
    value_column: str,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Games-Howell test (for unequal variances).
    
    Args:
        data: DataFrame with group and value columns
        group_column: Column containing group labels
        value_column: Column containing values
        alpha: Significance level
        
    Returns:
        Dictionary with Games-Howell results
    """
    # Prepare data
    clean_data = data[[group_column, value_column]].dropna()
    groups = clean_data[group_column].unique()
    
    # Get group data
    group_data = {g: clean_data[clean_data[group_column] == g][value_column].values 
                  for g in groups}
    
    comparisons = []
    
    # Pairwise comparisons
    for i, g1 in enumerate(groups):
        for j, g2 in enumerate(groups[i+1:], i+1):
            data1 = group_data[g1]
            data2 = group_data[g2]
            
            n1, n2 = len(data1), len(data2)
            mean1, mean2 = np.mean(data1), np.mean(data2)
            var1, var2 = np.var(data1, ddof=1), np.var(data2, ddof=1)
            
            # Mean difference
            mean_diff = mean1 - mean2
            
            # Welch's degrees of freedom
            df = (var1/n1 + var2/n2)**2 / ((var1/n1)**2/(n1-1) + (var2/n2)**2/(n2-1))
            
            # Standard error
            se = np.sqrt(var1/n1 + var2/n2)
            
            # t-statistic
            t_stat = mean_diff / se if se > 0 else 0
            
            # Studentized range distribution would be more accurate
            # Using t-distribution as approximation
            critical_value = stats.t.ppf(1 - alpha/2, df) * np.sqrt(2)
            
            # Confidence interval
            ci_lower = mean_diff - critical_value * se
            ci_upper = mean_diff + critical_value * se
            
            # p-value (approximate)
            p_value = 2 * (1 - stats.t.cdf(abs(t_stat), df))
            
            comparisons.append({
                "group1": g1,
                "group2": g2,
                "mean_diff": float(mean_diff),
                "std_error": float(se),
                "t_statistic": float(t_stat),
                "df": float(df),
                "p_value": float(p_value),
                "ci_lower": float(ci_lower),
                "ci_upper": float(ci_upper),
                "significant": abs(t_stat) > critical_value
            })
    
    return {
        "method": "Games-Howell test",
        "alpha": alpha,
        "comparisons": comparisons,
        "n_comparisons": len(comparisons),
        "n_significant": sum(c['significant'] for c in comparisons),
        "note": "Suitable for unequal variances and sample sizes"
    }

def apply_multiple_corrections(
    p_values: Union[List[float], np.ndarray],
    alpha: float = 0.05,
    methods: List[str] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Apply multiple correction methods and compare results.
    
    Args:
        p_values: List of p-values
        alpha: Significance level
        methods: List of methods to apply
        
    Returns:
        Dictionary with results from each method
    """
    if methods is None:
        methods = ['bonferroni', 'holm', 'fdr_bh', 'fdr_by']
    
    results = {}
    
    if 'bonferroni' in methods:
        results['bonferroni'] = bonferroni_correction(p_values, alpha)
    
    if 'holm' in methods:
        results['holm'] = holm_bonferroni_correction(p_values, alpha)
    
    if 'fdr_bh' in methods:
        results['benjamini_hochberg'] = benjamini_hochberg_correction(p_values, alpha)
    
    if 'fdr_by' in methods:
        results['benjamini_yekutieli'] = benjamini_yekutieli_correction(p_values, alpha)
    
    # Summary
    summary = {
        "n_tests": len(p_values),
        "uncorrected_significant": sum(p < alpha for p in p_values),
        "method_comparison": {}
    }
    
    for method, result in results.items():
        summary["method_comparison"][method] = {
            "n_significant": result['n_significant'],
            "most_conservative": min(result['adjusted_p_values'])
        }
    
    results['summary'] = summary
    
    return results