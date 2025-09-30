"""
Statistical power analysis and sample size calculations.
"""

import numpy as np
try:
    from scipy import stats
    SCIPY_AVAILABLE = True
except ImportError:
    print("Warning: scipy not available. Some power analysis functions will be limited.")
    stats = None
    SCIPY_AVAILABLE = False
try:
    from statsmodels.stats.power import (
        TTestPower, TTestIndPower, AnovaPower,
        NormalIndPower, GofChisquarePower
    )
    ANOVA_POWER_AVAILABLE = True
except ImportError:
    try:
        # Try fallback import without AnovaPower
        from statsmodels.stats.power import (
            TTestPower, TTestIndPower,
            NormalIndPower, GofChisquarePower
        )
        AnovaPower = None
        ANOVA_POWER_AVAILABLE = False
    except ImportError:
        # Complete fallback - create mock classes
        print("Warning: statsmodels.stats.power not available. Power analysis will be limited.")
        TTestPower = TTestIndPower = AnovaPower = None
        NormalIndPower = GofChisquarePower = None
        ANOVA_POWER_AVAILABLE = False
from typing import Dict, Any, Optional, Union

def calculate_sample_size_t_test(
    effect_size: float,
    alpha: float = 0.05,
    power: float = 0.80,
    test_type: str = 'two-sample',
    alternative: str = 'two-sided',
    ratio: float = 1.0
) -> Dict[str, Any]:
    """
    Calculate sample size for t-tests.
    
    Args:
        effect_size: Cohen's d effect size
        alpha: Type I error rate
        power: Desired statistical power
        test_type: 'two-sample', 'paired', or 'one-sample'
        alternative: 'two-sided', 'larger', or 'smaller'
        ratio: Ratio of sample sizes (for two-sample)
        
    Returns:
        Dictionary with sample size calculations
    """
    if test_type == 'two-sample':
        analysis = TTestIndPower()
        n = analysis.solve_power(
            effect_size=effect_size,
            alpha=alpha,
            power=power,
            ratio=ratio,
            alternative=alternative
        )
        
        n1 = int(np.ceil(n))
        n2 = int(np.ceil(n * ratio))
        total_n = n1 + n2
        
        result = {
            "test_type": "Independent samples t-test",
            "group1_size": n1,
            "group2_size": n2,
            "total_sample_size": total_n,
            "ratio": ratio
        }
        
    elif test_type == 'paired':
        analysis = TTestPower()
        n = analysis.solve_power(
            effect_size=effect_size,
            alpha=alpha,
            power=power,
            alternative=alternative
        )
        
        n_pairs = int(np.ceil(n))
        
        result = {
            "test_type": "Paired t-test",
            "n_pairs": n_pairs,
            "total_observations": n_pairs * 2
        }
        
    elif test_type == 'one-sample':
        analysis = TTestPower()
        n = analysis.solve_power(
            effect_size=effect_size,
            alpha=alpha,
            power=power,
            alternative=alternative
        )
        
        result = {
            "test_type": "One-sample t-test",
            "sample_size": int(np.ceil(n))
        }
    
    else:
        return {"error": f"Unknown test type: {test_type}"}
    
    # Add common information
    result.update({
        "effect_size": effect_size,
        "alpha": alpha,
        "power": power,
        "alternative": alternative,
        "effect_size_interpretation": _interpret_cohens_d(effect_size),
        "recommendation": _get_sample_size_recommendation(result)
    })
    
    return result

def calculate_sample_size_anova(
    effect_size: float,
    n_groups: int,
    alpha: float = 0.05,
    power: float = 0.80
) -> Dict[str, Any]:
    """
    Calculate sample size for one-way ANOVA.
    
    Args:
        effect_size: Cohen's f effect size
        n_groups: Number of groups
        alpha: Type I error rate
        power: Desired statistical power
        
    Returns:
        Dictionary with sample size calculations
    """
    if n_groups < 2:
        return {"error": "Need at least 2 groups for ANOVA"}
    
    if not ANOVA_POWER_AVAILABLE or AnovaPower is None:
        # Fallback calculation using manual formula
        # This is an approximation when AnovaPower is not available
        n_per_group = int(np.ceil(_estimate_anova_sample_size(effect_size, n_groups, alpha, power)))
    else:
        analysis = AnovaPower()
        n = analysis.solve_power(
            effect_size=effect_size,
            k_groups=n_groups,
            alpha=alpha,
            power=power
        )
        n_per_group = int(np.ceil(n))
    total_n = n_per_group * n_groups
    
    return {
        "test_type": "One-way ANOVA",
        "n_groups": n_groups,
        "n_per_group": n_per_group,
        "total_sample_size": total_n,
        "effect_size": effect_size,
        "effect_size_interpretation": _interpret_cohens_f(effect_size),
        "alpha": alpha,
        "power": power,
        "degrees_of_freedom": {
            "between": n_groups - 1,
            "within": total_n - n_groups
        },
        "recommendation": f"Aim for at least {n_per_group} observations per group"
    }

