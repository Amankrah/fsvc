"""
Regression analysis methods for inferential statistics.
"""

import pandas as pd
import numpy as np
from scipy import stats
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge, Lasso
from sklearn.preprocessing import StandardScaler
from statsmodels.api import OLS, Logit, GLM, RLM
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan, het_white
import statsmodels.api as sm
from typing import Dict, Any, List, Optional, Union, Tuple
import warnings

def perform_linear_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    include_intercept: bool = True,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform linear regression analysis.
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Name of dependent variable
        independent_vars: List of independent variable names
        include_intercept: Whether to include intercept
        alpha: Significance level
        
    Returns:
        Dictionary with regression results
    """
    # Prepare data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    
    if len(clean_data) < len(independent_vars) + 1:
        return {"error": "Insufficient observations for regression"}
    
    X = clean_data[independent_vars]
    y = clean_data[dependent_var]
    
    # Add intercept if requested
    if include_intercept:
        X = sm.add_constant(X)
    
    # Fit model
    model = OLS(y, X).fit()
    
    # Get predictions
    predictions = model.predict(X)
    residuals = y - predictions
    
    # Model diagnostics
    diagnostics = calculate_regression_diagnostics(model, X, y)
    
    # Confidence intervals
    conf_int = model.conf_int(alpha=alpha)
    
    # Create results dictionary
    results = {
        "model_type": "Linear Regression",
        "n_observations": len(clean_data),
        "n_predictors": len(independent_vars),
        "r_squared": float(model.rsquared),
        "adj_r_squared": float(model.rsquared_adj),
        "f_statistic": float(model.fvalue),
        "f_p_value": float(model.f_pvalue),
        "aic": float(model.aic),
        "bic": float(model.bic),
        "coefficients": {},
        "model_significance": model.f_pvalue < alpha,
        "diagnostics": diagnostics
    }
    
    # Add coefficient details
    for i, var in enumerate(model.params.index):
        results["coefficients"][var] = {
            "estimate": float(model.params[i]),
            "std_error": float(model.bse[i]),
            "t_statistic": float(model.tvalues[i]),
            "p_value": float(model.pvalues[i]),
            "conf_int_lower": float(conf_int.iloc[i, 0]),
            "conf_int_upper": float(conf_int.iloc[i, 1]),
            "significant": model.pvalues[i] < alpha
        }
    
    # Add predictions and residuals summary
    results["predictions"] = {
        "mean": float(predictions.mean()),
        "std": float(predictions.std()),
        "min": float(predictions.min()),
        "max": float(predictions.max())
    }
    
    results["residuals"] = {
        "mean": float(residuals.mean()),
        "std": float(residuals.std()),
        "min": float(residuals.min()),
        "max": float(residuals.max())
    }
    
    return results

def perform_multiple_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    interaction_terms: Optional[List[Tuple[str, str]]] = None,
    polynomial_terms: Optional[Dict[str, int]] = None,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform multiple regression with interactions and polynomial terms.
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Name of dependent variable
        independent_vars: List of independent variable names
        interaction_terms: List of tuples for interaction terms
        polynomial_terms: Dict of variable names and polynomial degrees
        alpha: Significance level
        
    Returns:
        Dictionary with regression results
    """
    # Prepare base data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    X = clean_data[independent_vars].copy()
    y = clean_data[dependent_var]
    
    # Add polynomial terms
    if polynomial_terms:
        for var, degree in polynomial_terms.items():
            if var in X.columns:
                for d in range(2, degree + 1):
                    X[f"{var}^{d}"] = X[var] ** d
    
    # Add interaction terms
    if interaction_terms:
        for var1, var2 in interaction_terms:
            if var1 in X.columns and var2 in X.columns:
                X[f"{var1}*{var2}"] = X[var1] * X[var2]
    
    # Add intercept
    X = sm.add_constant(X)
    
    # Fit model
    model = OLS(y, X).fit()
    
    # Calculate VIF for multicollinearity
    vif_data = calculate_vif(X.iloc[:, 1:])  # Exclude constant
    
    # Perform stepwise selection (simplified)
    best_model = _backward_selection(X, y, alpha)
    
    results = {
        "model_type": "Multiple Regression",
        "n_observations": len(clean_data),
        "n_predictors": X.shape[1] - 1,  # Exclude intercept
        "r_squared": float(model.rsquared),
        "adj_r_squared": float(model.rsquared_adj),
        "f_statistic": float(model.fvalue),
        "f_p_value": float(model.f_pvalue),
        "coefficients": {},
        "vif": vif_data,
        "best_model_vars": best_model
    }
    
    # Add coefficient details
    for var in model.params.index:
        results["coefficients"][var] = {
            "estimate": float(model.params[var]),
            "std_error": float(model.bse[var]),
            "t_statistic": float(model.tvalues[var]),
            "p_value": float(model.pvalues[var]),
            "significant": model.pvalues[var] < alpha
        }
    
    return results

