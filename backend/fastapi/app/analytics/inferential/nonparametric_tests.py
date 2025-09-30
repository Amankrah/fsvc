"""
Non-parametric statistical tests for research data.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Union, List, Optional
import warnings

def mann_whitney_u_test(
    data1: pd.Series,
    data2: pd.Series,
    alternative: str = 'two-sided',
    use_continuity: bool = True,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Mann-Whitney U test (Wilcoxon rank-sum test).
    
    Args:
        data1: First sample
        data2: Second sample
        alternative: 'two-sided', 'less', or 'greater'
        use_continuity: Apply continuity correction
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    n1, n2 = len(data1_clean), len(data2_clean)
    
    if n1 < 1 or n2 < 1:
        return {"error": "Insufficient data for Mann-Whitney U test"}
    
    # Perform test
    statistic, p_value = stats.mannwhitneyu(
        data1_clean, data2_clean,
        alternative=alternative,
        use_continuity=use_continuity
    )
    
    # Effect size (rank biserial correlation)
    U1 = statistic
    U2 = n1 * n2 - U1
    r = 1 - (2 * min(U1, U2)) / (n1 * n2)
    
    # Common language effect size
    cles = U1 / (n1 * n2)
    
    # Medians
    median1 = data1_clean.median()
    median2 = data2_clean.median()
    
    # Confidence interval for difference in medians (Hodges-Lehmann)
    all_diffs = []
    for val1 in data1_clean:
        for val2 in data2_clean:
            all_diffs.append(val1 - val2)
    all_diffs = sorted(all_diffs)
    hl_estimate = np.median(all_diffs)
    
    # Approximate CI
    n_diffs = len(all_diffs)
    se = np.sqrt(n1 * n2 * (n1 + n2 + 1) / 12)
    z = stats.norm.ppf((1 + (1-alpha)) / 2)
    ci_idx_lower = int(n_diffs/2 - z * se/2)
    ci_idx_upper = int(n_diffs/2 + z * se/2)
    
    ci_lower = all_diffs[max(0, ci_idx_lower)]
    ci_upper = all_diffs[min(n_diffs-1, ci_idx_upper)]
    
    return {
        "test_type": "Mann-Whitney U test",
        "alternative": alternative,
        "statistic": float(statistic),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "sample_sizes": {"n1": n1, "n2": n2},
        "medians": {"group1": float(median1), "group2": float(median2)},
        "effect_size": {
            "rank_biserial_r": float(r),
            "common_language_effect_size": float(cles),
            "interpretation": _interpret_rank_biserial(r)
        },
        "hodges_lehmann": {
            "estimate": float(hl_estimate),
            "ci_lower": float(ci_lower),
            "ci_upper": float(ci_upper)
        },
        "interpretation": _interpret_mann_whitney(p_value, r, cles)
    }

def wilcoxon_signed_rank_test(
    data1: pd.Series,
    data2: pd.Series,
    alternative: str = 'two-sided',
    mode: str = 'auto',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Wilcoxon signed-rank test for paired data.
    
    Args:
        data1: First measurement
        data2: Second measurement
        alternative: 'two-sided', 'less', or 'greater'
        mode: 'auto', 'exact', or 'approx'
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    # Ensure paired data
    paired_data = pd.DataFrame({'data1': data1, 'data2': data2}).dropna()
    
    if len(paired_data) < 1:
        return {"error": "Insufficient paired data"}
    
    # Calculate differences
    differences = paired_data['data1'] - paired_data['data2']
    
    # Remove zero differences
    non_zero_diff = differences[differences != 0]
    n_zeros = len(differences) - len(non_zero_diff)
    
    if len(non_zero_diff) < 1:
        return {"error": "All differences are zero"}
    
    # Perform test
    statistic, p_value = stats.wilcoxon(
        non_zero_diff,
        alternative=alternative,
        mode=mode
    )
    
    # Effect size (matched pairs rank biserial correlation)
    n = len(non_zero_diff)
    r = 1 - (2 * statistic) / (n * (n + 1) / 2)
    
    # Hodges-Lehmann estimator (pseudomedian)
    walsh_averages = []
    diff_array = non_zero_diff.values
    for i in range(len(diff_array)):
        for j in range(i, len(diff_array)):
            walsh_averages.append((diff_array[i] + diff_array[j]) / 2)
    
    pseudomedian = np.median(walsh_averages)
    
    return {
        "test_type": "Wilcoxon signed-rank test",
        "alternative": alternative,
        "statistic": float(statistic),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "n_pairs": len(paired_data),
        "n_zero_differences": n_zeros,
        "median_difference": float(differences.median()),
        "pseudomedian": float(pseudomedian),
        "effect_size": {
            "rank_biserial_r": float(r),
            "interpretation": _interpret_rank_biserial(r)
        },
        "interpretation": _interpret_wilcoxon(p_value, r)
    }

def kruskal_wallis_test(
    data: pd.DataFrame,
    group_column: str,
    value_column: str,
    alpha: float = 0.05,
    post_hoc: bool = True
) -> Dict[str, Any]:
    """
    Perform Kruskal-Wallis H test for multiple groups.
    
    Args:
        data: DataFrame with group and value columns
        group_column: Column containing group labels
        value_column: Column containing values
        alpha: Significance level
        post_hoc: Perform post-hoc tests if significant
        
    Returns:
        Dictionary with test results
    """
    # Prepare data
    clean_data = data[[group_column, value_column]].dropna()
    groups = clean_data[group_column].unique()
    
    if len(groups) < 2:
        return {"error": "Need at least 2 groups"}
    
    # Get group data
    group_data = [group_df[value_column].values 
                  for _, group_df in clean_data.groupby(group_column)]
    
    # Perform test
    h_stat, p_value = stats.kruskal(*group_data)
    
    # Effect size (epsilon squared)
    n = len(clean_data)
    k = len(groups)
    epsilon_squared = (h_stat - k + 1) / (n - k)
    epsilon_squared = max(0, epsilon_squared)  # Can't be negative
    
    # Group medians and ranks
    group_stats = {}
    ranks = stats.rankdata(clean_data[value_column])
    clean_data['ranks'] = ranks
    
    for group in groups:
        group_mask = clean_data[group_column] == group
        group_stats[str(group)] = {
            "n": int(group_mask.sum()),
            "median": float(clean_data[group_mask][value_column].median()),
            "mean_rank": float(clean_data[group_mask]['ranks'].mean())
        }
    
    result = {
        "test_type": "Kruskal-Wallis H test",
        "h_statistic": float(h_stat),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "degrees_of_freedom": k - 1,
        "n_groups": k,
        "total_n": n,
        "effect_size": {
            "epsilon_squared": float(epsilon_squared),
            "interpretation": _interpret_epsilon_squared(epsilon_squared)
        },
        "group_statistics": group_stats
    }
    
    # Post-hoc tests if significant
    if post_hoc and p_value < alpha and k > 2:
        result["post_hoc"] = _dunn_test(clean_data, group_column, value_column, alpha)
    
    return result

def friedman_test(
    data: pd.DataFrame,
    value_columns: List[str],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Friedman test for repeated measures.
    
    Args:
        data: DataFrame with repeated measurements
        value_columns: Columns containing repeated measurements
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    # Prepare data
    clean_data = data[value_columns].dropna()
    
    if len(clean_data) < 2:
        return {"error": "Need at least 2 subjects"}
    
    if len(value_columns) < 2:
        return {"error": "Need at least 2 repeated measurements"}
    
    # Perform test
    chi2_stat, p_value = stats.friedmanchisquare(*[clean_data[col] for col in value_columns])
    
    # Effect size (Kendall's W)
    n = len(clean_data)
    k = len(value_columns)
    
    # Rank within subjects
    ranks = clean_data.rank(axis=1)
    mean_ranks = ranks.mean()
    
    # Kendall's W
    ss_ranks = sum((mean_rank - (k + 1) / 2) ** 2 for mean_rank in mean_ranks)
    w = 12 * ss_ranks / (k * n * (k + 1))
    
    # Medians
    medians = {col: float(clean_data[col].median()) for col in value_columns}
    
    result = {
        "test_type": "Friedman test",
        "chi2_statistic": float(chi2_stat),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "degrees_of_freedom": k - 1,
        "n_subjects": n,
        "n_conditions": k,
        "effect_size": {
            "kendalls_w": float(w),
            "interpretation": _interpret_kendalls_w(w)
        },
        "medians": medians,
        "mean_ranks": {col: float(mean_ranks[col]) for col in value_columns}
    }
    
    # Post-hoc tests if significant
    if p_value < alpha and k > 2:
        result["post_hoc"] = _nemenyi_test(clean_data, value_columns, alpha)
    
    return result

def runs_test(
    data: pd.Series,
    cutoff: Optional[float] = None,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform runs test for randomness.
    
    Args:
        data: Series of values
        cutoff: Cutoff value (median if None)
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    clean_data = data.dropna()
    
    if len(clean_data) < 2:
        return {"error": "Need at least 2 observations"}
    
    # Use median as cutoff if not provided
    if cutoff is None:
        cutoff = clean_data.median()
    
    # Convert to binary
    binary = (clean_data > cutoff).astype(int)
    
    # Count runs
    runs = 1
    for i in range(1, len(binary)):
        if binary.iloc[i] != binary.iloc[i-1]:
            runs += 1
    
    # Count values above and below cutoff
    n1 = (binary == 1).sum()
    n2 = (binary == 0).sum()
    
    if n1 == 0 or n2 == 0:
        return {"error": "All values on one side of cutoff"}
    
    # Expected runs and variance
    expected_runs = (2 * n1 * n2) / (n1 + n2) + 1
    
    if n1 + n2 > 20:
        # Normal approximation
        var_runs = (2 * n1 * n2 * (2 * n1 * n2 - n1 - n2)) / \
                  ((n1 + n2) ** 2 * (n1 + n2 - 1))
        
        # Z-statistic
        z_stat = (runs - expected_runs) / np.sqrt(var_runs)
        p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))
        
        result_type = "large sample approximation"
    else:
        # Exact test would be needed for small samples
        # Using approximation
        result_type = "small sample (approximation)"
        z_stat = None
        p_value = None  # Would need exact distribution
    
    return {
        "test_type": "Runs test",
        "cutoff": float(cutoff),
        "n_runs": runs,
        "expected_runs": float(expected_runs),
        "n_above": n1,
        "n_below": n2,
        "z_statistic": float(z_stat) if z_stat else None,
        "p_value": float(p_value) if p_value else None,
        "significant": p_value < alpha if p_value else None,
        "alpha": alpha,
        "result_type": result_type,
        "interpretation": _interpret_runs_test(runs, expected_runs)
    }

def kolmogorov_smirnov_test(
    data1: pd.Series,
    data2: Union[pd.Series, str] = 'norm',
    args: tuple = (),
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Kolmogorov-Smirnov test.
    
    Args:
        data1: First sample
        data2: Second sample or distribution name
        args: Parameters for theoretical distribution
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    clean_data1 = data1.dropna()
    
    if len(clean_data1) < 2:
        return {"error": "Need at least 2 observations"}
    
    if isinstance(data2, str):
        # One-sample KS test
        if data2 == 'norm' and not args:
            args = (clean_data1.mean(), clean_data1.std())
        
        d_stat, p_value = stats.kstest(clean_data1, data2, args=args)
        test_type = f"One-sample KS test ({data2} distribution)"
        
        result = {
            "sample_size": len(clean_data1),
            "distribution": data2,
            "parameters": args
        }
    else:
        # Two-sample KS test
        clean_data2 = data2.dropna()
        
        if len(clean_data2) < 2:
            return {"error": "Second sample needs at least 2 observations"}
        
        d_stat, p_value = stats.ks_2samp(clean_data1, clean_data2)
        test_type = "Two-sample KS test"
        
        result = {
            "sample_sizes": {
                "sample1": len(clean_data1),
                "sample2": len(clean_data2)
            }
        }
    
    result.update({
        "test_type": test_type,
        "d_statistic": float(d_stat),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "interpretation": _interpret_ks_test(d_stat, p_value)
    })
    
    return result

def anderson_darling_test(
    data: pd.Series,
    dist: str = 'norm'
) -> Dict[str, Any]:
    """
    Perform Anderson-Darling test.
    
    Args:
        data: Sample data
        dist: Distribution to test ('norm', 'expon', 'logistic', 'gumbel', 'extreme1')
        
    Returns:
        Dictionary with test results
    """
    clean_data = data.dropna()
    
    if len(clean_data) < 8:
        return {"error": "Need at least 8 observations for Anderson-Darling test"}
    
    # Perform test
    result = stats.anderson(clean_data, dist=dist)
    
    # Interpret results
    interpretations = []
    for i, (sl, cv) in enumerate(zip(result.significance_level, result.critical_values)):
        if result.statistic < cv:
            interpretations.append(f"Not significant at {sl}% level")
        else:
            interpretations.append(f"Significant at {sl}% level")
    
    return {
        "test_type": "Anderson-Darling test",
        "distribution": dist,
        "statistic": float(result.statistic),
        "critical_values": {
            f"{sl}%": float(cv) 
            for sl, cv in zip(result.significance_level, result.critical_values)
        },
        "significance_levels": result.significance_level.tolist(),
        "interpretations": interpretations,
        "sample_size": len(clean_data)
    }

def shapiro_wilk_test(
    data: pd.Series,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Shapiro-Wilk test for normality.
    
    Args:
        data: Sample data
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    clean_data = data.dropna()
    
    if len(clean_data) < 3:
        return {"error": "Need at least 3 observations"}
    
    if len(clean_data) > 5000:
        warnings.warn("Shapiro-Wilk test may be inaccurate for n > 5000")
    
    # Perform test
    w_stat, p_value = stats.shapiro(clean_data)
    
    return {
        "test_type": "Shapiro-Wilk test",
        "w_statistic": float(w_stat),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "sample_size": len(clean_data),
        "interpretation": "Data is normally distributed" if p_value > alpha 
                        else "Data is not normally distributed",
        "recommendation": _get_normality_recommendation(p_value, len(clean_data))
    }

def mood_median_test(
    *samples,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Mood's median test.
    
    Args:
        *samples: Variable number of samples
        alpha: Significance level
        
    Returns:
        Dictionary with test results
    """
    if len(samples) < 2:
        return {"error": "Need at least 2 samples"}
    
    # Clean samples
    clean_samples = []
    for i, sample in enumerate(samples):
        if isinstance(sample, pd.Series):
            clean = sample.dropna()
        else:
            clean = pd.Series(sample).dropna()
        
        if len(clean) < 1:
            return {"error": f"Sample {i+1} is empty after removing NaN"}
        
        clean_samples.append(clean)
    
    # Perform test
    stat, p_value, grand_median, contingency_table = stats.median_test(*clean_samples)
    
    # Effect size (Cramér's V)
    n = sum(len(s) for s in clean_samples)
    k = len(clean_samples)
    v = np.sqrt(stat / (n * (min(2, k) - 1)))
    
    # Sample medians
    sample_medians = [float(s.median()) for s in clean_samples]
    
    return {
        "test_type": "Mood's median test",
        "chi2_statistic": float(stat),
        "p_value": float(p_value),
        "significant": p_value < alpha,
        "alpha": alpha,
        "grand_median": float(grand_median),
        "sample_medians": sample_medians,
        "contingency_table": contingency_table.tolist(),
        "effect_size": {
            "cramers_v": float(v),
            "interpretation": _interpret_cramers_v_simple(v)
        },
        "n_samples": k,
        "total_n": n
    }