def calculate_sample_size_proportion(
    p1: float,
    p2: float,
    alpha: float = 0.05,
    power: float = 0.80,
    alternative: str = 'two-sided',
    ratio: float = 1.0
) -> Dict[str, Any]:
    """
    Calculate sample size for comparing two proportions.
    
    Args:
        p1: Proportion in group 1
        p2: Proportion in group 2
        alpha: Type I error rate
        power: Desired statistical power
        alternative: 'two-sided', 'larger', or 'smaller'
        ratio: Ratio of sample sizes
        
    Returns:
        Dictionary with sample size calculations
    """
    # Calculate effect size (Cohen's h)
    h = 2 * (np.arcsin(np.sqrt(p1)) - np.arcsin(np.sqrt(p2)))
    
    analysis = NormalIndPower()
    n = analysis.solve_power(
        effect_size=abs(h),
        alpha=alpha,
        power=power,
        ratio=ratio,
        alternative=alternative
    )
    
    n1 = int(np.ceil(n))
    n2 = int(np.ceil(n * ratio))
    
    return {
        "test_type": "Two-proportion z-test",
        "proportion1": p1,
        "proportion2": p2,
        "effect_size_h": float(h),
        "group1_size": n1,
        "group2_size": n2,
        "total_sample_size": n1 + n2,
        "alpha": alpha,
        "power": power,
        "alternative": alternative,
        "absolute_difference": abs(p1 - p2),
        "relative_risk": p1/p2 if p2 > 0 else None,
        "odds_ratio": (p1/(1-p1))/(p2/(1-p2)) if p2 > 0 and p2 < 1 else None
    }

def calculate_sample_size_correlation(
    r: float,
    alpha: float = 0.05,
    power: float = 0.80,
    alternative: str = 'two-sided'
) -> Dict[str, Any]:
    """
    Calculate sample size for correlation test.
    
    Args:
        r: Expected correlation coefficient
        alpha: Type I error rate
        power: Desired statistical power
        alternative: 'two-sided', 'greater', or 'less'
        
    Returns:
        Dictionary with sample size calculation
    """
    # Fisher's z transformation
    z_r = 0.5 * np.log((1 + r) / (1 - r))
    
    # Calculate required n
    if alternative == 'two-sided':
        z_alpha = stats.norm.ppf(1 - alpha/2)
    else:
        z_alpha = stats.norm.ppf(1 - alpha)
    
    z_beta = stats.norm.ppf(power)
    
    n = ((z_alpha + z_beta) / z_r) ** 2 + 3
    n_required = int(np.ceil(n))
    
    return {
        "test_type": "Correlation test",
        "correlation": r,
        "sample_size": n_required,
        "alpha": alpha,
        "power": power,
        "alternative": alternative,
        "correlation_interpretation": _interpret_correlation(r),
        "minimum_detectable_r": _calculate_minimum_detectable_correlation(
            n_required, alpha, power, alternative
        )
    }

def calculate_power_t_test(
    n: Union[int, tuple],
    effect_size: float,
    alpha: float = 0.05,
    test_type: str = 'two-sample',
    alternative: str = 'two-sided'
) -> Dict[str, Any]:
    """
    Calculate statistical power for t-tests.
    
    Args:
        n: Sample size(s)
        effect_size: Cohen's d
        alpha: Type I error rate
        test_type: Type of t-test
        alternative: Alternative hypothesis
        
    Returns:
        Dictionary with power calculation
    """
    if test_type == 'two-sample':
        if isinstance(n, tuple):
            n1, n2 = n
            ratio = n2 / n1
            n_harmonic = 2 * n1 * n2 / (n1 + n2)
        else:
            n1 = n2 = n
            ratio = 1.0
            n_harmonic = n
        
        analysis = TTestIndPower()
        power = analysis.power(
            effect_size=effect_size,
            nobs1=n1,
            ratio=ratio,
            alpha=alpha,
            alternative=alternative
        )
        
        result = {
            "test_type": "Independent samples t-test",
            "group1_size": n1,
            "group2_size": n2,
            "effective_n": n_harmonic
        }
        
    else:  # paired or one-sample
        if isinstance(n, tuple):
            n = n[0]
        
        analysis = TTestPower()
        power = analysis.power(
            effect_size=effect_size,
            nobs=n,
            alpha=alpha,
            alternative=alternative
        )
        
        result = {
            "test_type": f"{test_type} t-test",
            "sample_size": n
        }
    
    result.update({
        "power": float(power),
        "effect_size": effect_size,
        "alpha": alpha,
        "alternative": alternative,
        "interpretation": _interpret_power(power),
        "type_ii_error": 1 - power
    })
    
    return result

