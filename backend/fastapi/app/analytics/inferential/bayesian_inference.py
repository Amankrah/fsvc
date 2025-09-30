"""
Bayesian inference methods for research data.
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List, Optional, Union, Tuple
import warnings

def bayesian_t_test(
    data1: pd.Series,
    data2: pd.Series,
    prior_mean: float = 0,
    prior_variance: float = 1,
    credible_level: float = 0.95
) -> Dict[str, Any]:
    """
    Perform Bayesian t-test using conjugate priors.
    
    Args:
        data1: First sample
        data2: Second sample
        prior_mean: Prior mean for effect size
        prior_variance: Prior variance for effect size
        credible_level: Credible interval level
        
    Returns:
        Dictionary with Bayesian t-test results
    """
    # Clean data
    data1_clean = data1.dropna()
    data2_clean = data2.dropna()
    
    n1, n2 = len(data1_clean), len(data2_clean)
    
    if n1 < 2 or n2 < 2:
        return {"error": "Need at least 2 observations per group"}
    
    # Calculate sample statistics
    mean1, var1 = data1_clean.mean(), data1_clean.var(ddof=1)
    mean2, var2 = data2_clean.mean(), data2_clean.var(ddof=1)
    
    # Pooled variance
    pooled_var = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
    pooled_sd = np.sqrt(pooled_var)
    
    # Effect size
    observed_d = (mean1 - mean2) / pooled_sd
    
    # Posterior for effect size (using conjugate normal prior)
    se_d = np.sqrt(1/n1 + 1/n2)
    
    # Update prior with data
    posterior_precision = 1/prior_variance + 1/(se_d**2)
    posterior_variance = 1/posterior_precision
    posterior_mean = (prior_mean/prior_variance + observed_d/(se_d**2)) / posterior_precision
    posterior_sd = np.sqrt(posterior_variance)
    
    # Credible interval
    alpha = 1 - credible_level
    ci_lower = posterior_mean + stats.norm.ppf(alpha/2) * posterior_sd
    ci_upper = posterior_mean + stats.norm.ppf(1 - alpha/2) * posterior_sd
    
    # Bayes factor (Savage-Dickey ratio)
    prior_density_at_zero = stats.norm.pdf(0, prior_mean, np.sqrt(prior_variance))
    posterior_density_at_zero = stats.norm.pdf(0, posterior_mean, posterior_sd)
    bf_01 = posterior_density_at_zero / prior_density_at_zero
    bf_10 = 1 / bf_01
    
    # Probability of direction
    if posterior_mean > 0:
        p_direction = 1 - stats.norm.cdf(0, posterior_mean, posterior_sd)
    else:
        p_direction = stats.norm.cdf(0, posterior_mean, posterior_sd)
    
    # ROPE (Region of Practical Equivalence)
    rope_low, rope_high = -0.1, 0.1  # Small effect size bounds
    p_rope = stats.norm.cdf(rope_high, posterior_mean, posterior_sd) - \
             stats.norm.cdf(rope_low, posterior_mean, posterior_sd)
    
    return {
        "test_type": "Bayesian t-test",
        "observed_effect_size": float(observed_d),
        "posterior": {
            "mean": float(posterior_mean),
            "sd": float(posterior_sd),
            "credible_interval": {
                "lower": float(ci_lower),
                "upper": float(ci_upper),
                "level": credible_level
            }
        },
        "bayes_factor": {
            "bf_10": float(bf_10),
            "bf_01": float(bf_01),
            "interpretation": _interpret_bayes_factor(bf_10)
        },
        "probability_direction": float(p_direction),
        "probability_rope": float(p_rope),
        "sample_sizes": {"n1": n1, "n2": n2},
        "interpretation": _interpret_bayesian_test(bf_10, p_direction, p_rope)
    }

def bayesian_proportion_test(
    successes1: int,
    n1: int,
    successes2: int,
    n2: int,
    prior_alpha: float = 1,
    prior_beta: float = 1,
    credible_level: float = 0.95
) -> Dict[str, Any]:
    """
    Bayesian test for difference in proportions.
    
    Args:
        successes1: Successes in group 1
        n1: Total in group 1
        successes2: Successes in group 2
        n2: Total in group 2
        prior_alpha: Beta prior alpha parameter
        prior_beta: Beta prior beta parameter
        credible_level: Credible interval level
        
    Returns:
        Dictionary with Bayesian proportion test results
    """
    # Posterior parameters (Beta conjugate)
    post_alpha1 = prior_alpha + successes1
    post_beta1 = prior_beta + n1 - successes1
    
    post_alpha2 = prior_alpha + successes2
    post_beta2 = prior_beta + n2 - successes2
    
    # Posterior means
    p1_mean = post_alpha1 / (post_alpha1 + post_beta1)
    p2_mean = post_alpha2 / (post_alpha2 + post_beta2)
    
    # Sample from posteriors
    n_samples = 10000
    p1_samples = np.random.beta(post_alpha1, post_beta1, n_samples)
    p2_samples = np.random.beta(post_alpha2, post_beta2, n_samples)
    
    # Difference in proportions
    diff_samples = p1_samples - p2_samples
    
    # Credible interval for difference
    alpha = 1 - credible_level
    ci_lower = np.percentile(diff_samples, 100 * alpha/2)
    ci_upper = np.percentile(diff_samples, 100 * (1 - alpha/2))
    
    # Probability that p1 > p2
    p_greater = np.mean(diff_samples > 0)
    
    # Bayes factor (using Savage-Dickey for difference = 0)
    # Approximate using kernel density estimation
    from scipy.stats import gaussian_kde
    kde = gaussian_kde(diff_samples)
    posterior_density_at_zero = kde(0)[0]
    
    # Prior density at zero (approximate)
    prior_diff_var = (prior_alpha * prior_beta) / ((prior_alpha + prior_beta)**2 * (prior_alpha + prior_beta + 1))
    prior_density_at_zero = stats.norm.pdf(0, 0, np.sqrt(2 * prior_diff_var))
    
    bf_10 = prior_density_at_zero / posterior_density_at_zero
    
    return {
        "test_type": "Bayesian proportion test",
        "observed_proportions": {
            "p1": successes1 / n1,
            "p2": successes2 / n2,
            "difference": successes1 / n1 - successes2 / n2
        },
        "posterior_proportions": {
            "p1_mean": float(p1_mean),
            "p2_mean": float(p2_mean),
            "difference_mean": float(np.mean(diff_samples))
        },
        "credible_interval_difference": {
            "lower": float(ci_lower),
            "upper": float(ci_upper),
            "level": credible_level
        },
        "probability_p1_greater": float(p_greater),
        "bayes_factor_10": float(bf_10),
        "interpretation": _interpret_proportion_test(p_greater, ci_lower, ci_upper)
    }

def calculate_bayes_factor(
    data: pd.Series,
    null_value: float = 0,
    alternative: str = 'two-sided',
    prior_scale: float = 1
) -> Dict[str, Any]:
    """
    Calculate Bayes factor for one-sample test.
    
    Args:
        data: Sample data
        null_value: Value under null hypothesis
        alternative: 'two-sided', 'greater', or 'less'
        prior_scale: Scale of Cauchy prior
        
    Returns:
        Dictionary with Bayes factor
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 2:
        return {"error": "Need at least 2 observations"}
    
    # Calculate t-statistic
    mean = clean_data.mean()
    se = clean_data.std(ddof=1) / np.sqrt(n)
    t_stat = (mean - null_value) / se
    
    # JZS Bayes factor (Cauchy prior on effect size)
    # This is a simplified approximation
    r = prior_scale
    
    # Calculate BF using Rouder et al. (2009) approximation
    def jzs_bayes_factor(t, n, r):
        """JZS Bayes Factor calculation."""
        df = n - 1
        
        # Integration bounds
        g_values = np.logspace(-10, 10, 1000)
        
        # Likelihood under alternative
        integrand = []
        for g in g_values:
            ncp = np.sqrt(n * g) * t / np.sqrt(df)
            likelihood = stats.nct.pdf(t, df, ncp)
            prior = stats.invgamma.pdf(g, 0.5, scale=r**2/2)
            integrand.append(likelihood * prior)
        
        # Numerical integration
        bf_10 = np.trapz(integrand, g_values) / stats.t.pdf(t, df)
        
        return bf_10
    
    bf_10 = jzs_bayes_factor(abs(t_stat), n, r)
    
    # Adjust for alternative
    if alternative != 'two-sided':
        bf_10 = bf_10 * 2  # Approximate adjustment
    
    return {
        "test_type": "JZS Bayes Factor",
        "null_value": null_value,
        "alternative": alternative,
        "t_statistic": float(t_stat),
        "bayes_factor_10": float(bf_10),
        "bayes_factor_01": float(1 / bf_10),
        "log_bf_10": float(np.log(bf_10)),
        "prior_scale": prior_scale,
        "interpretation": _interpret_bayes_factor(bf_10),
        "sample_size": n
    }