# Helper functions

def _interpret_rank_biserial(r: float) -> str:
    """Interpret rank biserial correlation."""
    r = abs(r)
    if r < 0.1:
        return "negligible effect"
    elif r < 0.3:
        return "small effect"
    elif r < 0.5:
        return "medium effect"
    else:
        return "large effect"

def _interpret_mann_whitney(p_value: float, r: float, cles: float) -> str:
    """Interpret Mann-Whitney results."""
    if p_value < 0.05:
        effect = _interpret_rank_biserial(r)
        prob = int(cles * 100)
        return f"Significant difference with {effect}. Probability that a random value from group 1 exceeds group 2: {prob}%"
    else:
        return "No significant difference between groups"

def _interpret_wilcoxon(p_value: float, r: float) -> str:
    """Interpret Wilcoxon results."""
    if p_value < 0.05:
        effect = _interpret_rank_biserial(r)
        return f"Significant difference between paired observations with {effect}"
    else:
        return "No significant difference between paired observations"

def _interpret_epsilon_squared(eps2: float) -> str:
    """Interpret epsilon squared."""
    if eps2 < 0.01:
        return "negligible effect"
    elif eps2 < 0.06:
        return "small effect"
    elif eps2 < 0.14:
        return "medium effect"
    else:
        return "large effect"

