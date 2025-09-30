"""
Basic descriptive statistics calculations.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
from scipy import stats

def calculate_basic_stats(df: pd.DataFrame, columns: Optional[List[str]] = None) -> Dict[str, Dict[str, float]]:
    """
    Calculate comprehensive basic descriptive statistics for numerical columns.
    
    Args:
        df: Pandas DataFrame containing the data
        columns: Specific columns to analyze (None for all numeric columns)
        
    Returns:
        Dictionary containing statistics for each numerical column
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    stats_dict = {}
    for column in columns:
        if column in df.columns and pd.api.types.is_numeric_dtype(df[column]):
            col_data = df[column].dropna()
            
            stats_dict[column] = {
                # Central tendency
                "mean": float(col_data.mean()),
                "median": float(col_data.median()),
                "mode": float(col_data.mode()[0]) if not col_data.mode().empty else None,
                "trimmed_mean_5": float(stats.trim_mean(col_data, 0.05)),
                
                # Dispersion
                "std": float(col_data.std()),
                "variance": float(col_data.var()),
                "mad": float((col_data - col_data.mean()).abs().mean()),  # Mean absolute deviation
                "iqr": float(col_data.quantile(0.75) - col_data.quantile(0.25)),
                "range": float(col_data.max() - col_data.min()),
                "cv": float(col_data.std() / col_data.mean()) if col_data.mean() != 0 else None,  # Coefficient of variation
                
                # Position
                "min": float(col_data.min()),
                "max": float(col_data.max()),
                "q1": float(col_data.quantile(0.25)),
                "q3": float(col_data.quantile(0.75)),
                
                # Shape
                "skewness": float(col_data.skew()),
                "kurtosis": float(col_data.kurtosis()),
                
                # Count statistics
                "count": int(col_data.count()),
                "missing_count": int(df[column].isna().sum()),
                "missing_percentage": float(df[column].isna().sum() / len(df) * 100),
                "unique_count": int(col_data.nunique()),
                "unique_percentage": float(col_data.nunique() / len(col_data) * 100) if len(col_data) > 0 else 0
            }
    
    return stats_dict

def calculate_percentiles(df: pd.DataFrame, 
                         columns: Optional[List[str]] = None,
                         percentiles: List[float] = [0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.99]) -> Dict[str, Dict[str, float]]:
    """
    Calculate custom percentiles for numerical columns.
    
    Args:
        df: Pandas DataFrame containing the data
        columns: Specific columns to analyze
        percentiles: List of percentiles to calculate (0-1 scale)
        
    Returns:
        Dictionary containing percentiles for each column
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    percentile_dict = {}
    for column in columns:
        if column in df.columns and pd.api.types.is_numeric_dtype(df[column]):
            col_data = df[column].dropna()
            percentile_dict[column] = {}
            
            for p in percentiles:
                percentile_dict[column][f"p{int(p*100)}"] = float(col_data.quantile(p))
    
    return percentile_dict

def calculate_grouped_stats(df: pd.DataFrame, 
                           group_by: Union[str, List[str]], 
                           target_columns: Optional[List[str]] = None,
                           stats_functions: Optional[List[str]] = None) -> pd.DataFrame:
    """
    Calculate statistics grouped by one or more categorical variables.
    
    Args:
        df: Pandas DataFrame containing the data
        group_by: Column(s) to group by
        target_columns: Columns to calculate statistics for
        stats_functions: List of statistics to calculate
        
    Returns:
        DataFrame with grouped statistics
    """
    if target_columns is None:
        target_columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if stats_functions is None:
        stats_functions = ['count', 'mean', 'std', 'min', 'max', 'median']
    
    grouped_stats = df.groupby(group_by)[target_columns].agg(stats_functions)
    
    # Add additional statistics
    for col in target_columns:
        grouped_stats[(col, 'cv')] = grouped_stats[(col, 'std')] / grouped_stats[(col, 'mean')]
        grouped_stats[(col, 'iqr')] = df.groupby(group_by)[col].apply(
            lambda x: x.quantile(0.75) - x.quantile(0.25)
        )
    
    return grouped_stats

def calculate_weighted_stats(df: pd.DataFrame, 
                           value_column: str, 
                           weight_column: str) -> Dict[str, float]:
    """
    Calculate weighted statistics.
    
    Args:
        df: Pandas DataFrame containing the data
        value_column: Column containing values
        weight_column: Column containing weights
        
    Returns:
        Dictionary containing weighted statistics
    """
    # Remove rows with missing values
    clean_df = df[[value_column, weight_column]].dropna()
    values = clean_df[value_column].values
    weights = clean_df[weight_column].values
    
    # Weighted mean
    weighted_mean = np.average(values, weights=weights)
    
    # Weighted variance
    weighted_var = np.average((values - weighted_mean)**2, weights=weights)
    
    # Weighted standard deviation
    weighted_std = np.sqrt(weighted_var)
    
    # Weighted median (approximate)
    sorted_indices = np.argsort(values)
    sorted_values = values[sorted_indices]
    sorted_weights = weights[sorted_indices]
    cum_weights = np.cumsum(sorted_weights)
    median_idx = np.searchsorted(cum_weights, cum_weights[-1] / 2)
    weighted_median = sorted_values[median_idx]
    
    return {
        "weighted_mean": float(weighted_mean),
        "weighted_std": float(weighted_std),
        "weighted_variance": float(weighted_var),
        "weighted_median": float(weighted_median),
        "total_weight": float(weights.sum()),
        "effective_sample_size": float(weights.sum()**2 / np.sum(weights**2))
    }

def calculate_correlation_matrix(df: pd.DataFrame, 
                               method: str = 'pearson',
                               min_periods: int = 1) -> pd.DataFrame:
    """
    Calculate correlation matrix with multiple methods.
    
    Args:
        df: Pandas DataFrame containing the data
        method: Correlation method ('pearson', 'kendall', 'spearman')
        min_periods: Minimum number of observations required
        
    Returns:
        Correlation matrix as DataFrame
    """
    numeric_df = df.select_dtypes(include=[np.number])
    return numeric_df.corr(method=method, min_periods=min_periods)

def calculate_covariance_matrix(df: pd.DataFrame, 
                              min_periods: int = 1) -> pd.DataFrame:
    """
    Calculate covariance matrix.
    
    Args:
        df: Pandas DataFrame containing the data
        min_periods: Minimum number of observations required
        
    Returns:
        Covariance matrix as DataFrame
    """
    numeric_df = df.select_dtypes(include=[np.number])
    return numeric_df.cov(min_periods=min_periods)