def calculate_posterior_distribution(
    data: pd.Series,
    prior_mean: float = 0,
    prior_sd: float = 10,
    likelihood: str = 'normal'
) -> Dict[str, Any]:
    """
    Calculate posterior distribution parameters.
    
    Args:
        data: Sample data
        prior_mean: Prior mean
        prior_sd: Prior standard deviation
        likelihood: Likelihood function type
        
    Returns:
        Dictionary with posterior parameters
    """
    clean_data = data.dropna()
    n = len(clean_data)
    
    if n < 1:
        return {"error": "No data available"}
    
    if likelihood == 'normal':
        # Conjugate normal-normal model
        sample_mean = clean_data.mean()
        sample_var = clean_data.var(ddof=1)
        
        # Known variance case (using sample variance)
        prior_precision = 1 / prior_sd**2
        data_precision = n / sample_var
        
        # Posterior parameters
        post_precision = prior_precision + data_precision
        post_var = 1 / post_precision
        post_mean = (prior_mean * prior_precision + sample_mean * data_precision) / post_precision
        post_sd = np.sqrt(post_var)
        
        return {
            "likelihood": likelihood,
            "prior": {
                "mean": prior_mean,
                "sd": prior_sd
            },
            "data_summary": {
                "n": n,
                "mean": float(sample_mean),
                "sd": float(np.sqrt(sample_var))
            },
            "posterior": {
                "mean": float(post_mean),
                "sd": float(post_sd),
                "precision": float(post_precision)
            },
            "shrinkage_factor": float(prior_precision / post_precision)
        }
    
    else:
        return {"error": f"Likelihood '{likelihood}' not implemented"}

