"""
Categorical data analysis functions.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Union
from scipy.stats import chi2_contingency, chi2
import itertools

def analyze_categorical(series: pd.Series, 
                       max_categories: int = 50) -> Dict[str, Any]:
    """
    Comprehensive analysis of categorical data.
    
    Args:
        series: Pandas Series containing categorical data
        max_categories: Maximum number of categories to display
        
    Returns:
        Dictionary containing categorical analysis
    """
    # Basic counts
    value_counts = series.value_counts()
    n_total = len(series)
    n_unique = series.nunique()
    n_missing = series.isna().sum()
    
    analysis = {
        "total_count": n_total,
        "unique_categories": n_unique,
        "missing_count": n_missing,
        "missing_percentage": float(n_missing / n_total * 100) if n_total > 0 else 0,
        "mode": str(value_counts.index[0]) if not value_counts.empty else None,
        "mode_count": int(value_counts.iloc[0]) if not value_counts.empty else 0,
        "mode_percentage": float(value_counts.iloc[0] / n_total * 100) if n_total > 0 and not value_counts.empty else 0
    }
    
    # Category frequencies
    if n_unique <= max_categories:
        frequencies = {}
        percentages = {}
        cumulative_percentage = 0
        
        for category, count in value_counts.items():
            percentage = count / n_total * 100
            cumulative_percentage += percentage
            frequencies[str(category)] = {
                "count": int(count),
                "percentage": float(percentage),
                "cumulative_percentage": float(cumulative_percentage)
            }
        
        analysis["frequencies"] = frequencies
    else:
        # Show top categories if too many
        top_n = min(20, max_categories)
        top_categories = value_counts.head(top_n)
        
        frequencies = {}
        for category, count in top_categories.items():
            percentage = count / n_total * 100
            frequencies[str(category)] = {
                "count": int(count),
                "percentage": float(percentage)
            }
        
        # Add "Other" category
        other_count = value_counts.iloc[top_n:].sum()
        frequencies["_other_"] = {
            "count": int(other_count),
            "percentage": float(other_count / n_total * 100)
        }
        
        analysis["frequencies"] = frequencies
        analysis["note"] = f"Showing top {top_n} categories out of {n_unique}"
    
    # Diversity metrics
    analysis["diversity"] = calculate_diversity_metrics(value_counts)
    
    return analysis

def calculate_chi_square(df: pd.DataFrame, 
                        var1: str, 
                        var2: str) -> Dict[str, Any]:
    """
    Perform chi-square test of independence.
    
    Args:
        df: Pandas DataFrame containing the data
        var1: First categorical variable
        var2: Second categorical variable
        
    Returns:
        Dictionary containing chi-square test results
    """
    # Create contingency table
    crosstab = pd.crosstab(df[var1], df[var2])
    
    # Perform chi-square test
    chi2_stat, p_value, dof, expected = chi2_contingency(crosstab)
    
    # Calculate effect size (Cramér's V)
    n = crosstab.sum().sum()
    min_dim = min(crosstab.shape[0] - 1, crosstab.shape[1] - 1)
    cramers_v = np.sqrt(chi2_stat / (n * min_dim)) if min_dim > 0 else 0
    
    # Contribution to chi-square
    chi2_contributions = ((crosstab - expected) ** 2 / expected)
    
    return {
        "chi2_statistic": float(chi2_stat),
        "p_value": float(p_value),
        "degrees_of_freedom": int(dof),
        "cramers_v": float(cramers_v),
        "effect_size_interpretation": _interpret_cramers_v(cramers_v),
        "is_significant": p_value < 0.05,
        "contingency_table": crosstab.to_dict(),
        "expected_frequencies": pd.DataFrame(expected, 
                                            index=crosstab.index, 
                                            columns=crosstab.columns).to_dict(),
        "chi2_contributions": chi2_contributions.to_dict(),
        "sample_size": int(n)
    }

def _interpret_cramers_v(v: float) -> str:
    """Interpret Cramér's V effect size."""
    if v < 0.1:
        return "Negligible association"
    elif v < 0.3:
        return "Weak association"
    elif v < 0.5:
        return "Moderate association"
    else:
        return "Strong association"