def _interpret_kendalls_w(w: float) -> str:
    """Interpret Kendall's W."""
    if w < 0.1:
        return "very weak agreement"
    elif w < 0.3:
        return "weak agreement"
    elif w < 0.5:
        return "moderate agreement"
    elif w < 0.7:
        return "strong agreement"
    else:
        return "very strong agreement"

def _interpret_runs_test(runs: int, expected: float) -> str:
    """Interpret runs test."""
    if abs(runs - expected) < 1:
        return "Data appears random"
    elif runs < expected:
        return "Fewer runs than expected - possible clustering"
    else:
        return "More runs than expected - possible alternation"

def _interpret_ks_test(d_stat: float, p_value: float) -> str:
    """Interpret KS test."""
    if p_value < 0.05:
        return f"Distributions are significantly different (D={d_stat:.3f})"
    else:
        return f"No significant difference between distributions (D={d_stat:.3f})"

def _interpret_cramers_v_simple(v: float) -> str:
    """Simple interpretation of Cramér's V."""
    if v < 0.1:
        return "negligible association"
    elif v < 0.3:
        return "weak association"
    elif v < 0.5:
        return "moderate association"
    else:
        return "strong association"

def _get_normality_recommendation(p_value: float, n: int) -> str:
    """Get recommendation based on normality test."""
    if p_value > 0.05:
        return "Data appears normally distributed. Parametric tests are appropriate."
    else:
        if n < 30:
            return "Data is not normally distributed. Consider non-parametric tests."
        else:
            return "Data is not normally distributed, but sample size is large. Consider robust methods or transformations."