def calculate_credible_interval(
    posterior_samples: np.ndarray,
    credible_level: float = 0.95,
    method: str = 'hdi'
) -> Dict[str, Any]:
    """
    Calculate credible interval from posterior samples.
    
    Args:
        posterior_samples: Samples from posterior distribution
        credible_level: Credible level
        method: 'hdi' (highest density) or 'eti' (equal-tailed)
        
    Returns:
        Dictionary with credible interval
    """
    if len(posterior_samples) < 100:
        return {"error": "Need at least 100 posterior samples"}
    
    alpha = 1 - credible_level
    
    if method == 'eti':
        # Equal-tailed interval
        lower = np.percentile(posterior_samples, 100 * alpha/2)
        upper = np.percentile(posterior_samples, 100 * (1 - alpha/2))
        
    elif method == 'hdi':
        # Highest density interval
        sorted_samples = np.sort(posterior_samples)
        n = len(sorted_samples)
        interval_width = int(n * credible_level)
        
        # Find narrowest interval
        min_width = np.inf
        best_start = 0
        
        for i in range(n - interval_width):
            width = sorted_samples[i + interval_width] - sorted_samples[i]
            if width < min_width:
                min_width = width
                best_start = i
        
        lower = sorted_samples[best_start]
        upper = sorted_samples[best_start + interval_width]
    
    else:
        return {"error": f"Unknown method: {method}"}
    
    # Point estimates
    mean = np.mean(posterior_samples)
    median = np.median(posterior_samples)
    mode_est = _estimate_mode(posterior_samples)
    
    return {
        "method": method,
        "credible_level": credible_level,
        "interval": {
            "lower": float(lower),
            "upper": float(upper),
            "width": float(upper - lower)
        },
        "point_estimates": {
            "mean": float(mean),
            "median": float(median),
            "mode": float(mode_est)
        },
        "contains_zero": lower <= 0 <= upper
    }

