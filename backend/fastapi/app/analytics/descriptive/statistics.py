"""
Descriptive statistics module for data analysis.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List

def calculate_basic_stats(df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
    """
    Calculate basic descriptive statistics for numerical columns.
    
    Args:
        df: Pandas DataFrame containing the data
        
    Returns:
        Dictionary containing statistics for each numerical column
    """
    stats = {}
    for column in df.select_dtypes(include=[np.number]).columns:
        stats[column] = {
            "mean": float(df[column].mean()),
            "median": float(df[column].median()),
            "std": float(df[column].std()),
            "min": float(df[column].min()),
            "max": float(df[column].max()),
            "count": int(df[column].count())
        }
    return stats

def calculate_correlation_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate correlation matrix for numerical columns.
    
    Args:
        df: Pandas DataFrame containing the data
        
    Returns:
        Correlation matrix as a DataFrame
    """
    return df.select_dtypes(include=[np.number]).corr()

def calculate_frequency_distribution(df: pd.DataFrame, column: str) -> Dict[str, int]:
    """
    Calculate frequency distribution for a categorical column.
    
    Args:
        df: Pandas DataFrame containing the data
        column: Name of the categorical column
        
    Returns:
        Dictionary containing frequency counts for each category
    """
    return df[column].value_counts().to_dict() 