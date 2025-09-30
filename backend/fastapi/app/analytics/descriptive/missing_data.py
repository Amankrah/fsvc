"""
Missing data analysis and patterns.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
import seaborn as sns
import matplotlib.pyplot as plt

def analyze_missing_data(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Comprehensive missing data analysis.
    
    Args:
        df: Pandas DataFrame to analyze
        
    Returns:
        Dictionary containing missing data analysis
    """
    total_cells = df.shape[0] * df.shape[1]
    total_missing = df.isna().sum().sum()
    
    # Column-wise analysis
    missing_by_column = {}
    for col in df.columns:
        n_missing = df[col].isna().sum()
        missing_by_column[col] = {
            "count": int(n_missing),
            "percentage": float(n_missing / len(df) * 100),
            "data_type": str(df[col].dtype)
        }
    
    # Row-wise analysis
    missing_by_row = df.isna().sum(axis=1)
    rows_with_missing = (missing_by_row > 0).sum()
    
    # Missing patterns
    patterns = get_missing_patterns(df)
    
    # Missing data types
    missing_types = _classify_missing_types(df)
    
    return {
        "summary": {
            "total_cells": int(total_cells),
            "total_missing": int(total_missing),
            "total_missing_percentage": float(total_missing / total_cells * 100),
            "columns_with_missing": sum(1 for v in missing_by_column.values() if v["count"] > 0),
            "rows_with_missing": int(rows_with_missing),
            "rows_with_missing_percentage": float(rows_with_missing / len(df) * 100),
            "complete_rows": int(len(df) - rows_with_missing),
            "complete_rows_percentage": float((len(df) - rows_with_missing) / len(df) * 100)
        },
        "by_column": missing_by_column,
        "by_row": {
            "distribution": {
                "min": int(missing_by_row.min()),
                "max": int(missing_by_row.max()),
                "mean": float(missing_by_row.mean()),
                "median": float(missing_by_row.median())
            },
            "row_counts": missing_by_row.value_counts().to_dict()
        },
        "patterns": patterns,
        "missing_types": missing_types
    }

def get_missing_patterns(df: pd.DataFrame, 
                        max_patterns: int = 20) -> Dict[str, Any]:
    """
    Identify patterns in missing data.
    
    Args:
        df: Pandas DataFrame
        max_patterns: Maximum number of patterns to return
        
    Returns:
        Dictionary containing missing data patterns
    """
    # Create binary matrix of missing values
    missing_matrix = df.isna().astype(int)
    
    # Find unique patterns
    patterns = missing_matrix.value_counts()
    
    # Convert to more readable format
    pattern_dict = {}
    for i, (pattern, count) in enumerate(patterns.head(max_patterns).items()):
        if isinstance(pattern, tuple):
            missing_cols = [col for col, is_missing in zip(df.columns, pattern) if is_missing]
        else:
            missing_cols = [df.columns[0]] if pattern else []
        
        pattern_dict[f"pattern_{i+1}"] = {
            "missing_columns": missing_cols,
            "count": int(count),
            "percentage": float(count / len(df) * 100)
        }
    
    return {
        "unique_patterns": len(patterns),
        "top_patterns": pattern_dict,
        "most_common_pattern": pattern_dict.get("pattern_1", {})
    }

def calculate_missing_correlations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate correlations between missingness indicators.
    
    Args:
        df: Pandas DataFrame
        
    Returns:
        Correlation matrix of missing indicators
    """
    # Create binary matrix of missing values
    missing_matrix = df.isna().astype(int)
    
    # Only include columns with some missing values
    cols_with_missing = missing_matrix.columns[missing_matrix.sum() > 0]
    
    if len(cols_with_missing) < 2:
        return pd.DataFrame()
    
    return missing_matrix[cols_with_missing].corr()

def _classify_missing_types(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Classify potential types of missingness (MCAR, MAR, MNAR).
    
    Args:
        df: Pandas DataFrame
        
    Returns:
        Dictionary with missingness type indicators
    """
    # This is a simplified heuristic approach
    missing_corr = calculate_missing_correlations(df)
    
    if missing_corr.empty:
        return {"note": "No missing data correlations to analyze"}
    
    # Check for patterns suggesting different types
    high_correlations = (missing_corr.abs() > 0.3).sum().sum() - len(missing_corr)
    
    indicators = {
        "high_missing_correlations": int(high_correlations),
        "potential_mar": high_correlations > 0,
        "recommendation": "Further statistical tests needed for definitive classification"
    }
    
    return indicators

def create_missing_data_heatmap(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Create data for missing data heatmap visualization.
    
    Args:
        df: Pandas DataFrame
        
    Returns:
        Dictionary containing heatmap data
    """
    missing_matrix = df.isna().astype(int)
    
    return {
        "missing_matrix": missing_matrix.values.tolist(),
        "columns": df.columns.tolist(),
        "row_indices": list(range(len(df))),
        "missing_by_column": missing_matrix.sum().tolist(),
        "missing_by_row": missing_matrix.sum(axis=1).tolist()
    }

def analyze_missing_by_group(df: pd.DataFrame, 
                           group_column: str) -> Dict[str, Any]:
    """
    Analyze missing data patterns by group.
    
    Args:
        df: Pandas DataFrame
        group_column: Column to group by
        
    Returns:
        Dictionary containing grouped missing data analysis
    """
    grouped_missing = {}
    
    for group_name, group_df in df.groupby(group_column):
        missing_counts = group_df.isna().sum()
        grouped_missing[str(group_name)] = {
            "total_rows": len(group_df),
            "missing_by_column": {
                col: {
                    "count": int(missing_counts[col]),
                    "percentage": float(missing_counts[col] / len(group_df) * 100)
                }
                for col in df.columns if col != group_column
            }
        }
    
    return grouped_missing