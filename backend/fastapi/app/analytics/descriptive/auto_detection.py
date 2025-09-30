"""
Auto-detection system for descriptive statistics.
Automatically suggests appropriate descriptive analyses based on data characteristics.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union, Tuple
from collections import Counter
import warnings

# Import base classes
from ..auto_detect.base_detector import (
    BaseAutoDetector, DataCharacteristics, AnalysisRecommendation, 
    DataType, AnalysisConfidence
)

class DescriptiveAutoDetector(BaseAutoDetector):
    """
    Comprehensive auto-detection system for descriptive statistics.
    """
    
    def __init__(self):
        super().__init__("Descriptive Analytics")
        
    def get_method_requirements(self) -> Dict[str, Dict[str, Any]]:
        """Return method requirements for descriptive analyses."""
        return {
            'basic_statistics': {
                'min_variables': 1,
                'data_types': ['numeric'],
                'min_n': 1,
                'use_cases': ['summary_stats', 'data_overview']
            },
            'distribution_analysis': {
                'min_variables': 1,
                'data_types': ['numeric'],
                'min_n': 10,
                'use_cases': ['normality_testing', 'shape_analysis']
            },
            'correlation_analysis': {
                'min_variables': 2,
                'data_types': ['numeric'],
                'min_n': 10,
                'use_cases': ['relationship_analysis', 'multivariate']
            },
            'categorical_analysis': {
                'min_variables': 1,
                'data_types': ['categorical', 'binary'],
                'min_n': 1,
                'use_cases': ['frequency_analysis', 'category_summary']
            },
            'cross_tabulation': {
                'min_variables': 2,
                'data_types': ['categorical', 'binary'],
                'min_n': 10,
                'use_cases': ['categorical_associations', 'contingency_analysis']
            },
            'outlier_detection': {
                'min_variables': 1,
                'data_types': ['numeric'],
                'min_n': 15,
                'use_cases': ['data_quality', 'anomaly_detection']
            },
            'missing_data_analysis': {
                'min_variables': 1,
                'data_types': ['any'],
                'min_n': 1,
                'use_cases': ['data_quality', 'completeness_assessment']
            },
            'temporal_analysis': {
                'min_variables': 1,
                'data_types': ['datetime'],
                'min_n': 10,
                'use_cases': ['time_series', 'temporal_patterns']
            },
            'geospatial_analysis': {
                'min_variables': 2,
                'data_types': ['geographic'],
                'min_n': 10,
                'use_cases': ['spatial_patterns', 'location_analysis']
            },
            'grouped_analysis': {
                'min_variables': 2,
                'data_types': ['mixed'],
                'min_n': 20,
                'use_cases': ['group_comparisons', 'demographic_analysis']
            }
        }
    
    def detect_data_characteristics(self, data: pd.DataFrame, 
                                  variable_metadata: Optional[List[Dict]] = None) -> DataCharacteristics:
        """
        Analyze data characteristics for descriptive analysis selection.
        Uses the standardized base class method.
        
        Args:
            data: Input DataFrame
            variable_metadata: Optional metadata about variables
            
        Returns:
            Standardized DataCharacteristics object
        """
        # Use the standardized base class method
        return super().detect_data_characteristics(data, variable_metadata=variable_metadata)
    
    def suggest_descriptive_analyses(self, data: pd.DataFrame,
                                   variable_metadata: Optional[List[Dict]] = None,
                                   analysis_goals: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Suggest appropriate descriptive analyses based on data characteristics.
        This method now uses the standardized base class implementation.
        """
        # Use the standardized base class method
        suggestions = self.suggest_analyses(data, analysis_goals)
        
        # Convert to legacy format for backward compatibility
        legacy_format = {
            'primary_recommendations': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale,
                    'estimated_time': rec.estimated_time,
                    'function_calls': [rec.function_call] if rec.function_call else []
                }
                for rec in suggestions.primary_recommendations
            ],
            'secondary_recommendations': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale,
                    'estimated_time': rec.estimated_time,
                    'function_calls': [rec.function_call] if rec.function_call else []
                }
                for rec in suggestions.secondary_recommendations
            ],
            'optional_analyses': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale
                }
                for rec in suggestions.optional_analyses
            ],
            'data_quality_warnings': suggestions.data_quality_warnings,
            'analysis_order': suggestions.analysis_order
        }
        
        return legacy_format
    
    def auto_configure_analysis(self, method_name: str, data: pd.DataFrame,
                              target_variables: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Automatically configure parameters for a specific descriptive analysis.
        
        Args:
            method_name: Name of the analysis method
            data: Input DataFrame
            target_variables: Optional list of target variables
            
        Returns:
            Dictionary with optimized configuration
        """
        characteristics = self.detect_data_characteristics(data)
        
        configurations = {
            'basic_statistics': self._configure_basic_statistics,
            'distribution_analysis': self._configure_distribution_analysis,
            'correlation_analysis': self._configure_correlation_analysis,
            'categorical_analysis': self._configure_categorical_analysis,
            'cross_tabulation': self._configure_cross_tabulation,
            'outlier_detection': self._configure_outlier_detection,
            'missing_data_analysis': self._configure_missing_data_analysis,
            'temporal_analysis': self._configure_temporal_analysis,
            'geospatial_analysis': self._configure_geospatial_analysis,
            'grouped_analysis': self._configure_grouped_analysis
        }
        
        if method_name in configurations:
            return configurations[method_name](characteristics, data, target_variables)
        else:
            return {"error": f"Unknown method: {method_name}"}
    
    def generate_analysis_report(self, data: pd.DataFrame,
                               variable_metadata: Optional[List[Dict]] = None) -> str:
        """
        Generate a comprehensive analysis report with recommendations.
        
        Args:
            data: Input DataFrame
            variable_metadata: Optional variable metadata
            
        Returns:
            Human-readable analysis report
        """
        characteristics = self.detect_data_characteristics(data, variable_metadata)
        suggestions = self.suggest_descriptive_analyses(data, variable_metadata)
        
        report = "Descriptive Statistics Auto-Detection Report\n"
        report += "=" * 50 + "\n\n"
        
        # Data overview
        report += "Data Overview:\n"
        report += f"- Sample size: {characteristics.n_observations}\n"
        report += f"- Variables: {characteristics.n_variables}\n"
        report += f"- Missing data: {characteristics.missing_percentage:.1f}%\n"
        
        # Variable types summary
        report += "\nVariable Types:\n"
        for dtype, count in characteristics.type_counts.items():
            report += f"- {dtype.value.title()}: {count} variables\n"
        
        # Primary recommendations
        if suggestions['primary_recommendations']:
            report += "\nRecommended Analyses:\n"
            report += "-" * 25 + "\n"
            
            for i, rec in enumerate(suggestions['primary_recommendations'][:3], 1):
                report += f"{i}. {rec['method'].replace('_', ' ').title()}\n"
                report += f"   Confidence: {rec['score']:.2f}\n"
                report += f"   Rationale: {rec['rationale']}\n"
                report += f"   Estimated time: {rec['estimated_time']}\n\n"
        
        # Data quality warnings
        if suggestions['data_quality_warnings']:
            report += "Data Quality Warnings:\n"
            report += "-" * 25 + "\n"
            for warning in suggestions['data_quality_warnings']:
                report += f"- {warning}\n"
            report += "\n"
        
        # Analysis order
        if suggestions['analysis_order']:
            report += "Recommended Analysis Order:\n"
            report += "-" * 30 + "\n"
            for i, analysis in enumerate(suggestions['analysis_order'][:5], 1):
                report += f"{i}. {analysis.replace('_', ' ').title()}\n"
        
        return report
    
    # Private helper methods
    def _analyze_data_structure(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze the structure of the DataFrame."""
        return {
            'n_observations': len(data),
            'n_variables': len(data.columns),
            'data_shape': data.shape,
            'memory_usage': data.memory_usage(deep=True).sum(),
            'size_category': self._categorize_data_size(len(data))
        }
    
    def _analyze_variable_types(self, data: pd.DataFrame) -> Dict[str, str]:
        """Determine the type of each variable."""
        variable_types = {}
        
        for col in data.columns:
            variable_types[col] = self._classify_variable_type(data[col])
        
        return variable_types
    
    def _classify_variable_type(self, series: pd.Series) -> str:
        """Classify a single variable's type."""
        # Remove missing values for analysis
        clean_series = series.dropna()
        
        if len(clean_series) == 0:
            return 'empty'
        
        # Check for geographic coordinates
        if any(geo_term in series.name.lower() for geo_term in ['lat', 'lon', 'latitude', 'longitude']) if series.name else False:
            return 'geographic'
        
        # Check for datetime
        if pd.api.types.is_datetime64_any_dtype(clean_series):
            return 'datetime'
        
        # Check if binary
        unique_vals = clean_series.unique()
        if len(unique_vals) == 2:
            return 'binary'
        
        # Check if numeric
        if pd.api.types.is_numeric_dtype(clean_series):
            # Check for continuous vs discrete
            if len(unique_vals) > 20 or any(val != int(val) for val in clean_series[:100] if pd.notnull(val) and isinstance(val, (int, float))):
                return 'continuous'
            else:
                return 'discrete'
        
        # Check if categorical
        elif len(unique_vals) <= 50:
            return 'categorical'
        else:
            return 'text'
    
    def _analyze_data_quality(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze data quality metrics."""
        total_cells = data.size
        missing_cells = data.isnull().sum().sum()
        missing_percentage = (missing_cells / total_cells * 100) if total_cells > 0 else 0
        
        # Check for duplicates
        duplicate_rows = data.duplicated().sum()
        
        # Check for constant columns
        constant_columns = [col for col in data.columns if data[col].nunique() <= 1]
        
        return {
            'total_cells': total_cells,
            'missing_cells': missing_cells,
            'missing_percentage': missing_percentage,
            'duplicate_rows': duplicate_rows,
            'constant_columns': constant_columns,
            'completeness_score': 100 - missing_percentage
        }
    
    def _analyze_sample_characteristics(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze sample size and distribution characteristics."""
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        categorical_cols = data.select_dtypes(include=['object', 'category']).columns
        
        return {
            'n_observations': len(data),
            'n_variables': len(data.columns),
            'n_numeric': len(numeric_cols),
            'n_categorical': len(categorical_cols),
            'sample_size_category': self._categorize_data_size(len(data)),
            'variable_density': len(data.columns) / len(data) if len(data) > 0 else 0
        }
    
    def _analyze_relationships(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze potential relationships in the data."""
        numeric_data = data.select_dtypes(include=[np.number])
        
        relationships = {
            'potential_correlations': 0,
            'potential_cross_tabs': 0,
            'grouping_variables': []
        }
        
        if len(numeric_data.columns) >= 2:
            relationships['potential_correlations'] = len(numeric_data.columns) * (len(numeric_data.columns) - 1) // 2
        
        categorical_cols = data.select_dtypes(include=['object', 'category']).columns
        if len(categorical_cols) >= 2:
            relationships['potential_cross_tabs'] = len(categorical_cols) * (len(categorical_cols) - 1) // 2
        
        # Identify potential grouping variables
        for col in categorical_cols:
            unique_vals = data[col].nunique()
            if 2 <= unique_vals <= 10:  # Good grouping variable range
                relationships['grouping_variables'].append(col)
        
        return relationships
    
    def _detect_special_features(self, data: pd.DataFrame) -> Dict[str, Any]:
        """Detect special features in the data."""
        features = {
            'has_datetime': False,
            'has_geographic': False,
            'has_weights': False,
            'has_identifiers': [],
            'survey_like': False
        }
        
        for col in data.columns:
            col_lower = col.lower()
            
            # Check for datetime
            if pd.api.types.is_datetime64_any_dtype(data[col]):
                features['has_datetime'] = True
            
            # Check for geographic
            if any(geo_term in col_lower for geo_term in ['lat', 'lon', 'latitude', 'longitude']):
                features['has_geographic'] = True
            
            # Check for weights
            if any(weight_term in col_lower for weight_term in ['weight', 'wt', 'sample_weight']):
                features['has_weights'] = True
            
            # Check for identifiers
            if any(id_term in col_lower for id_term in ['id', 'identifier', 'key']) and data[col].nunique() == len(data):
                features['has_identifiers'].append(col)
        
        # Check if data looks like survey data
        categorical_ratio = len(data.select_dtypes(include=['object', 'category']).columns) / len(data.columns)
        if categorical_ratio > 0.5 and len(data.columns) > 10:
            features['survey_like'] = True
        
        return features
    
    def _analyze_metadata(self, metadata: List[Dict], data: pd.DataFrame) -> Dict[str, Any]:
        """Analyze variable metadata if provided."""
        analysis = {
            'has_demographics': False,
            'has_scales': False,
            'question_types': {},
            'demographic_variables': []
        }
        
        for var_meta in metadata:
            if var_meta.get('demographics_category'):
                analysis['has_demographics'] = True
                analysis['demographic_variables'].append(var_meta.get('column_name'))
            
            if var_meta.get('question_type') == 'likert_scale':
                analysis['has_scales'] = True
            
            q_type = var_meta.get('question_type', 'unknown')
            analysis['question_types'][q_type] = analysis['question_types'].get(q_type, 0) + 1
        
        return analysis
    
    def assess_method_suitability(self, method_name: str, 
                                characteristics: DataCharacteristics,
                                **kwargs) -> AnalysisRecommendation:
        """
        Assess how suitable a method is for the given data using standardized structures.
        """
        requirements = kwargs.get('requirements', {})
        
        score = 0.0
        rationale_parts = []
        
        # Check minimum observations
        n_obs = characteristics.n_observations
        min_n = requirements.get('min_n', 1)
        
        if n_obs >= min_n:
            score += 0.3
            rationale_parts.append(f"adequate sample size (n={n_obs})")
        else:
            score -= 0.1
            rationale_parts.append(f"small sample size (n={n_obs})")
        
        # Check variable requirements
        min_vars = requirements.get('min_variables', 1)
        required_types = requirements.get('data_types', [])
        
        available_vars = self._count_compatible_variables(characteristics, required_types)
        
        if available_vars >= min_vars:
            score += 0.4
            rationale_parts.append(f"{available_vars} compatible variables")
        else:
            score -= 0.2
            rationale_parts.append(f"insufficient variables ({available_vars} < {min_vars})")
        
        # Data quality bonus/penalty
        if characteristics.completeness_score > 95:
            score += 0.2
            rationale_parts.append("high data quality")
        elif characteristics.completeness_score < 80:
            score -= 0.1
            rationale_parts.append("data quality concerns")
        
        # Special feature bonuses
        if method_name == 'temporal_analysis' and characteristics.has_datetime:
            score += 0.3
        elif method_name == 'geospatial_analysis' and characteristics.has_geographic:
            score += 0.3
        elif method_name == 'grouped_analysis' and len(characteristics.grouping_variables) > 0:
            score += 0.2
        
        # Normalize score
        score = max(0, min(1, score))
        
        # Create recommendation
        recommendation = AnalysisRecommendation(
            method=method_name,
            score=score,
            confidence=AnalysisConfidence.HIGH,  # Will be set by __post_init__
            rationale='; '.join(rationale_parts),
            estimated_time=self._estimate_execution_time(method_name, characteristics),
            function_call=self._generate_function_calls(method_name, available_vars)[0] if self._generate_function_calls(method_name, available_vars) else f"{method_name}(data)",
            parameters=self._get_suggested_parameters(method_name, characteristics)
        )
        
        return recommendation

    def _get_suggested_parameters(self, method_name: str, characteristics: DataCharacteristics) -> Dict[str, Any]:
        """Get suggested parameters for a specific method."""
        params = {}
        
        if method_name == 'basic_statistics':
            numeric_cols = [col for col, dtype in characteristics.variable_types.items() 
                           if dtype in [DataType.NUMERIC_CONTINUOUS, DataType.NUMERIC_DISCRETE]]
            params.update({
                'target_columns': numeric_cols,
                'include_percentiles': True,
                'confidence_level': 0.95,
                'grouping_variables': characteristics.grouping_variables[:2]
            })
        elif method_name == 'distribution_analysis':
            numeric_cols = [col for col, dtype in characteristics.variable_types.items() 
                           if dtype in [DataType.NUMERIC_CONTINUOUS, DataType.NUMERIC_DISCRETE]]
            params.update({
                'target_columns': numeric_cols[:5],
                'normality_tests': ['shapiro', 'anderson'],
                'distribution_fitting': True,
                'plot_distributions': characteristics.n_observations < 10000
            })
        elif method_name == 'correlation_analysis':
            params.update({
                'method': 'pearson',
                'min_periods': 10,
                'include_covariance': True,
                'significance_testing': True
            })
        elif method_name == 'categorical_analysis':
            cat_cols = [col for col, dtype in characteristics.variable_types.items() 
                       if dtype in [DataType.CATEGORICAL, DataType.BINARY]]
            params.update({
                'target_columns': cat_cols,
                'include_percentages': True,
                'association_tests': True,
                'max_categories_display': 20
            })
        elif method_name == 'outlier_detection':
            sample_size = characteristics.n_observations
            params.update({
                'methods': ['iqr', 'zscore'] + (['isolation_forest'] if sample_size > 100 else []),
                'iqr_threshold': 1.5,
                'zscore_threshold': 3,
                'contamination_rate': 0.05
            })
        
        return params

    def _count_compatible_variables(self, characteristics: DataCharacteristics, required_types: List[str]) -> int:
        """Count variables compatible with required types."""
        if 'any' in required_types:
            return characteristics.n_variables
        
        compatible_count = 0
        for var_type in characteristics.variable_types.values():
            if str(var_type.value) in required_types:
                compatible_count += 1
            elif 'numeric' in required_types and var_type in [DataType.NUMERIC_CONTINUOUS, DataType.NUMERIC_DISCRETE]:
                compatible_count += 1
            elif 'categorical' in required_types and var_type in [DataType.CATEGORICAL, DataType.BINARY]:
                compatible_count += 1
        
        return compatible_count
    
    def _categorize_data_size(self, n: int) -> str:
        """Categorize data size."""
        if n < 50:
            return 'very_small'
        elif n < 200:
            return 'small'
        elif n < 1000:
            return 'medium'
        elif n < 10000:
            return 'large'
        else:
            return 'very_large'
    
    def _estimate_execution_time(self, method_name: str, characteristics: DataCharacteristics) -> str:
        """Estimate execution time for analysis method."""
        base_times = {
            'basic_statistics': 1,
            'distribution_analysis': 3,
            'correlation_analysis': 5,
            'categorical_analysis': 2,
            'cross_tabulation': 4,
            'outlier_detection': 3,
            'missing_data_analysis': 2,
            'temporal_analysis': 8,
            'geospatial_analysis': 10,
            'grouped_analysis': 6
        }
        
        base_time = base_times.get(method_name, 3)
        n_obs = characteristics.n_observations
        n_vars = characteristics.n_variables
        
        # Adjust for data size
        if n_obs > 10000 or n_vars > 100:
            base_time *= 3
        elif n_obs > 1000 or n_vars > 50:
            base_time *= 2
        
        if base_time < 5:
            return "< 5 seconds"
        elif base_time < 30:
            return "< 30 seconds"
        elif base_time < 60:
            return "< 1 minute"
        else:
            return "1-5 minutes"
    
    def _generate_function_calls(self, method_name: str, n_variables: int) -> List[str]:
        """Generate function call suggestions for the method."""
        calls = []
        
        if method_name == 'basic_statistics':
            calls = ['calculate_basic_stats(data, numeric_columns)', 'calculate_percentiles(data, columns)']
        elif method_name == 'distribution_analysis':
            calls = ['analyze_distribution(series)', 'test_normality(series)', 'fit_distribution(series)']
        elif method_name == 'correlation_analysis':
            calls = ['calculate_correlation_matrix(data)', 'calculate_covariance_matrix(data)']
        elif method_name == 'categorical_analysis':
            calls = ['analyze_categorical(series)', 'calculate_cramers_v(data, col1, col2)']
        elif method_name == 'cross_tabulation':
            calls = ['analyze_cross_tabulation(data, col1, col2)', 'calculate_chi_square(data, col1, col2)']
        elif method_name == 'outlier_detection':
            calls = ['detect_outliers_iqr(series)', 'detect_outliers_zscore(series)', 'get_outlier_summary(data)']
        elif method_name == 'missing_data_analysis':
            calls = ['analyze_missing_data(data)', 'get_missing_patterns(data)']
        elif method_name == 'temporal_analysis':
            calls = ['analyze_temporal_patterns(data, date_col, value_cols)', 'detect_seasonality(series)']
        elif method_name == 'geospatial_analysis':
            calls = ['analyze_spatial_distribution(data, lat_col, lon_col)', 'create_location_clusters(data)']
        elif method_name == 'grouped_analysis':
            calls = ['calculate_grouped_stats(data, group_col, value_cols)']
        
        return calls
    

    

    

    
    # Configuration methods for specific analyses
    def _configure_basic_statistics(self, characteristics, data, target_variables):
        """Configure basic statistics parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'variable_types'):
            numeric_cols = [col for col, dtype in characteristics.variable_types.items() 
                           if dtype in [DataType.NUMERIC_CONTINUOUS, DataType.NUMERIC_DISCRETE]]
            grouping_vars = characteristics.grouping_variables[:2]
        else:
            numeric_cols = [col for col, dtype in characteristics['variable_types'].items() 
                           if dtype in ['continuous', 'discrete']]
            grouping_vars = characteristics['relationships']['grouping_variables'][:2]
        
        return {
            'analysis_type': 'basic_statistics',
            'target_columns': target_variables or numeric_cols,
            'include_percentiles': True,
            'confidence_level': 0.95,
            'grouping_variables': grouping_vars
        }
    
    def _configure_distribution_analysis(self, characteristics, data, target_variables):
        """Configure distribution analysis parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'variable_types'):
            numeric_cols = [col for col, dtype in characteristics.variable_types.items() 
                           if dtype in [DataType.NUMERIC_CONTINUOUS, DataType.NUMERIC_DISCRETE]]
        else:
            numeric_cols = [col for col, dtype in characteristics['variable_types'].items() 
                           if dtype in ['continuous', 'discrete']]
        
        return {
            'analysis_type': 'distribution_analysis',
            'target_columns': target_variables or numeric_cols[:5],  # Limit for performance
            'normality_tests': ['shapiro', 'anderson'],
            'distribution_fitting': True,
            'plot_distributions': len(data) < 10000  # Only for smaller datasets
        }
    
    def _configure_correlation_analysis(self, characteristics, data, target_variables):
        """Configure correlation analysis parameters."""
        return {
            'analysis_type': 'correlation_analysis',
            'method': 'pearson',
            'min_periods': 10,
            'include_covariance': True,
            'significance_testing': True
        }
    
    def _configure_categorical_analysis(self, characteristics, data, target_variables):
        """Configure categorical analysis parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'variable_types'):
            cat_cols = [col for col, dtype in characteristics.variable_types.items() 
                       if dtype in [DataType.CATEGORICAL, DataType.BINARY]]
        else:
            cat_cols = [col for col, dtype in characteristics['variable_types'].items() 
                       if dtype in ['categorical', 'binary']]
        
        return {
            'analysis_type': 'categorical_analysis',
            'target_columns': target_variables or cat_cols,
            'include_percentages': True,
            'association_tests': True,
            'max_categories_display': 20
        }
    
    def _configure_cross_tabulation(self, characteristics, data, target_variables):
        """Configure cross-tabulation parameters."""
        return {
            'analysis_type': 'cross_tabulation',
            'chi_square_test': True,
            'cramers_v': True,
            'expected_frequencies': True,
            'residuals': True
        }
    
    def _configure_outlier_detection(self, characteristics, data, target_variables):
        """Configure outlier detection parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'n_observations'):
            sample_size = characteristics.n_observations
        else:
            sample_size = characteristics['sample_characteristics']['n_observations']
        
        return {
            'analysis_type': 'outlier_detection',
            'methods': ['iqr', 'zscore'] + (['isolation_forest'] if sample_size > 100 else []),
            'iqr_threshold': 1.5,
            'zscore_threshold': 3,
            'contamination_rate': 0.05
        }
    
    def _configure_missing_data_analysis(self, characteristics, data, target_variables):
        """Configure missing data analysis parameters."""
        return {
            'analysis_type': 'missing_data_analysis',
            'pattern_analysis': True,
            'correlation_analysis': True,
            'visualization': len(data) < 5000,
            'threshold_complete': 0.95
        }
    
    def _configure_temporal_analysis(self, characteristics, data, target_variables):
        """Configure temporal analysis parameters."""
        return {
            'analysis_type': 'temporal_analysis',
            'seasonality_detection': True,
            'trend_analysis': True,
            'frequency_analysis': True,
            'time_series_stats': True
        }
    
    def _configure_geospatial_analysis(self, characteristics, data, target_variables):
        """Configure geospatial analysis parameters."""
        return {
            'analysis_type': 'geospatial_analysis',
            'spatial_autocorrelation': True,
            'clustering': len(data) > 50,
            'distance_analysis': True,
            'coordinate_validation': True
        }
    
    def _configure_grouped_analysis(self, characteristics, data, target_variables):
        """Configure grouped analysis parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'grouping_variables'):
            grouping_vars = characteristics.grouping_variables
        else:
            grouping_vars = characteristics['relationships']['grouping_variables']
        
        return {
            'analysis_type': 'grouped_analysis',
            'grouping_variables': grouping_vars[:3],  # Limit to prevent explosion
            'statistics': ['mean', 'median', 'std', 'count'],
            'significance_tests': len(data) > 30,
            'effect_sizes': True
        }