def calculate_cramers_v(df: pd.DataFrame, 
                       var1: str, 
                       var2: str) -> float:
    """
    Calculate Cramér's V statistic for association between categorical variables.
    
    Args:
        df: Pandas DataFrame containing the data
        var1: First categorical variable
        var2: Second categorical variable
        
    Returns:
        Cramér's V statistic
    """
    crosstab = pd.crosstab(df[var1], df[var2])
    chi2_stat = chi2_contingency(crosstab)[0]
    n = crosstab.sum().sum()
    min_dim = min(crosstab.shape[0] - 1, crosstab.shape[1] - 1)
    
    return np.sqrt(chi2_stat / (n * min_dim)) if min_dim > 0 else 0

def analyze_cross_tabulation(df: pd.DataFrame, 
                           var1: str, 
                           var2: str,
                           normalize: str = None) -> Dict[str, Any]:
    """
    Create detailed cross-tabulation analysis.
    
    Args:
        df: Pandas DataFrame containing the data
        var1: First categorical variable (rows)
        var2: Second categorical variable (columns)
        normalize: How to normalize ('index', 'columns', 'all', or None)
        
    Returns:
        Dictionary containing cross-tabulation analysis
    """
    # Create crosstab
    crosstab = pd.crosstab(df[var1], df[var2], margins=True, margins_name="Total")
    
    # Create normalized versions
    crosstab_pct_row = pd.crosstab(df[var1], df[var2], normalize='index') * 100
    crosstab_pct_col = pd.crosstab(df[var1], df[var2], normalize='columns') * 100
    crosstab_pct_all = pd.crosstab(df[var1], df[var2], normalize='all') * 100
    
    # Chi-square test
    chi2_results = calculate_chi_square(df, var1, var2)
    
    return {
        "crosstab": crosstab.to_dict(),
        "row_percentages": crosstab_pct_row.to_dict(),
        "column_percentages": crosstab_pct_col.to_dict(),
        "total_percentages": crosstab_pct_all.to_dict(),
        "chi_square": chi2_results,
        "row_totals": crosstab.loc[:, "Total"].to_dict(),
        "column_totals": crosstab.loc["Total", :].to_dict(),
        "grand_total": int(crosstab.loc["Total", "Total"])
    }

def calculate_diversity_metrics(value_counts: pd.Series) -> Dict[str, float]:
    """
    Calculate diversity metrics for categorical data.
    
    Args:
        value_counts: Series with category counts
        
    Returns:
        Dictionary containing diversity metrics
    """
    # Convert to probabilities
    total = value_counts.sum()
    if total == 0:
        return {
            "shannon_entropy": 0.0,
            "simpson_index": 0.0,
            "gini_simpson": 0.0,
            "evenness": 0.0
        }
    
    probs = value_counts / total
    
    # Shannon entropy
    shannon_entropy = -np.sum(probs * np.log(probs + 1e-10))
    
    # Simpson's index (probability of two random items being same category)
    simpson_index = np.sum(probs ** 2)
    
    # Gini-Simpson index (probability of two random items being different)
    gini_simpson = 1 - simpson_index
    
    # Pielou's evenness (normalized Shannon entropy)
    max_entropy = np.log(len(value_counts))
    evenness = shannon_entropy / max_entropy if max_entropy > 0 else 0
    
    return {
        "shannon_entropy": float(shannon_entropy),
        "simpson_index": float(simpson_index),
        "gini_simpson": float(gini_simpson),
        "evenness": float(evenness)
    }

def analyze_categorical_associations(df: pd.DataFrame,
                                   categorical_columns: List[str] = None,
                                   method: str = 'cramers_v') -> pd.DataFrame:
    """
    Calculate pairwise associations between all categorical variables.
    
    Args:
        df: Pandas DataFrame containing the data
        categorical_columns: List of categorical columns (None for auto-detect)
        method: Association measure ('cramers_v' or 'theil_u')
        
    Returns:
        DataFrame with pairwise association measures
    """
    if categorical_columns is None:
        categorical_columns = df.select_dtypes(include=['object', 'category']).columns.tolist()
    
    n_vars = len(categorical_columns)
    association_matrix = pd.DataFrame(
        np.zeros((n_vars, n_vars)),
        index=categorical_columns,
        columns=categorical_columns
    )
    
    for i, var1 in enumerate(categorical_columns):
        for j, var2 in enumerate(categorical_columns):
            if i == j:
                association_matrix.iloc[i, j] = 1.0
            elif i < j:
                if method == 'cramers_v':
                    assoc = calculate_cramers_v(df, var1, var2)
                else:
                    assoc = 0.0  # Placeholder for other methods
                
                association_matrix.iloc[i, j] = assoc
                association_matrix.iloc[j, i] = assoc
    
    return association_matrix