def calculate_power_anova(
    n_per_group: int,
    effect_size: float,
    n_groups: int,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Calculate statistical power for ANOVA.
    
    Args:
        n_per_group: Sample size per group
        effect_size: Cohen's f
        n_groups: Number of groups
        alpha: Type I error rate
        
    Returns:
        Dictionary with power calculation
    """
    if not ANOVA_POWER_AVAILABLE or AnovaPower is None:
        # Fallback power calculation
        power = _estimate_anova_power(n_per_group, effect_size, n_groups, alpha)
    else:
        analysis = AnovaPower()
        power = analysis.power(
            effect_size=effect_size,
            nobs=n_per_group * n_groups,
            k_groups=n_groups,
            alpha=alpha
        )
    
    return {
        "test_type": "One-way ANOVA",
        "n_groups": n_groups,
        "n_per_group": n_per_group,
        "total_n": n_per_group * n_groups,
        "power": float(power),
        "effect_size": effect_size,
        "alpha": alpha,
        "interpretation": _interpret_power(power),
        "minimum_detectable_effect": _calculate_minimum_detectable_effect_anova(
            n_per_group, n_groups, alpha, 0.80
        )
    }

def calculate_effect_size_needed(
    n: Union[int, tuple],
    alpha: float = 0.05,
    power: float = 0.80,
    test_type: str = 'two-sample'
) -> Dict[str, Any]:
    """
    Calculate minimum detectable effect size.
    
    Args:
        n: Sample size(s)
        alpha: Type I error rate
        power: Desired power
        test_type: Type of test
        
    Returns:
        Dictionary with minimum effect size
    """
    if test_type == 'two-sample':
        if isinstance(n, tuple):
            n1, n2 = n
            ratio = n2 / n1
        else:
            n1 = n2 = n
            ratio = 1.0
        
        analysis = TTestIndPower()
        effect_size = analysis.solve_power(
            nobs1=n1,
            ratio=ratio,
            alpha=alpha,
            power=power
        )
        
        result = {
            "test_type": "Independent samples t-test",
            "group1_size": n1,
            "group2_size": n2
        }
        
    else:
        if isinstance(n, tuple):
            n = n[0]
        
        analysis = TTestPower()
        effect_size = analysis.solve_power(
            nobs=n,
            alpha=alpha,
            power=power
        )
        
        result = {
            "test_type": f"{test_type} t-test",
            "sample_size": n
        }
    
    result.update({
        "minimum_effect_size": float(effect_size),
        "effect_size_interpretation": _interpret_cohens_d(effect_size),
        "alpha": alpha,
        "power": power,
        "practical_significance": _assess_practical_significance(effect_size)
    })
    
    return result

def post_hoc_power_analysis(
    observed_effect: float,
    n: Union[int, tuple],
    alpha: float = 0.05,
    test_type: str = 'two-sample'
) -> Dict[str, Any]:
    """
    Perform post-hoc power analysis.
    
    Args:
        observed_effect: Observed effect size
        n: Sample size(s) used
        alpha: Type I error rate used
        test_type: Type of test performed
        
    Returns:
        Dictionary with post-hoc power
    """
    # Calculate achieved power
    power_result = calculate_power_t_test(
        n=n,
        effect_size=observed_effect,
        alpha=alpha,
        test_type=test_type
    )
    
    # Calculate sample size needed for adequate power
    if power_result['power'] < 0.80:
        size_needed = calculate_sample_size_t_test(
            effect_size=observed_effect,
            alpha=alpha,
            power=0.80,
            test_type=test_type
        )
    else:
        size_needed = None
    
    result = {
        "observed_effect_size": observed_effect,
        "achieved_power": power_result['power'],
        "interpretation": power_result['interpretation'],
        "sufficient_power": power_result['power'] >= 0.80
    }
    
    if size_needed:
        result["sample_size_for_80_power"] = size_needed
        result["recommendation"] = f"Study was underpowered. Would need {size_needed.get('total_sample_size', size_needed.get('sample_size'))} for 80% power."
    else:
        result["recommendation"] = "Study had adequate power to detect the observed effect."
    
    return result

# Helper functions

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

def _interpret_cohens_f(f: float) -> str:
    """Interpret Cohen's f effect size."""
    if f < 0.1:
        return "negligible"
    elif f < 0.25:
        return "small"
    elif f < 0.4:
        return "medium"
    else:
        return "large"

def _interpret_correlation(r: float) -> str:
    """Interpret correlation coefficient."""
    r = abs(r)
    if r < 0.1:
        return "negligible"
    elif r < 0.3:
        return "weak"
    elif r < 0.5:
        return "moderate"
    elif r < 0.7:
        return "strong"
    else:
        return "very strong"

def _interpret_power(power: float) -> str:
    """Interpret statistical power."""
    if power < 0.5:
        return "very low power - high risk of Type II error"
    elif power < 0.7:
        return "low power - moderate risk of Type II error"
    elif power < 0.8:
        return "marginal power - consider increasing sample size"
    elif power < 0.9:
        return "adequate power"
    else:
        return "excellent power"

def _get_sample_size_recommendation(result: Dict[str, Any]) -> str:
    """Get recommendation based on sample size calculation."""
    effect_interp = result.get('effect_size_interpretation', '')
    
    if 'negligible' in effect_interp:
        return "Very large sample size due to small effect. Consider if effect is practically meaningful."
    elif 'large' in effect_interp:
        return "Relatively small sample size needed due to large effect size."
    else:
        return f"Sample size based on {effect_interp} effect size and {result['power']} power."

def _calculate_minimum_detectable_correlation(
    n: int, alpha: float, power: float, alternative: str
) -> float:
    """Calculate minimum detectable correlation."""
    if alternative == 'two-sided':
        z_alpha = stats.norm.ppf(1 - alpha/2)
    else:
        z_alpha = stats.norm.ppf(1 - alpha)
    
    z_beta = stats.norm.ppf(power)
    
    z_r = (z_alpha + z_beta) / np.sqrt(n - 3)
    r = (np.exp(2 * z_r) - 1) / (np.exp(2 * z_r) + 1)
    
    return float(r)

def _calculate_minimum_detectable_effect_anova(
    n_per_group: int, n_groups: int, alpha: float, power: float
) -> float:
    """Calculate minimum detectable effect for ANOVA."""
    if not ANOVA_POWER_AVAILABLE or AnovaPower is None:
        # Fallback calculation - rough approximation
        total_n = n_per_group * n_groups
        df1 = n_groups - 1
        df2 = total_n - n_groups
        
        # Very rough approximation based on sample size
        effect_size = max(0.1, 1.0 / np.sqrt(total_n / 10))
        return float(effect_size)
    else:
        analysis = AnovaPower()
        effect_size = analysis.solve_power(
            nobs=n_per_group * n_groups,
            k_groups=n_groups,
            alpha=alpha,
            power=power
        )
        return float(effect_size)

def _assess_practical_significance(effect_size: float) -> str:
    """Assess practical significance of effect size."""
    interp = _interpret_cohens_d(effect_size)
    
    if interp == "negligible":
        return "Effect may not be practically meaningful even if statistically significant"
    elif interp == "small":
        return "Small effect - consider practical importance in context"
    elif interp == "medium":
        return "Medium effect - likely practically meaningful"
    else:
        return "Large effect - likely highly practically meaningful"

def _estimate_anova_sample_size(effect_size: float, n_groups: int, alpha: float, power: float) -> float:
    """
    Estimate ANOVA sample size using approximation when AnovaPower is not available.
    
    This is a simplified approximation based on the F-distribution.
    """
    # This is a rough approximation - for exact calculations, use statsmodels when available
    from scipy.stats import f
    
    # Degrees of freedom
    df1 = n_groups - 1
    
    # Critical F value
    f_crit = f.ppf(1 - alpha, df1, np.inf)
    
    # Approximate sample size calculation
    # This is a simplified version - the exact formula is more complex
    delta = effect_size * np.sqrt(n_groups)
    z_alpha = stats.norm.ppf(1 - alpha)
    z_beta = stats.norm.ppf(power)
    
    n_approx = ((z_alpha + z_beta) / effect_size) ** 2
    
    # Adjustment for multiple groups
    n_per_group = max(5, n_approx / n_groups)
    
    return n_per_group

def _estimate_anova_power(n_per_group: int, effect_size: float, n_groups: int, alpha: float) -> float:
    """
    Estimate ANOVA power using approximation when AnovaPower is not available.
    
    This is a simplified approximation based on the F-distribution.
    """
    # This is a rough approximation - for exact calculations, use statsmodels when available
    from scipy.stats import f, ncf
    
    total_n = n_per_group * n_groups
    df1 = n_groups - 1
    df2 = total_n - n_groups
    
    # Non-centrality parameter
    ncp = effect_size ** 2 * total_n
    
    # Critical F value
    f_crit = f.ppf(1 - alpha, df1, df2)
    
    # Power approximation using non-central F distribution
    try:
        power = 1 - ncf.cdf(f_crit, df1, df2, ncp)
        return max(0.0, min(1.0, power))  # Ensure power is between 0 and 1
    except:
        # Fallback to very rough approximation
        return min(0.95, max(0.05, (total_n - 10) / 100))  # Very rough estimate