def _dunn_test(data: pd.DataFrame, group_col: str, value_col: str, alpha: float) -> Dict[str, Any]:
    """Perform Dunn's post-hoc test after Kruskal-Wallis."""
    # This is a simplified version
    groups = data[group_col].unique()
    comparisons = []
    
    # Would implement full Dunn's test with proper p-value adjustment
    # Using pairwise Mann-Whitney as approximation
    
    for i, g1 in enumerate(groups):
        for j, g2 in enumerate(groups[i+1:], i+1):
            data1 = data[data[group_col] == g1][value_col]
            data2 = data[data[group_col] == g2][value_col]
            
            _, p_value = stats.mannwhitneyu(data1, data2)
            
            comparisons.append({
                "group1": str(g1),
                "group2": str(g2),
                "p_value": float(p_value),
                "adjusted_p": float(min(p_value * len(groups) * (len(groups) - 1) / 2, 1.0))
            })
    
    return {
        "method": "Dunn's test (approximation)",
        "comparisons": comparisons,
        "note": "Using Bonferroni adjustment"
    }

def _nemenyi_test(data: pd.DataFrame, columns: List[str], alpha: float) -> Dict[str, Any]:
    """Perform Nemenyi post-hoc test after Friedman."""
    # Simplified version
    k = len(columns)
    n = len(data)
    
    # Critical value (would use studentized range distribution)
    q_critical = 2.394  # Approximate for alpha=0.05, k=3
    
    # Standard error
    se = np.sqrt(k * (k + 1) / (6 * n))
    
    # Critical difference
    cd = q_critical * se
    
    # Mean ranks
    ranks = data[columns].rank(axis=1)
    mean_ranks = ranks.mean()
    
    comparisons = []
    for i, col1 in enumerate(columns):
        for j, col2 in enumerate(columns[i+1:], i+1):
            rank_diff = abs(mean_ranks[col1] - mean_ranks[col2])
            comparisons.append({
                "condition1": col1,
                "condition2": col2,
                "mean_rank_diff": float(rank_diff),
                "critical_difference": float(cd),
                "significant": rank_diff > cd
            })
    
    return {
        "method": "Nemenyi test",
        "comparisons": comparisons,
        "critical_difference": float(cd)
    }