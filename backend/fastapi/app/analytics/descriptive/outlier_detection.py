"""
Outlier detection methods for research data.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Union
from scipy import stats
from sklearn.ensemble import IsolationForest
from sklearn.covariance import EllipticEnvelope
import warnings

def detect_outliers_iqr(series: pd.Series, 
                       multiplier: float = 1.5) -> Dict[str, Any]:
    """
    Detect outliers using the Interquartile Range (IQR) method.
    
    Args:
        series: Pandas Series containing numeric data
        multiplier: IQR multiplier for outlier bounds (typically 1.5 or 3)
        
    Returns:
        Dictionary containing outlier information
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 4:
        return {"error": "Insufficient data for IQR outlier detection"}
    
    q1 = clean_series.quantile(0.25)
    q3 = clean_series.quantile(0.75)
    iqr = q3 - q1
    
    lower_bound = q1 - multiplier * iqr
    upper_bound = q3 + multiplier * iqr
    
    outliers_mask = (clean_series < lower_bound) | (clean_series > upper_bound)
    outliers = clean_series[outliers_mask]
    
    return {
        "method": "IQR",
        "multiplier": multiplier,
        "q1": float(q1),
        "q3": float(q3),
        "iqr": float(iqr),
        "lower_bound": float(lower_bound),
        "upper_bound": float(upper_bound),
        "n_outliers": int(outliers_mask.sum()),
        "outlier_percentage": float(outliers_mask.sum() / len(clean_series) * 100),
        "outlier_indices": outliers.index.tolist(),
        "outlier_values": outliers.values.tolist(),
        "outlier_summary": {
            "min": float(outliers.min()) if len(outliers) > 0 else None,
            "max": float(outliers.max()) if len(outliers) > 0 else None,
            "mean": float(outliers.mean()) if len(outliers) > 0 else None
        }
    }

def detect_outliers_zscore(series: pd.Series, 
                         threshold: float = 3.0) -> Dict[str, Any]:
    """
    Detect outliers using the Z-score method.
    
    Args:
        series: Pandas Series containing numeric data
        threshold: Z-score threshold for outliers
        
    Returns:
        Dictionary containing outlier information
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 3:
        return {"error": "Insufficient data for Z-score outlier detection"}
    
    mean = clean_series.mean()
    std = clean_series.std()
    
    if std == 0:
        return {"error": "Standard deviation is zero, cannot calculate Z-scores"}
    
    z_scores = np.abs((clean_series - mean) / std)
    outliers_mask = z_scores > threshold
    outliers = clean_series[outliers_mask]
    outlier_z_scores = z_scores[outliers_mask]
    
    return {
        "method": "Z-score",
        "threshold": threshold,
        "mean": float(mean),
        "std": float(std),
        "n_outliers": int(outliers_mask.sum()),
        "outlier_percentage": float(outliers_mask.sum() / len(clean_series) * 100),
        "outlier_indices": outliers.index.tolist(),
        "outlier_values": outliers.values.tolist(),
        "outlier_z_scores": outlier_z_scores.values.tolist(),
        "outlier_summary": {
            "min": float(outliers.min()) if len(outliers) > 0 else None,
            "max": float(outliers.max()) if len(outliers) > 0 else None,
            "mean": float(outliers.mean()) if len(outliers) > 0 else None,
            "max_z_score": float(outlier_z_scores.max()) if len(outliers) > 0 else None
        }
    }

def detect_outliers_isolation_forest(df: pd.DataFrame, 
                                   columns: List[str] = None,
                                   contamination: float = 0.1) -> Dict[str, Any]:
    """
    Detect multivariate outliers using Isolation Forest.
    
    Args:
        df: Pandas DataFrame containing numeric data
        columns: Columns to use for outlier detection
        contamination: Expected proportion of outliers
        
    Returns:
        Dictionary containing outlier information
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    X = df[columns].dropna()
    
    if len(X) < 10:
        return {"error": "Insufficient data for Isolation Forest"}
    
    # Fit Isolation Forest
    iso_forest = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=100
    )
    
    outlier_labels = iso_forest.fit_predict(X)
    outlier_scores = iso_forest.score_samples(X)
    
    # -1 indicates outliers
    outliers_mask = outlier_labels == -1
    outlier_indices = X.index[outliers_mask].tolist()
    
    return {
        "method": "Isolation Forest",
        "contamination": contamination,
        "columns_used": columns,
        "n_samples": len(X),
        "n_outliers": int(outliers_mask.sum()),
        "outlier_percentage": float(outliers_mask.sum() / len(X) * 100),
        "outlier_indices": outlier_indices,
        "outlier_scores": {
            "min": float(outlier_scores[outliers_mask].min()) if outliers_mask.sum() > 0 else None,
            "max": float(outlier_scores[outliers_mask].max()) if outliers_mask.sum() > 0 else None,
            "mean": float(outlier_scores[outliers_mask].mean()) if outliers_mask.sum() > 0 else None
        },
        "threshold_score": float(np.percentile(outlier_scores, (1 - contamination) * 100))
    }

