"""
Data validation utilities.
"""

from typing import Any, Dict, List, Union
import re
from datetime import datetime
import pandas as pd
import numpy as np

def validate_numeric_data(data: Union[Dict[str, List[Any]], pd.DataFrame]) -> Dict[str, List[str]]:
    """
    Validate numeric data for analysis.
    
    Args:
        data: Data to validate (dictionary or DataFrame)
        
    Returns:
        Dictionary of validation errors by column
    """
    if isinstance(data, dict):
        df = pd.DataFrame(data)
    else:
        df = data
    
    errors = {}
    
    for column in df.select_dtypes(include=[np.number]).columns:
        column_errors = []
        
        # Check for missing values
        if df[column].isnull().any():
            column_errors.append("Contains missing values")
        
        # Check for infinite values
        if np.isinf(df[column]).any():
            column_errors.append("Contains infinite values")
        
        # Check for outliers (values more than 3 standard deviations from mean)
        mean = df[column].mean()
        std = df[column].std()
        outliers = df[column][abs(df[column] - mean) > 3 * std]
        if not outliers.empty:
            column_errors.append(f"Contains {len(outliers)} outliers")
        
        if column_errors:
            errors[column] = column_errors
    
    return errors

def validate_categorical_data(
    data: Union[Dict[str, List[Any]], pd.DataFrame],
    max_categories: int = 100
) -> Dict[str, List[str]]:
    """
    Validate categorical data for analysis.
    
    Args:
        data: Data to validate (dictionary or DataFrame)
        max_categories: Maximum number of unique categories allowed
        
    Returns:
        Dictionary of validation errors by column
    """
    if isinstance(data, dict):
        df = pd.DataFrame(data)
    else:
        df = data
    
    errors = {}
    
    for column in df.select_dtypes(include=["object"]).columns:
        column_errors = []
        
        # Check for missing values
        if df[column].isnull().any():
            column_errors.append("Contains missing values")
        
        # Check number of unique categories
        n_categories = df[column].nunique()
        if n_categories > max_categories:
            column_errors.append(f"Too many categories ({n_categories} > {max_categories})")
        
        # Check for empty strings
        if (df[column] == "").any():
            column_errors.append("Contains empty strings")
        
        if column_errors:
            errors[column] = column_errors
    
    return errors

def validate_date_data(
    data: Union[Dict[str, List[Any]], pd.DataFrame],
    date_format: str = "%Y-%m-%d"
) -> Dict[str, List[str]]:
    """
    Validate date data for analysis.
    
    Args:
        data: Data to validate (dictionary or DataFrame)
        date_format: Expected date format
        
    Returns:
        Dictionary of validation errors by column
    """
    if isinstance(data, dict):
        df = pd.DataFrame(data)
    else:
        df = data
    
    errors = {}
    
    for column in df.select_dtypes(include=["datetime64"]).columns:
        column_errors = []
        
        # Check for missing values
        if df[column].isnull().any():
            column_errors.append("Contains missing values")
        
        # Check for future dates
        future_dates = df[column][df[column] > datetime.now()]
        if not future_dates.empty:
            column_errors.append(f"Contains {len(future_dates)} future dates")
        
        if column_errors:
            errors[column] = column_errors
    
    return errors 