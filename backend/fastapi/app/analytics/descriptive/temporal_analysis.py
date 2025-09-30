"""
Temporal and time-based analysis for research data.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, kpss
import warnings

def analyze_temporal_patterns(df: pd.DataFrame, 
                            date_column: str,
                            value_columns: List[str] = None) -> Dict[str, Any]:
    """
    Analyze temporal patterns in the data.
    
    Args:
        df: Pandas DataFrame with temporal data
        date_column: Name of the date/time column
        value_columns: Columns to analyze (None for all numeric)
        
    Returns:
        Dictionary containing temporal analysis
    """
    # Ensure date column is datetime
    df = df.copy()
    df[date_column] = pd.to_datetime(df[date_column])
    df = df.sort_values(date_column)
    
    if value_columns is None:
        value_columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    # Basic temporal statistics
    date_range = {
        "start": df[date_column].min().isoformat(),
        "end": df[date_column].max().isoformat(),
        "duration_days": (df[date_column].max() - df[date_column].min()).days,
        "total_observations": len(df),
        "date_coverage": _calculate_date_coverage(df[date_column])
    }
    
    # Temporal aggregations
    temporal_stats = {}
    
    for col in value_columns:
        if col in df.columns:
            temporal_stats[col] = {
                "daily": _aggregate_by_period(df, date_column, col, 'D'),
                "weekly": _aggregate_by_period(df, date_column, col, 'W'),
                "monthly": _aggregate_by_period(df, date_column, col, 'M'),
                "trends": _calculate_trends(df, date_column, col)
            }
    
    # Response patterns
    response_patterns = _analyze_response_patterns(df, date_column)
    
    return {
        "date_range": date_range,
        "temporal_statistics": temporal_stats,
        "response_patterns": response_patterns,
        "data_quality": _assess_temporal_data_quality(df, date_column)
    }

def _calculate_date_coverage(date_series: pd.Series) -> Dict[str, Any]:
    """Calculate date coverage statistics."""
    date_range = pd.date_range(start=date_series.min(), end=date_series.max(), freq='D')
    unique_dates = date_series.dt.date.unique()
    
    return {
        "total_days_in_range": len(date_range),
        "days_with_data": len(unique_dates),
        "coverage_percentage": float(len(unique_dates) / len(date_range) * 100),
        "gaps": _identify_date_gaps(date_series)
    }

def _identify_date_gaps(date_series: pd.Series, 
                       threshold_days: int = 7) -> List[Dict[str, Any]]:
    """Identify significant gaps in date coverage."""
    sorted_dates = sorted(date_series.dt.date.unique())
    gaps = []
    
    for i in range(1, len(sorted_dates)):
        gap_days = (sorted_dates[i] - sorted_dates[i-1]).days
        if gap_days > threshold_days:
            gaps.append({
                "start": sorted_dates[i-1].isoformat(),
                "end": sorted_dates[i].isoformat(),
                "gap_days": gap_days
            })
    
    return gaps

def _aggregate_by_period(df: pd.DataFrame, 
                        date_col: str, 
                        value_col: str, 
                        freq: str) -> Dict[str, Any]:
    """Aggregate data by time period."""
    grouped = df.groupby(pd.Grouper(key=date_col, freq=freq))[value_col].agg([
        'count', 'mean', 'std', 'min', 'max'
    ])
    
    return {
        "mean": float(grouped['mean'].mean()),
        "std": float(grouped['std'].mean()),
        "min_period_count": int(grouped['count'].min()),
        "max_period_count": int(grouped['count'].max()),
        "periods_with_data": int((grouped['count'] > 0).sum()),
        "total_periods": len(grouped)
    }

def _calculate_trends(df: pd.DataFrame, 
                     date_col: str, 
                     value_col: str) -> Dict[str, Any]:
    """Calculate trend statistics."""
    # Convert dates to numeric for regression
    df = df.copy()
    df['date_numeric'] = (df[date_col] - df[date_col].min()).dt.days
    
    # Simple linear regression for trend
    from scipy import stats as scipy_stats
    clean_data = df[[value_col, 'date_numeric']].dropna()
    
    if len(clean_data) < 2:
        return {"error": "Insufficient data for trend analysis"}
    
    slope, intercept, r_value, p_value, std_err = scipy_stats.linregress(
        clean_data['date_numeric'], clean_data[value_col]
    )
    
    return {
        "linear_trend": {
            "slope": float(slope),
            "intercept": float(intercept),
            "r_squared": float(r_value ** 2),
            "p_value": float(p_value),
            "trend_direction": "increasing" if slope > 0 else "decreasing",
            "trend_significant": p_value < 0.05
        }
    }

def _analyze_response_patterns(df: pd.DataFrame, 
                             date_col: str) -> Dict[str, Any]:
    """Analyze patterns in response timing."""
    df = df.copy()
    
    # Day of week analysis
    df['day_of_week'] = df[date_col].dt.day_name()
    df['hour'] = df[date_col].dt.hour
    
    dow_counts = df['day_of_week'].value_counts()
    hour_counts = df['hour'].value_counts()
    
    return {
        "by_day_of_week": dow_counts.to_dict(),
        "by_hour": hour_counts.to_dict(),
        "busiest_day": dow_counts.index[0] if not dow_counts.empty else None,
        "busiest_hour": int(hour_counts.index[0]) if not hour_counts.empty else None,
        "weekend_percentage": float(
            df[df[date_col].dt.dayofweek.isin([5, 6])].shape[0] / len(df) * 100
        )
    }

def _assess_temporal_data_quality(df: pd.DataFrame, 
                                date_col: str) -> Dict[str, Any]:
    """Assess quality of temporal data."""
    # Check for duplicates
    duplicate_dates = df[date_col].duplicated().sum()
    
    # Check for future dates
    future_dates = (df[date_col] > pd.Timestamp.now()).sum()
    
    # Check for very old dates (potential errors)
    very_old_dates = (df[date_col] < pd.Timestamp('1900-01-01')).sum()
    
    return {
        "duplicate_timestamps": int(duplicate_dates),
        "future_dates": int(future_dates),
        "very_old_dates": int(very_old_dates),
        "date_parsing_errors": df[date_col].isna().sum()
    }

def calculate_time_series_stats(series: pd.Series, 
                              date_index: pd.DatetimeIndex) -> Dict[str, Any]:
    """
    Calculate time series specific statistics.
    
    Args:
        series: Value series
        date_index: DateTime index
        
    Returns:
        Dictionary with time series statistics
    """
    # Create time series
    ts = pd.Series(series.values, index=date_index).sort_index()
    ts = ts[~ts.index.duplicated(keep='first')]
    
    # Basic stats
    stats_dict = {
        "length": len(ts),
        "frequency": pd.infer_freq(ts.index),
        "has_missing_periods": len(ts) < len(pd.date_range(ts.index.min(), ts.index.max(), freq='D'))
    }
    
    # Stationarity tests
    if len(ts) > 20:
        # Augmented Dickey-Fuller test
        adf_result = adfuller(ts.dropna())
        stats_dict["adf_test"] = {
            "statistic": float(adf_result[0]),
            "p_value": float(adf_result[1]),
            "is_stationary": adf_result[1] < 0.05
        }
        
        # KPSS test
        with warnings.catch_warnings():
            warnings.filterwarnings('ignore')
            kpss_result = kpss(ts.dropna(), regression='c')
            stats_dict["kpss_test"] = {
                "statistic": float(kpss_result[0]),
                "p_value": float(kpss_result[1]),
                "is_stationary": kpss_result[1] > 0.05
            }
    
    # Autocorrelation
    if len(ts) > 10:
        stats_dict["autocorrelation"] = {
            "lag_1": float(ts.autocorr(lag=1)) if len(ts) > 1 else None,
            "lag_7": float(ts.autocorr(lag=7)) if len(ts) > 7 else None,
            "lag_30": float(ts.autocorr(lag=30)) if len(ts) > 30 else None
        }
    
    return stats_dict

def detect_seasonality(series: pd.Series, 
                      date_index: pd.DatetimeIndex,
                      period: int = None) -> Dict[str, Any]:
    """
    Detect seasonality in time series data.
    
    Args:
        series: Value series
        date_index: DateTime index  
        period: Seasonal period (auto-detect if None)
        
    Returns:
        Dictionary with seasonality analysis
    """
    # Create clean time series
    ts = pd.Series(series.values, index=date_index).sort_index()
    ts = ts[~ts.index.duplicated(keep='first')]
    ts = ts.asfreq('D').interpolate()  # Daily frequency with interpolation
    
    if len(ts) < 2 * (period or 7):
        return {"error": "Insufficient data for seasonality detection"}
    
    try:
        # Seasonal decomposition
        if period is None:
            # Try to infer period
            if len(ts) > 365:
                period = 365  # Yearly
            elif len(ts) > 30:
                period = 30   # Monthly
            else:
                period = 7    # Weekly
        
        decomposition = seasonal_decompose(ts, model='additive', period=period)
        
        # Calculate seasonality strength
        seasonal_strength = 1 - (decomposition.resid.var() / 
                               (decomposition.resid + decomposition.seasonal).var())
        
        return {
            "period_used": period,
            "seasonal_strength": float(seasonal_strength),
            "has_seasonality": seasonal_strength > 0.1,
            "trend_strength": float(1 - (decomposition.resid.var() / 
                                       (decomposition.resid + decomposition.trend).var())),
            "seasonal_peaks": _identify_seasonal_peaks(decomposition.seasonal)
        }
        
    except Exception as e:
        return {"error": f"Seasonality detection failed: {str(e)}"}

def _identify_seasonal_peaks(seasonal_component: pd.Series) -> List[int]:
    """Identify peaks in seasonal component."""
    # Find local maxima
    peaks = []
    for i in range(1, len(seasonal_component) - 1):
        if (seasonal_component.iloc[i] > seasonal_component.iloc[i-1] and 
            seasonal_component.iloc[i] > seasonal_component.iloc[i+1]):
            peaks.append(i)
    
    return peaks[:5]  # Return first 5 peaks