def bayesian_ab_test(
    control_successes: int,
    control_n: int,
    treatment_successes: int,
    treatment_n: int,
    prior_alpha: float = 1,
    prior_beta: float = 1,
    n_simulations: int = 10000
) -> Dict[str, Any]:
    """
    Bayesian A/B test for conversion rates.
    
    Args:
        control_successes: Successes in control
        control_n: Total in control
        treatment_successes: Successes in treatment
        treatment_n: Total in treatment
        prior_alpha: Beta prior alpha
        prior_beta: Beta prior beta
        n_simulations: Number of simulations
        
    Returns:
        Dictionary with A/B test results
    """
    # Posterior parameters
    control_alpha = prior_alpha + control_successes
    control_beta = prior_beta + control_n - control_successes
    
    treatment_alpha = prior_alpha + treatment_successes
    treatment_beta = prior_beta + treatment_n - treatment_successes
    
    # Simulate from posteriors
    control_samples = np.random.beta(control_alpha, control_beta, n_simulations)
    treatment_samples = np.random.beta(treatment_alpha, treatment_beta, n_simulations)
    
    # Calculate metrics
    p_treatment_better = np.mean(treatment_samples > control_samples)
    
    # Relative uplift
    relative_uplift = (treatment_samples - control_samples) / control_samples
    expected_uplift = np.mean(relative_uplift) * 100
    
    # Risk of choosing treatment if it's actually worse
    p_treatment_worse_5pct = np.mean(treatment_samples < 0.95 * control_samples)
    
    # Expected loss
    losses_if_choose_control = np.maximum(treatment_samples - control_samples, 0)
    losses_if_choose_treatment = np.maximum(control_samples - treatment_samples, 0)
    
    expected_loss_control = np.mean(losses_if_choose_control)
    expected_loss_treatment = np.mean(losses_if_choose_treatment)
    
    # Credible intervals
    control_ci = np.percentile(control_samples, [2.5, 97.5])
    treatment_ci = np.percentile(treatment_samples, [2.5, 97.5])
    uplift_ci = np.percentile(relative_uplift * 100, [2.5, 97.5])
    
    return {
        "test_type": "Bayesian A/B Test",
        "observed_rates": {
            "control": control_successes / control_n,
            "treatment": treatment_successes / treatment_n
        },
        "posterior_estimates": {
            "control_mean": float(np.mean(control_samples)),
            "treatment_mean": float(np.mean(treatment_samples)),
            "control_ci": [float(control_ci[0]), float(control_ci[1])],
            "treatment_ci": [float(treatment_ci[0]), float(treatment_ci[1])]
        },
        "probability_treatment_better": float(p_treatment_better),
        "expected_relative_uplift": {
            "mean": float(expected_uplift),
            "ci": [float(uplift_ci[0]), float(uplift_ci[1])]
        },
        "risk_metrics": {
            "p_treatment_worse_5pct": float(p_treatment_worse_5pct),
            "expected_loss_if_choose_control": float(expected_loss_control),
            "expected_loss_if_choose_treatment": float(expected_loss_treatment)
        },
        "recommendation": _get_ab_test_recommendation(p_treatment_better, expected_uplift, p_treatment_worse_5pct)
    }

# Helper functions

def _interpret_bayes_factor(bf: float) -> str:
    """Interpret Bayes factor according to Jeffreys' scale."""
    if bf < 1/10:
        return "Strong evidence for null hypothesis"
    elif bf < 1/3:
        return "Moderate evidence for null hypothesis"
    elif bf < 1:
        return "Weak evidence for null hypothesis"
    elif bf < 3:
        return "Weak evidence for alternative hypothesis"
    elif bf < 10:
        return "Moderate evidence for alternative hypothesis"
    else:
        return "Strong evidence for alternative hypothesis"

def _interpret_bayesian_test(bf: float, p_direction: float, p_rope: float) -> str:
    """Interpret Bayesian test results."""
    if p_rope > 0.95:
        return "Effect is practically equivalent to null (within ROPE)"
    elif bf > 10 and p_direction > 0.95:
        return "Strong evidence for effect in expected direction"
    elif bf > 3:
        return "Moderate evidence for effect"
    else:
        return "Insufficient evidence to conclude effect exists"

def _interpret_proportion_test(p_greater: float, ci_lower: float, ci_upper: float) -> str:
    """Interpret Bayesian proportion test."""
    if ci_lower > 0:
        return f"Credible evidence that p1 > p2 (probability: {p_greater:.2%})"
    elif ci_upper < 0:
        return f"Credible evidence that p1 < p2 (probability: {1-p_greater:.2%})"
    else:
        return "No credible difference between proportions"

def _estimate_mode(samples: np.ndarray) -> float:
    """Estimate mode using kernel density estimation."""
    from scipy.stats import gaussian_kde
    kde = gaussian_kde(samples)
    x = np.linspace(samples.min(), samples.max(), 1000)
    density = kde(x)
    return x[np.argmax(density)]

def _get_ab_test_recommendation(p_better: float, uplift: float, p_worse_5pct: float) -> str:
    """Get recommendation for A/B test."""
    if p_better > 0.95 and uplift > 5 and p_worse_5pct < 0.05:
        return "Strong recommendation to choose treatment"
    elif p_better > 0.8 and uplift > 0:
        return "Moderate recommendation to choose treatment"
    elif p_better < 0.2:
        return "Recommendation to stay with control"
    else:
        return "Continue testing - insufficient evidence"