# Factory function for easy usage
def auto_analyze_descriptive_data(data: pd.DataFrame,
                                variable_metadata: Optional[List[Dict]] = None,
                                analysis_goals: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Automatically analyze data and recommend descriptive analyses.
    
    Args:
        data: Input DataFrame
        variable_metadata: Optional variable metadata
        analysis_goals: Optional analysis goals
        
    Returns:
        Dictionary with comprehensive analysis and recommendations
    """
    try:
        # Validate input data
        if not isinstance(data, pd.DataFrame):
            return {'error': f'Expected DataFrame, got {type(data)}'}
        
        if data.empty:
            return {'error': 'DataFrame is empty'}
        
        logger.debug(f"Starting auto-analysis for DataFrame with shape: {data.shape}")
        
        detector = DescriptiveAutoDetector()
        
        # Get data characteristics with error handling
        try:
            characteristics = detector.detect_data_characteristics(data, variable_metadata)
        except Exception as e:
            logger.error(f"Error detecting data characteristics: {e}")
            return {'error': f'Failed to analyze data characteristics: {str(e)}'}
        
        # Get analysis suggestions with error handling
        try:
            suggestions = detector.suggest_descriptive_analyses(data, variable_metadata, analysis_goals)
        except Exception as e:
            logger.error(f"Error generating analysis suggestions: {e}")
            return {'error': f'Failed to generate analysis suggestions: {str(e)}'}
        
        # Generate report with error handling
        try:
            report = detector.generate_analysis_report(data, variable_metadata)
        except Exception as e:
            logger.error(f"Error generating analysis report: {e}")
            report = "Report generation failed"
        
        # Get the first primary recommendation method name
        first_method = 'basic_statistics'  # default
        try:
            if suggestions and 'primary_recommendations' in suggestions and suggestions['primary_recommendations']:
                first_rec = suggestions['primary_recommendations'][0]
                if hasattr(first_rec, 'method'):
                    first_method = first_rec.method
                elif isinstance(first_rec, dict):
                    first_method = first_rec.get('method', 'basic_statistics')
        except Exception as e:
            logger.debug(f"Error getting first method: {e}")
        
        # Auto-configure analysis with error handling
        try:
            recommended_config = detector.auto_configure_analysis(first_method, data)
        except Exception as e:
            logger.error(f"Error auto-configuring analysis: {e}")
            recommended_config = {'error': f'Configuration failed: {str(e)}'}
        
        return {
            'data_characteristics': characteristics,
            'analysis_suggestions': suggestions,
            'analysis_report': report,
            'recommended_configuration': recommended_config
        }
        
    except Exception as e:
        logger.error(f"Error in auto_analyze_descriptive_data: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {'error': f'Auto-analysis failed: {str(e)}'}

def quick_descriptive_recommendation(data: pd.DataFrame, analysis_type: str = 'auto') -> str:
    """
    Quick recommendation for descriptive analysis.
    
    Args:
        data: Input DataFrame
        analysis_type: 'auto', 'overview', 'quality', 'relationships'
        
    Returns:
        String with quick recommendation
    """
    detector = DescriptiveAutoDetector()
    characteristics = detector.detect_data_characteristics(data)
    
    # Handle standardized DataCharacteristics format
    n_numeric = sum(1 for dtype in characteristics.variable_types.values() 
                   if dtype in [DataType.NUMERIC_CONTINUOUS, DataType.NUMERIC_DISCRETE])
    n_categorical = sum(1 for dtype in characteristics.variable_types.values() 
                       if dtype in [DataType.CATEGORICAL, DataType.BINARY])
    n_obs = characteristics.n_observations
    
    if analysis_type == 'auto':
        if n_obs < 50:
            return "basic_statistics (small sample - focus on summaries)"
        elif n_numeric >= 2:
            return "correlation_analysis + basic_statistics"
        elif n_categorical >= 2:
            return "categorical_analysis + cross_tabulation"
        else:
            return "basic_statistics + missing_data_analysis"
    
    elif analysis_type == 'overview':
        return "basic_statistics + categorical_analysis + missing_data_analysis"
    
    elif analysis_type == 'quality':
        return "missing_data_analysis + outlier_detection + distribution_analysis"
    
    elif analysis_type == 'relationships':
        if n_numeric >= 2:
            return "correlation_analysis"
        elif n_categorical >= 2:
            return "cross_tabulation"
        else:
            return "grouped_analysis (if grouping variables available)"
    
    else:
        return "basic_statistics (default recommendation)" 