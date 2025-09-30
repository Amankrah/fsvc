"""
Time series inference and testing methods.
"""

import pandas as pd
import numpy as np
from scipy import stats
from statsmodels.tsa.stattools import adfuller, kpss, acf, pacf, grangercausalitytests
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import coint
import warnings
from typing import Dict, Any, List, Optional, Union, Tuple

def test_stationarity(
    series: pd.Series,
    test_types: List[str] = ['adf', 'kpss'],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Test for stationarity using multiple tests.
    
    Args:
        series: Time series data
        test_types: List of tests to perform
        alpha: Significance level
        
    Returns:
        Dictionary with stationarity test results
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 20:
        return {"error": "Need at least 20 observations for stationarity tests"}
    
    results = {
        "series_length": len(clean_series),
        "tests": {}
    }
    
    # ADF test
    if 'adf' in test_types:
        adf_result = adfuller(clean_series, autolag='AIC')
        results["tests"]["adf"] = {
            "statistic": float(adf_result[0]),
            "p_value": float(adf_result[1]),
            "n_lags": int(adf_result[2]),
            "n_obs": int(adf_result[3]),
            "critical_values": {k: float(v) for k, v in adf_result[4].items()},
            "stationary": adf_result[1] < alpha,
            "interpretation": "Stationary (reject H0 of unit root)" if adf_result[1] < alpha 
                           else "Non-stationary (fail to reject H0 of unit root)"
        }
    
    # KPSS test
    if 'kpss' in test_types:
        kpss_result = kpss(clean_series, regression='c', nlags='auto')
        results["tests"]["kpss"] = {
            "statistic": float(kpss_result[0]),
            "p_value": float(kpss_result[1]),
            "n_lags": int(kpss_result[2]),
            "critical_values": {k: float(v) for k, v in kpss_result[3].items()},
            "stationary": kpss_result[1] > alpha,
            "interpretation": "Stationary (fail to reject H0 of stationarity)" if kpss_result[1] > alpha 
                           else "Non-stationary (reject H0 of stationarity)"
        }
    
    # Overall assessment
    if 'adf' in results["tests"] and 'kpss' in results["tests"]:
        adf_stationary = results["tests"]["adf"]["stationary"]
        kpss_stationary = results["tests"]["kpss"]["stationary"]
        
        if adf_stationary and kpss_stationary:
            overall = "Stationary (both tests agree)"
        elif not adf_stationary and not kpss_stationary:
            overall = "Non-stationary (both tests agree)"
        else:
            overall = "Conflicting results - further investigation needed"
        
        results["overall_assessment"] = overall
    
    return results

def test_autocorrelation(
    series: pd.Series,
    lags: int = 40,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Test for autocorrelation in time series.
    
    Args:
        series: Time series data
        lags: Number of lags to test
        alpha: Significance level
        
    Returns:
        Dictionary with autocorrelation test results
    """
    clean_series = series.dropna()
    
    if len(clean_series) < lags + 1:
        return {"error": f"Need at least {lags + 1} observations"}
    
    # Calculate ACF and PACF
    acf_values, acf_confint = acf(clean_series, nlags=lags, alpha=alpha)
    pacf_values, pacf_confint = pacf(clean_series, nlags=lags, alpha=alpha)
    
    # Ljung-Box test
    lb_result = acorr_ljungbox(clean_series, lags=lags, return_df=True)
    
    # Find significant lags
    significant_acf_lags = []
    significant_pacf_lags = []
    
    for lag in range(1, min(lags + 1, len(acf_values))):
        if acf_confint[lag][0] > 0 or acf_confint[lag][1] < 0:
            significant_acf_lags.append(lag)
        if lag < len(pacf_values) and (pacf_confint[lag][0] > 0 or pacf_confint[lag][1] < 0):
            significant_pacf_lags.append(lag)
    
    results = {
        "acf": {
            "values": acf_values.tolist(),
            "confidence_intervals": acf_confint.tolist(),
            "significant_lags": significant_acf_lags,
            "n_significant": len(significant_acf_lags)
        },
        "pacf": {
            "values": pacf_values.tolist(),
            "confidence_intervals": pacf_confint.tolist(),
            "significant_lags": significant_pacf_lags,
            "n_significant": len(significant_pacf_lags)
        },
        "ljung_box": {
            "statistics": lb_result['lb_stat'].tolist(),
            "p_values": lb_result['lb_pvalue'].tolist(),
            "significant_at_lag": int(lb_result[lb_result['lb_pvalue'] < alpha].index[0]) 
                                if any(lb_result['lb_pvalue'] < alpha) else None
        },
        "interpretation": _interpret_autocorrelation(significant_acf_lags, significant_pacf_lags)
    }
    
    return results

def test_seasonality(
    series: pd.Series,
    period: int,
    test_type: str = 'decomposition',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Test for seasonality in time series.
    
    Args:
        series: Time series data with datetime index
        period: Seasonal period
        test_type: 'decomposition' or 'fourier'
        alpha: Significance level
        
    Returns:
        Dictionary with seasonality test results
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 2 * period:
        return {"error": f"Need at least {2 * period} observations for seasonality test"}
    
    results = {
        "period": period,
        "test_type": test_type
    }
    
    if test_type == 'decomposition':
        # Seasonal decomposition
        decomposition = seasonal_decompose(clean_series, model='additive', period=period)
        
        # Calculate strength of seasonality
        seasonal_var = decomposition.seasonal.var()
        resid_var = decomposition.resid.var()
        
        if resid_var > 0:
            seasonal_strength = 1 - resid_var / (resid_var + seasonal_var)
        else:
            seasonal_strength = 1.0
        
        # Test if seasonal component is significant
        # Simple F-test approach
        total_var = clean_series.var()
        f_stat = seasonal_var / resid_var if resid_var > 0 else np.inf
        df1 = period - 1
        df2 = len(clean_series) - period
        p_value = 1 - stats.f.cdf(f_stat, df1, df2)
        
        results.update({
            "seasonal_strength": float(seasonal_strength),
            "f_statistic": float(f_stat),
            "p_value": float(p_value),
            "significant": p_value < alpha,
            "seasonal_component": {
                "mean": float(decomposition.seasonal.mean()),
                "std": float(decomposition.seasonal.std()),
                "var": float(seasonal_var)
            },
            "interpretation": _interpret_seasonal_strength(seasonal_strength)
        })
    
    return results

def granger_causality_test(
    data: pd.DataFrame,
    cause_var: str,
    effect_var: str,
    max_lag: int = 10,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Granger causality test.
    
    Args:
        data: DataFrame with time series
        cause_var: Potential cause variable
        effect_var: Potential effect variable
        max_lag: Maximum lag to test
        alpha: Significance level
        
    Returns:
        Dictionary with Granger causality results
    """
    # Prepare data
    clean_data = data[[cause_var, effect_var]].dropna()
    
    if len(clean_data) < max_lag + 10:
        return {"error": "Insufficient data for Granger causality test"}
    
    # Test stationarity first
    cause_stationary = test_stationarity(clean_data[cause_var])
    effect_stationary = test_stationarity(clean_data[effect_var])
    
    # Perform test
    try:
        test_result = grangercausalitytests(
            clean_data[[effect_var, cause_var]], 
            maxlag=max_lag, 
            verbose=False
        )
    except Exception as e:
        return {"error": f"Granger causality test failed: {str(e)}"}
    
    # Extract results
    results = {
        "cause": cause_var,
        "effect": effect_var,
        "stationarity_check": {
            cause_var: cause_stationary.get("overall_assessment", "Unknown"),
            effect_var: effect_stationary.get("overall_assessment", "Unknown")
        },
        "lag_tests": {}
    }
    
    # Find best lag based on AIC
    best_lag = None
    best_aic = np.inf
    
    for lag in range(1, max_lag + 1):
        if lag in test_result:
            # Get F-test results
            f_test = test_result[lag][0]['ssr_ftest']
            f_stat = f_test[0]
            f_pvalue = f_test[1]
            
            # Get AIC
            aic = test_result[lag][1][1].aic
            
            results["lag_tests"][lag] = {
                "f_statistic": float(f_stat),
                "p_value": float(f_pvalue),
                "aic": float(aic),
                "significant": f_pvalue < alpha
            }
            
            if aic < best_aic:
                best_aic = aic
                best_lag = lag
    
    results["best_lag"] = best_lag
    results["conclusion"] = _interpret_granger_causality(results["lag_tests"], alpha)
    
    return results

def cointegration_test(
    series1: pd.Series,
    series2: pd.Series,
    trend: str = 'c',
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Test for cointegration between two time series.
    
    Args:
        series1: First time series
        series2: Second time series
        trend: 'n' (no trend), 'c' (constant), 'ct' (constant + trend)
        alpha: Significance level
        
    Returns:
        Dictionary with cointegration test results
    """
    # Prepare data
    data = pd.DataFrame({'series1': series1, 'series2': series2}).dropna()
    
    if len(data) < 20:
        return {"error": "Need at least 20 observations for cointegration test"}
    
    # Test individual series for unit roots
    series1_stationary = test_stationarity(data['series1'], ['adf'])
    series2_stationary = test_stationarity(data['series2'], ['adf'])
    
    # Engle-Granger test
    coint_t, p_value, crit_values = coint(data['series1'], data['series2'], trend=trend)
    
    results = {
        "test_type": "Engle-Granger",
        "trend": trend,
        "statistic": float(coint_t),
        "p_value": float(p_value),
        "critical_values": {
            "1%": float(crit_values[0]),
            "5%": float(crit_values[1]),
            "10%": float(crit_values[2])
        },
        "cointegrated": p_value < alpha,
        "series_stationarity": {
            "series1": series1_stationary["tests"]["adf"]["stationary"],
            "series2": series2_stationary["tests"]["adf"]["stationary"]
        },
        "interpretation": _interpret_cointegration(p_value < alpha, 
                                                  series1_stationary["tests"]["adf"]["stationary"],
                                                  series2_stationary["tests"]["adf"]["stationary"])
    }
    
    return results

def change_point_detection(
    series: pd.Series,
    method: str = 'cusum',
    threshold: float = 0.05
) -> Dict[str, Any]:
    """
    Detect structural breaks/change points in time series.
    
    Args:
        series: Time series data
        method: Detection method ('cusum' or 'binseg')
        threshold: Threshold for detection
        
    Returns:
        Dictionary with change point detection results
    """
    clean_series = series.dropna().values
    n = len(clean_series)
    
    if n < 20:
        return {"error": "Need at least 20 observations"}
    
    results = {
        "method": method,
        "n_observations": n
    }
    
    if method == 'cusum':
        # CUSUM test
        mean = np.mean(clean_series)
        std = np.std(clean_series)
        
        # Calculate CUSUM
        cusum = np.zeros(n)
        for i in range(1, n):
            cusum[i] = cusum[i-1] + (clean_series[i] - mean) / std
        
        # Find change points
        h = threshold * np.sqrt(n)  # Critical value
        upper_violations = np.where(cusum > h)[0]
        lower_violations = np.where(cusum < -h)[0]
        
        change_points = []
        if len(upper_violations) > 0:
            change_points.append(int(upper_violations[0]))
        if len(lower_violations) > 0:
            change_points.append(int(lower_violations[0]))
        
        results.update({
            "cusum_values": cusum.tolist(),
            "threshold": float(h),
            "change_points": sorted(list(set(change_points))),
            "n_change_points": len(set(change_points))
        })
    
    return results

def forecast_accuracy_tests(
    actual: pd.Series,
    forecast: pd.Series,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Test forecast accuracy and bias.
    
    Args:
        actual: Actual values
        forecast: Forecasted values
        alpha: Significance level
        
    Returns:
        Dictionary with forecast accuracy tests
    """
    # Align series
    data = pd.DataFrame({'actual': actual, 'forecast': forecast}).dropna()
    
    if len(data) < 2:
        return {"error": "Need at least 2 observations"}
    
    errors = data['actual'] - data['forecast']
    
    # Calculate accuracy metrics
    mae = np.mean(np.abs(errors))
    mse = np.mean(errors ** 2)
    rmse = np.sqrt(mse)
    mape = np.mean(np.abs(errors / data['actual'])) * 100
    
    # Test for bias (t-test on errors)
    t_stat, p_value = stats.ttest_1samp(errors, 0)
    
    # Test for autocorrelation in errors
    if len(errors) > 10:
        lb_result = acorr_ljungbox(errors, lags=min(10, len(errors)//2), return_df=True)
        autocorr_p = lb_result['lb_pvalue'].min()
    else:
        autocorr_p = None
    
    # Diebold-Mariano test (simplified)
    # Test if squared errors are different
    squared_errors = errors ** 2
    dm_stat = np.mean(squared_errors) / (np.std(squared_errors) / np.sqrt(len(squared_errors)))
    dm_p_value = 2 * (1 - stats.norm.cdf(abs(dm_stat)))
    
    results = {
        "n_observations": len(data),
        "accuracy_metrics": {
            "mae": float(mae),
            "mse": float(mse),
            "rmse": float(rmse),
            "mape": float(mape)
        },
        "bias_test": {
            "mean_error": float(errors.mean()),
            "t_statistic": float(t_stat),
            "p_value": float(p_value),
            "unbiased": p_value > alpha,
            "interpretation": "Unbiased forecast" if p_value > alpha else "Biased forecast"
        },
        "error_autocorrelation": {
            "min_p_value": float(autocorr_p) if autocorr_p else None,
            "independent_errors": autocorr_p > alpha if autocorr_p else None
        },
        "diebold_mariano": {
            "statistic": float(dm_stat),
            "p_value": float(dm_p_value),
            "interpretation": "Forecasts are equivalent" if dm_p_value > alpha 
                           else "Forecasts are significantly different"
        }
    }
    
    return results

# Helper functions

def _interpret_autocorrelation(acf_lags: List[int], pacf_lags: List[int]) -> str:
    """Interpret ACF and PACF patterns."""
    if not acf_lags and not pacf_lags:
        return "No significant autocorrelation detected"
    elif acf_lags and not pacf_lags:
        return "MA process indicated (significant ACF, no PACF)"
    elif pacf_lags and not acf_lags:
        return "AR process indicated (significant PACF, no ACF)"
    else:
        return f"ARMA process indicated (significant ACF at lags {acf_lags[:3]} and PACF at lags {pacf_lags[:3]})"

def _interpret_seasonal_strength(strength: float) -> str:
    """Interpret seasonal strength."""
    if strength < 0.1:
        return "No seasonality"
    elif strength < 0.3:
        return "Weak seasonality"
    elif strength < 0.6:
        return "Moderate seasonality"
    else:
        return "Strong seasonality"

def _interpret_granger_causality(lag_tests: Dict[int, Dict], alpha: float) -> str:
    """Interpret Granger causality results."""
    significant_lags = [lag for lag, test in lag_tests.items() 
                       if test['p_value'] < alpha]
    
    if not significant_lags:
        return "No Granger causality detected"
    else:
        return f"Granger causality detected at lags: {significant_lags}"

def _interpret_cointegration(cointegrated: bool, s1_stationary: bool, s2_stationary: bool) -> str:
    """Interpret cointegration results."""
    if s1_stationary and s2_stationary:
        return "Both series are stationary - cointegration test not applicable"
    elif cointegrated:
        return "Series are cointegrated - long-run relationship exists"
    else:
        return "Series are not cointegrated - no long-run relationship"