def perform_logistic_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform logistic regression.
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Binary dependent variable
        independent_vars: List of independent variable names
        alpha: Significance level
        
    Returns:
        Dictionary with logistic regression results
    """
    # Prepare data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    X = clean_data[independent_vars]
    y = clean_data[dependent_var]
    
    # Check if binary
    unique_values = y.unique()
    if len(unique_values) != 2:
        return {"error": f"Dependent variable must be binary, found {len(unique_values)} unique values"}
    
    # Ensure 0/1 coding
    if set(unique_values) != {0, 1}:
        y = (y == unique_values[1]).astype(int)
    
    # Add intercept
    X = sm.add_constant(X)
    
    # Fit model
    model = Logit(y, X).fit(disp=0)
    
    # Get predictions
    predictions = model.predict(X)
    
    # Calculate pseudo R-squared (McFadden's)
    llf = model.llf
    llnull = model.llnull
    mcfadden_r2 = 1 - (llf / llnull)
    
    # Classification metrics
    threshold = 0.5
    predicted_classes = (predictions > threshold).astype(int)
    accuracy = (predicted_classes == y).mean()
    
    # Confusion matrix
    tp = ((predicted_classes == 1) & (y == 1)).sum()
    tn = ((predicted_classes == 0) & (y == 0)).sum()
    fp = ((predicted_classes == 1) & (y == 0)).sum()
    fn = ((predicted_classes == 0) & (y == 1)).sum()
    
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    
    results = {
        "model_type": "Logistic Regression",
        "n_observations": len(clean_data),
        "n_predictors": len(independent_vars),
        "log_likelihood": float(llf),
        "aic": float(model.aic),
        "bic": float(model.bic),
        "mcfadden_r2": float(mcfadden_r2),
        "likelihood_ratio_test": {
            "statistic": float(-2 * (llnull - llf)),
            "p_value": float(model.llr_pvalue),
            "significant": model.llr_pvalue < alpha
        },
        "coefficients": {},
        "classification_metrics": {
            "accuracy": float(accuracy),
            "sensitivity": float(sensitivity),
            "specificity": float(specificity),
            "confusion_matrix": {
                "true_positive": int(tp),
                "true_negative": int(tn),
                "false_positive": int(fp),
                "false_negative": int(fn)
            }
        }
    }
    
    # Add coefficient details with odds ratios
    for var in model.params.index:
        coef = model.params[var]
        results["coefficients"][var] = {
            "estimate": float(coef),
            "std_error": float(model.bse[var]),
            "z_statistic": float(model.tvalues[var]),
            "p_value": float(model.pvalues[var]),
            "odds_ratio": float(np.exp(coef)),
            "conf_int_lower": float(np.exp(model.conf_int(alpha).iloc[model.params.index.get_loc(var), 0])),
            "conf_int_upper": float(np.exp(model.conf_int(alpha).iloc[model.params.index.get_loc(var), 1])),
            "significant": model.pvalues[var] < alpha
        }
    
    return results

def perform_poisson_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    exposure: Optional[str] = None,
    alpha: float = 0.05
) -> Dict[str, Any]:
    """
    Perform Poisson regression for count data.
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Count dependent variable
        independent_vars: List of independent variable names
        exposure: Exposure/offset variable
        alpha: Significance level
        
    Returns:
        Dictionary with Poisson regression results
    """
    # Prepare data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    if exposure:
        clean_data = clean_data.join(data[exposure])
    
    X = clean_data[independent_vars]
    y = clean_data[dependent_var]
    
    # Check if count data
    if not all(y == y.astype(int)):
        warnings.warn("Dependent variable should be count data")
    
    # Add intercept
    X = sm.add_constant(X)
    
    # Set up exposure/offset
    if exposure and exposure in clean_data.columns:
        offset = np.log(clean_data[exposure])
    else:
        offset = None
    
    # Fit model
    model = GLM(y, X, family=sm.families.Poisson(), offset=offset).fit()
    
    # Check for overdispersion
    pearson_chi2 = model.pearson_chi2
    df_resid = model.df_resid
    dispersion = pearson_chi2 / df_resid
    
    results = {
        "model_type": "Poisson Regression",
        "n_observations": len(clean_data),
        "n_predictors": len(independent_vars),
        "log_likelihood": float(model.llf),
        "aic": float(model.aic),
        "bic": float(model.bic),
        "deviance": float(model.deviance),
        "pearson_chi2": float(pearson_chi2),
        "dispersion": float(dispersion),
        "overdispersion": dispersion > 1.5,
        "coefficients": {}
    }
    
    # Add coefficient details with rate ratios
    for var in model.params.index:
        coef = model.params[var]
        results["coefficients"][var] = {
            "estimate": float(coef),
            "std_error": float(model.bse[var]),
            "z_statistic": float(model.tvalues[var]),
            "p_value": float(model.pvalues[var]),
            "rate_ratio": float(np.exp(coef)),
            "conf_int_lower": float(np.exp(model.conf_int(alpha).iloc[model.params.index.get_loc(var), 0])),
            "conf_int_upper": float(np.exp(model.conf_int(alpha).iloc[model.params.index.get_loc(var), 1])),
            "significant": model.pvalues[var] < alpha
        }
    
    if results["overdispersion"]:
        results["recommendation"] = "Consider negative binomial regression due to overdispersion"
    
    return results

def calculate_regression_diagnostics(
    model: Union[OLS, Any],
    X: pd.DataFrame,
    y: pd.Series
) -> Dict[str, Any]:
    """
    Calculate comprehensive regression diagnostics.
    
    Args:
        model: Fitted regression model
        X: Independent variables
        y: Dependent variable
        
    Returns:
        Dictionary with diagnostic results
    """
    residuals = model.resid
    fitted = model.fittedvalues
    n = len(residuals)
    p = X.shape[1]
    
    # Normality tests on residuals
    _, shapiro_p = stats.shapiro(residuals)
    _, ks_p = stats.kstest(residuals, 'norm', args=(residuals.mean(), residuals.std()))
    
    # Heteroscedasticity tests
    bp_stat, bp_p, _, _ = het_breuschpagan(residuals, X)
    
    # Durbin-Watson for autocorrelation
    dw_stat = sm.stats.durbin_watson(residuals)
    
    # Influential observations
    influence = model.get_influence()
    cooks_d = influence.cooks_distance[0]
    threshold = 4 / (n - p)
    influential_obs = np.where(cooks_d > threshold)[0]
    
    # Leverage points
    leverage = influence.hat_matrix_diag
    high_leverage = np.where(leverage > 2 * p / n)[0]
    
    diagnostics = {
        "residual_normality": {
            "shapiro_p_value": float(shapiro_p),
            "ks_p_value": float(ks_p),
            "normal_residuals": shapiro_p > 0.05
        },
        "heteroscedasticity": {
            "breusch_pagan_stat": float(bp_stat),
            "breusch_pagan_p_value": float(bp_p),
            "homoscedastic": bp_p > 0.05
        },
        "autocorrelation": {
            "durbin_watson": float(dw_stat),
            "interpretation": _interpret_durbin_watson(dw_stat)
        },
        "influential_observations": {
            "n_influential": len(influential_obs),
            "influential_indices": influential_obs.tolist(),
            "max_cooks_d": float(np.max(cooks_d))
        },
        "leverage": {
            "n_high_leverage": len(high_leverage),
            "high_leverage_indices": high_leverage.tolist(),
            "max_leverage": float(np.max(leverage))
        }
    }
    
    return diagnostics

def calculate_vif(
    X: pd.DataFrame
) -> Dict[str, float]:
    """
    Calculate Variance Inflation Factors.
    
    Args:
        X: DataFrame of independent variables
        
    Returns:
        Dictionary with VIF for each variable
    """
    vif_data = {}
    
    for i in range(X.shape[1]):
        try:
            vif = variance_inflation_factor(X.values, i)
            vif_data[X.columns[i]] = float(vif) if np.isfinite(vif) else None
        except:
            vif_data[X.columns[i]] = None
    
    # Add interpretation
    high_vif_vars = [var for var, vif in vif_data.items() 
                     if vif is not None and vif > 10]
    
    return {
        "vif_values": vif_data,
        "high_multicollinearity": high_vif_vars,
        "interpretation": _interpret_vif(vif_data)
    }

def perform_ridge_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    alpha_values: Optional[List[float]] = None,
    cv_folds: int = 5
) -> Dict[str, Any]:
    """
    Perform Ridge regression with cross-validation.
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Name of dependent variable
        independent_vars: List of independent variable names
        alpha_values: List of alpha values to try
        cv_folds: Number of cross-validation folds
        
    Returns:
        Dictionary with Ridge regression results
    """
    from sklearn.model_selection import cross_val_score
    from sklearn.preprocessing import StandardScaler
    
    # Prepare data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    X = clean_data[independent_vars]
    y = clean_data[dependent_var]
    
    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Default alpha values
    if alpha_values is None:
        alpha_values = [0.001, 0.01, 0.1, 1, 10, 100]
    
    # Cross-validation to find best alpha
    cv_scores = []
    for alpha in alpha_values:
        ridge = Ridge(alpha=alpha)
        scores = cross_val_score(ridge, X_scaled, y, cv=cv_folds, 
                               scoring='neg_mean_squared_error')
        cv_scores.append({
            'alpha': alpha,
            'mean_mse': -scores.mean(),
            'std_mse': scores.std()
        })
    
    # Find best alpha
    best_alpha = min(cv_scores, key=lambda x: x['mean_mse'])['alpha']
    
    # Fit final model with best alpha
    ridge_final = Ridge(alpha=best_alpha)
    ridge_final.fit(X_scaled, y)
    
    # Calculate R-squared
    r2 = ridge_final.score(X_scaled, y)
    
    # Get coefficients (unstandardized)
    coefficients = {}
    for i, var in enumerate(independent_vars):
        coef_scaled = ridge_final.coef_[i]
        # Unstandardize
        coef = coef_scaled / scaler.scale_[i]
        coefficients[var] = {
            "estimate": float(coef),
            "standardized": float(coef_scaled)
        }
    
    return {
        "model_type": "Ridge Regression",
        "best_alpha": best_alpha,
        "r_squared": float(r2),
        "intercept": float(ridge_final.intercept_),
        "coefficients": coefficients,
        "cv_results": cv_scores,
        "n_observations": len(clean_data),
        "n_predictors": len(independent_vars)
    }

def perform_lasso_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    alpha_values: Optional[List[float]] = None,
    cv_folds: int = 5
) -> Dict[str, Any]:
    """
    Perform Lasso regression with cross-validation.
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Name of dependent variable
        independent_vars: List of independent variable names
        alpha_values: List of alpha values to try
        cv_folds: Number of cross-validation folds
        
    Returns:
        Dictionary with Lasso regression results
    """
    from sklearn.model_selection import cross_val_score
    
    # Prepare data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    X = clean_data[independent_vars]
    y = clean_data[dependent_var]
    
    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Default alpha values
    if alpha_values is None:
        alpha_values = [0.001, 0.01, 0.1, 1, 10]
    
    # Cross-validation to find best alpha
    cv_scores = []
    for alpha in alpha_values:
        lasso = Lasso(alpha=alpha, max_iter=10000)
        scores = cross_val_score(lasso, X_scaled, y, cv=cv_folds,
                               scoring='neg_mean_squared_error')
        cv_scores.append({
            'alpha': alpha,
            'mean_mse': -scores.mean(),
            'std_mse': scores.std()
        })
    
    # Find best alpha
    best_alpha = min(cv_scores, key=lambda x: x['mean_mse'])['alpha']
    
    # Fit final model
    lasso_final = Lasso(alpha=best_alpha, max_iter=10000)
    lasso_final.fit(X_scaled, y)
    
    # Calculate R-squared
    r2 = lasso_final.score(X_scaled, y)
    
    # Get coefficients and selected features
    coefficients = {}
    selected_features = []
    
    for i, var in enumerate(independent_vars):
        coef_scaled = lasso_final.coef_[i]
        if coef_scaled != 0:
            selected_features.append(var)
            # Unstandardize
            coef = coef_scaled / scaler.scale_[i]
        else:
            coef = 0
        
        coefficients[var] = {
            "estimate": float(coef),
            "standardized": float(coef_scaled),
            "selected": coef_scaled != 0
        }
    
    return {
        "model_type": "Lasso Regression",
        "best_alpha": best_alpha,
        "r_squared": float(r2),
        "intercept": float(lasso_final.intercept_),
        "coefficients": coefficients,
        "selected_features": selected_features,
        "n_selected": len(selected_features),
        "cv_results": cv_scores,
        "n_observations": len(clean_data),
        "n_predictors": len(independent_vars)
    }

def perform_robust_regression(
    data: pd.DataFrame,
    dependent_var: str,
    independent_vars: List[str],
    method: str = 'huber'
) -> Dict[str, Any]:
    """
    Perform robust regression (resistant to outliers).
    
    Args:
        data: DataFrame containing all variables
        dependent_var: Name of dependent variable
        independent_vars: List of independent variable names
        method: 'huber' or 'tukey'
        
    Returns:
        Dictionary with robust regression results
    """
    # Prepare data
    clean_data = data[[dependent_var] + independent_vars].dropna()
    X = clean_data[independent_vars]
    y = clean_data[dependent_var]
    
    # Add intercept
    X = sm.add_constant(X)
    
    # Fit robust model
    if method == 'huber':
        rlm_model = RLM(y, X, M=sm.robust.norms.HuberT()).fit()
    elif method == 'tukey':
        rlm_model = RLM(y, X, M=sm.robust.norms.TukeyBiweight()).fit()
    else:
        return {"error": f"Unknown method: {method}"}
    
    # Compare with OLS
    ols_model = OLS(y, X).fit()
    
    # Identify influential observations
    weights = rlm_model.weights
    low_weight_threshold = 0.5
    influential_obs = np.where(weights < low_weight_threshold)[0]
    
    results = {
        "model_type": f"Robust Regression ({method})",
        "n_observations": len(clean_data),
        "n_predictors": len(independent_vars),
        "coefficients": {},
        "influential_observations": {
            "n_influential": len(influential_obs),
            "indices": influential_obs.tolist(),
            "min_weight": float(weights.min()),
            "mean_weight": float(weights.mean())
        },
        "comparison_with_ols": {}
    }
    
    # Add coefficient details
    for var in rlm_model.params.index:
        results["coefficients"][var] = {
            "robust_estimate": float(rlm_model.params[var]),
            "robust_std_error": float(rlm_model.bse[var]),
            "robust_t_statistic": float(rlm_model.tvalues[var]),
            "robust_p_value": float(rlm_model.pvalues[var]),
            "ols_estimate": float(ols_model.params[var]),
            "difference": float(rlm_model.params[var] - ols_model.params[var])
        }
    
    return results

# Helper functions

def _backward_selection(X: pd.DataFrame, y: pd.Series, alpha: float = 0.05) -> List[str]:
    """Simple backward selection."""
    included = list(X.columns)
    
    while len(included) > 1:  # Keep at least intercept
        model = OLS(y, X[included]).fit()
        
        # Get p-values excluding intercept
        pvalues = model.pvalues[1:]  # Exclude intercept
        
        if pvalues.max() > alpha:
            # Remove variable with highest p-value
            remove_var = pvalues.idxmax()
            included.remove(remove_var)
        else:
            break
    
    return included

def _interpret_durbin_watson(dw: float) -> str:
    """Interpret Durbin-Watson statistic."""
    if dw < 1.5:
        return "Positive autocorrelation likely"
    elif dw > 2.5:
        return "Negative autocorrelation likely"
    else:
        return "No significant autocorrelation"

def _interpret_vif(vif_data: Dict[str, float]) -> str:
    """Interpret VIF values."""
    max_vif = max(v for v in vif_data.values() if v is not None)
    
    if max_vif > 10:
        return "Severe multicollinearity detected"
    elif max_vif > 5:
        return "Moderate multicollinearity detected"
    else:
        return "No significant multicollinearity"