def detect_outliers_mad(series: pd.Series, 
                       threshold: float = 3.5) -> Dict[str, Any]:
    """
    Detect outliers using Median Absolute Deviation (MAD).
    More robust than Z-score for non-normal distributions.
    
    Args:
        series: Pandas Series containing numeric data
        threshold: MAD threshold for outliers
        
    Returns:
        Dictionary containing outlier information
    """
    clean_series = series.dropna()
    
    if len(clean_series) < 3:
        return {"error": "Insufficient data for MAD outlier detection"}
    
    median = clean_series.median()
    mad = np.median(np.abs(clean_series - median))
    
    if mad == 0:
        # Use mean absolute deviation as fallback
        mad = np.mean(np.abs(clean_series - median))
        if mad == 0:
            return {"error": "MAD is zero, cannot detect outliers"}
    
    # Modified Z-score using MAD
    modified_z_scores = 0.6745 * (clean_series - median) / mad
    outliers_mask = np.abs(modified_z_scores) > threshold
    outliers = clean_series[outliers_mask]
    
    return {
        "method": "MAD (Median Absolute Deviation)",
        "threshold": threshold,
        "median": float(median),
        "mad": float(mad),
        "n_outliers": int(outliers_mask.sum()),
        "outlier_percentage": float(outliers_mask.sum() / len(clean_series) * 100),
        "outlier_indices": outliers.index.tolist(),
        "outlier_values": outliers.values.tolist(),
        "outlier_modified_z_scores": modified_z_scores[outliers_mask].values.tolist(),
        "outlier_summary": {
            "min": float(outliers.min()) if len(outliers) > 0 else None,
            "max": float(outliers.max()) if len(outliers) > 0 else None,
            "median": float(outliers.median()) if len(outliers) > 0 else None
        }
    }

def get_outlier_summary(df: pd.DataFrame, 
                       columns: List[str] = None,
                       methods: List[str] = None) -> Dict[str, Dict[str, Any]]:
    """
    Comprehensive outlier detection using multiple methods.
    
    Args:
        df: Pandas DataFrame containing the data
        columns: Columns to analyze (None for all numeric)
        methods: List of methods to use
        
    Returns:
        Dictionary containing outlier analysis for each column
    """
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if methods is None:
        methods = ['iqr', 'zscore', 'mad']
    
    results = {}
    
    for col in columns:
        col_results = {
            "column": col,
            "data_points": int(df[col].notna().sum())
        }
        
        if 'iqr' in methods:
            col_results['iqr'] = detect_outliers_iqr(df[col])
        
        if 'zscore' in methods:
            col_results['zscore'] = detect_outliers_zscore(df[col])
        
        if 'mad' in methods:
            col_results['mad'] = detect_outliers_mad(df[col])
        
        # Consensus outliers (detected by multiple methods)
        all_outlier_indices = []
        for method in col_results:
            if isinstance(col_results[method], dict) and 'outlier_indices' in col_results[method]:
                all_outlier_indices.extend(col_results[method]['outlier_indices'])
        
        # Count how many times each index appears
        from collections import Counter
        outlier_counts = Counter(all_outlier_indices)
        consensus_outliers = [idx for idx, count in outlier_counts.items() if count >= 2]
        
        col_results['consensus'] = {
            "indices": consensus_outliers,
            "count": len(consensus_outliers),
            "percentage": float(len(consensus_outliers) / col_results["data_points"] * 100) if col_results["data_points"] > 0 else 0
        }
        
        results[col] = col_results
    
    return results

def remove_outliers(df: pd.DataFrame, 
                   column: str, 
                   method: str = 'iqr',
                   **kwargs) -> pd.DataFrame:
    """
    Remove outliers from DataFrame using specified method.
    
    Args:
        df: Pandas DataFrame
        column: Column to check for outliers
        method: Outlier detection method
        **kwargs: Additional arguments for the detection method
        
    Returns:
        DataFrame with outliers removed
    """
    if method == 'iqr':
        result = detect_outliers_iqr(df[column], **kwargs)
    elif method == 'zscore':
        result = detect_outliers_zscore(df[column], **kwargs)
    elif method == 'mad':
        result = detect_outliers_mad(df[column], **kwargs)
    else:
        raise ValueError(f"Unknown method: {method}")
    
    if 'error' not in result:
        outlier_indices = result['outlier_indices']
        return df.drop(index=outlier_indices)
    else:
        warnings.warn(f"Could not detect outliers: {result['error']}")
        return df