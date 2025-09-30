"""
Generate comprehensive statistical summaries and reports.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from .basic_statistics import calculate_basic_stats, calculate_grouped_stats
from .distributions import analyze_distribution, test_normality
from .categorical_analysis import analyze_categorical
from .outlier_detection import get_outlier_summary
from .missing_data import analyze_missing_data

def generate_full_report(df: pd.DataFrame,
                        project_name: str = "Research Data Analysis",
                        include_advanced: bool = True) -> Dict[str, Any]:
    """
    Generate a comprehensive statistical report.
    
    Args:
        df: DataFrame to analyze
        project_name: Name of the project
        include_advanced: Include advanced statistics
        
    Returns:
        Dictionary containing full statistical report
    """
    report = {
        "metadata": {
            "project_name": project_name,
            "analysis_date": datetime.now().isoformat(),
            "dataset_shape": {
                "rows": len(df),
                "columns": len(df.columns)
            },
            "column_types": df.dtypes.astype(str).to_dict()
        }
    }
    
    # Data quality
    report["data_quality"] = {
        "missing_data": analyze_missing_data(df),
        "duplicates": {
            "duplicate_rows": int(df.duplicated().sum()),
            "duplicate_percentage": float(df.duplicated().sum() / len(df) * 100)
        }
    }
    
    # Numeric variables analysis
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if numeric_cols:
        report["numeric_analysis"] = {
            "basic_statistics": calculate_basic_stats(df, numeric_cols),
            "distributions": {col: analyze_distribution(df[col]) 
                            for col in numeric_cols},
            "outliers": get_outlier_summary(df, numeric_cols)
        }
        
        if include_advanced:
            report["numeric_analysis"]["normality_tests"] = {
                col: test_normality(df[col]) for col in numeric_cols
            }
            report["numeric_analysis"]["correlations"] = df[numeric_cols].corr().to_dict()
    
    # Categorical variables analysis
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    if categorical_cols:
        report["categorical_analysis"] = {
            col: analyze_categorical(df[col]) for col in categorical_cols
        }
    
    # Summary statistics by groups (if applicable)
    if categorical_cols and numeric_cols:
        report["grouped_analysis"] = {}
        for cat_col in categorical_cols[:3]:  # Limit to first 3 categorical
            if df[cat_col].nunique() <= 10:  # Only for reasonable number of groups
                report["grouped_analysis"][cat_col] = calculate_grouped_stats(
                    df, cat_col, numeric_cols[:5]  # Limit numeric columns
                ).to_dict()
    
    return report

def generate_executive_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Generate a concise executive summary of the data.
    
    Args:
        df: DataFrame to analyze
        
    Returns:
        Dictionary containing executive summary
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    
    # Key insights
    insights = []
    
    # Data completeness
    missing_pct = df.isna().sum().sum() / (len(df) * len(df.columns)) * 100
    if missing_pct > 20:
        insights.append(f"High missing data rate: {missing_pct:.1f}%")
    elif missing_pct > 5:
        insights.append(f"Moderate missing data: {missing_pct:.1f}%")
    else:
        insights.append(f"Good data completeness: {100-missing_pct:.1f}% complete")
    
    # Numeric insights
    if len(numeric_cols) > 0:
        # Check for highly skewed variables
        for col in numeric_cols:
            skewness = df[col].skew()
            if abs(skewness) > 2:
                insights.append(f"{col} is highly skewed (skewness: {skewness:.2f})")
        
        # Check for potential outliers
        outlier_summary = get_outlier_summary(df, numeric_cols.tolist())
        high_outlier_cols = [col for col, results in outlier_summary.items() 
                            if results.get('iqr', {}).get('outlier_percentage', 0) > 10]
        if high_outlier_cols:
            insights.append(f"High outlier rate in: {', '.join(high_outlier_cols)}")
    
    # Categorical insights
    if len(categorical_cols) > 0:
        # Check for high cardinality
        high_cardinality = [col for col in categorical_cols 
                           if df[col].nunique() > 50]
        if high_cardinality:
            insights.append(f"High cardinality categorical variables: {', '.join(high_cardinality)}")
    
    summary = {
        "overview": {
            "total_observations": len(df),
            "total_variables": len(df.columns),
            "numeric_variables": len(numeric_cols),
            "categorical_variables": len(categorical_cols),
            "memory_usage_mb": float(df.memory_usage(deep=True).sum() / 1024**2)
        },
        "data_quality_summary": {
            "completeness_percentage": float(100 - missing_pct),
            "columns_with_missing": int((df.isna().sum() > 0).sum()),
            "duplicate_rows": int(df.duplicated().sum())
        },
        "key_insights": insights,
        "recommendations": _generate_recommendations(df, insights)
    }
    
    return summary

def _generate_recommendations(df: pd.DataFrame, 
                            insights: List[str]) -> List[str]:
    """Generate analysis recommendations based on data characteristics."""
    recommendations = []
    
    # Missing data recommendations
    missing_pct = df.isna().sum().sum() / (len(df) * len(df.columns)) * 100
    if missing_pct > 20:
        recommendations.append("Consider imputation strategies or collecting more complete data")
    elif missing_pct > 5:
        recommendations.append("Review missing data patterns before analysis")
    
    # Check for date columns
    date_cols = [col for col in df.columns 
                if 'date' in col.lower() or 'time' in col.lower()]
    if date_cols:
        recommendations.append("Consider time series analysis for temporal patterns")
    
    # Check for location columns
    location_cols = [col for col in df.columns 
                    if any(term in col.lower() for term in ['lat', 'lon', 'location', 'gps'])]
    if location_cols:
        recommendations.append("Spatial analysis recommended for geographic data")
    
    # Sample size recommendations
    if len(df) < 30:
        recommendations.append("Small sample size - use non-parametric methods")
    elif len(df) < 100:
        recommendations.append("Moderate sample size - verify statistical assumptions")
    
    return recommendations

def export_statistics(analysis_results: Dict[str, Any],
                     format: str = 'json',
                     include_metadata: bool = True) -> str:
    """
    Export analysis results in various formats.
    
    Args:
        analysis_results: Dictionary of analysis results
        format: Export format ('json', 'html', 'markdown')
        include_metadata: Include analysis metadata
        
    Returns:
        Formatted string of results
    """
    if format == 'json':
        return json.dumps(analysis_results, indent=2, default=str)
    
    elif format == 'markdown':
        md_lines = [f"# {analysis_results.get('metadata', {}).get('project_name', 'Statistical Analysis Report')}"]
        md_lines.append(f"\n*Generated on: {analysis_results.get('metadata', {}).get('analysis_date', 'N/A')}*\n")
        
        # Data Overview
        if 'metadata' in analysis_results:
            md_lines.append("## Data Overview")
            shape = analysis_results['metadata'].get('dataset_shape', {})
            md_lines.append(f"- **Rows**: {shape.get('rows', 'N/A')}")
            md_lines.append(f"- **Columns**: {shape.get('columns', 'N/A')}\n")
        
        # Data Quality
        if 'data_quality' in analysis_results:
            md_lines.append("## Data Quality")
            missing = analysis_results['data_quality']['missing_data']['summary']
            md_lines.append(f"- **Missing Data**: {missing.get('total_missing_percentage', 0):.2f}%")
            md_lines.append(f"- **Complete Rows**: {missing.get('complete_rows_percentage', 0):.2f}%\n")
        
        # Key Statistics
        if 'numeric_analysis' in analysis_results:
            md_lines.append("## Numeric Variables Summary")
            basic_stats = analysis_results['numeric_analysis'].get('basic_statistics', {})
            
            for var, stats in basic_stats.items():
                md_lines.append(f"\n### {var}")
                md_lines.append(f"- Mean: {stats.get('mean', 'N/A'):.4f}")
                md_lines.append(f"- Std Dev: {stats.get('std', 'N/A'):.4f}")
                md_lines.append(f"- Min: {stats.get('min', 'N/A'):.4f}")
                md_lines.append(f"- Max: {stats.get('max', 'N/A'):.4f}")
        
        return '\n'.join(md_lines)
    
    elif format == 'html':
        html_parts = [
            "<html><head><title>Statistical Analysis Report</title>",
            "<style>",
            "body { font-family: Arial, sans-serif; margin: 20px; }",
            "table { border-collapse: collapse; width: 100%; margin: 20px 0; }",
            "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }",
            "th { background-color: #f2f2f2; }",
            "</style></head><body>"
        ]
        
        # Convert report to HTML tables
        html_parts.append(f"<h1>{analysis_results.get('metadata', {}).get('project_name', 'Statistical Analysis Report')}</h1>")
        
        # Add more HTML formatting as needed
        html_parts.append("</body></html>")
        
        return '\n'.join(html_parts)
    
    else:
        raise ValueError(f"Unsupported format: {format}")