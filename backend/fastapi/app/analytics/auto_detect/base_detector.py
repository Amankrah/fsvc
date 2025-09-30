"""
Base classes and utilities for auto-detection systems.
Provides standardized interfaces and shared functionality across all analytics modules.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Union, Tuple
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from collections import Counter
import warnings
import logging

# Configure logging for auto-detection system
logger = logging.getLogger(__name__)

class DataType(Enum):
    """Standardized data types across all modules."""
    NUMERIC_CONTINUOUS = "numeric_continuous"
    NUMERIC_DISCRETE = "numeric_discrete"
    CATEGORICAL = "categorical"
    BINARY = "binary"
    ORDINAL = "ordinal"
    TEXT = "text"
    DATETIME = "datetime"
    GEOGRAPHIC = "geographic"
    EMPTY = "empty"
    UNKNOWN = "unknown"

class AnalysisConfidence(Enum):
    """Analysis confidence levels."""
    HIGH = "high"      # Score >= 0.8
    MEDIUM = "medium"  # Score >= 0.5
    LOW = "low"        # Score >= 0.3
    VERY_LOW = "very_low"  # Score < 0.3

@dataclass
class DataCharacteristics:
    """Standardized data characteristics structure."""
    # Basic structure
    n_observations: int = 0
    n_variables: int = 0
    data_shape: Tuple[int, int] = (0, 0)
    
    # Data types
    variable_types: Dict[str, DataType] = field(default_factory=dict)
    type_counts: Dict[DataType, int] = field(default_factory=dict)
    
    # Data quality
    missing_percentage: float = 0.0
    missing_patterns: Dict[str, Any] = field(default_factory=dict)
    duplicate_rows: int = 0
    constant_columns: List[str] = field(default_factory=list)
    
    # Sample characteristics
    sample_size_category: str = "unknown"
    completeness_score: float = 100.0
    
    # Statistical properties
    numeric_summaries: Dict[str, Dict[str, float]] = field(default_factory=dict)
    categorical_summaries: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # Relationships
    potential_correlations: int = 0
    potential_cross_tabs: int = 0
    grouping_variables: List[str] = field(default_factory=list)
    
    # Special features
    has_datetime: bool = False
    has_geographic: bool = False
    has_text: bool = False
    has_identifiers: List[str] = field(default_factory=list)
    survey_like: bool = False
    
    # Metadata
    detection_timestamp: Optional[str] = None
    detection_version: str = "1.0.0"

@dataclass
class AnalysisRecommendation:
    """Standardized analysis recommendation structure."""
    method: str
    score: float
    confidence: AnalysisConfidence
    rationale: str
    estimated_time: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    function_call: str = ""
    prerequisites: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Set confidence level based on score."""
        if self.score >= 0.8:
            self.confidence = AnalysisConfidence.HIGH
        elif self.score >= 0.5:
            self.confidence = AnalysisConfidence.MEDIUM
        elif self.score >= 0.3:
            self.confidence = AnalysisConfidence.LOW
        else:
            self.confidence = AnalysisConfidence.VERY_LOW

@dataclass
class AnalysisSuggestions:
    """Standardized analysis suggestions structure."""
    primary_recommendations: List[AnalysisRecommendation] = field(default_factory=list)
    secondary_recommendations: List[AnalysisRecommendation] = field(default_factory=list)
    optional_analyses: List[AnalysisRecommendation] = field(default_factory=list)
    not_recommended: List[Dict[str, Any]] = field(default_factory=list)
    data_quality_warnings: List[str] = field(default_factory=list)
    analysis_order: List[str] = field(default_factory=list)
    
    def get_all_recommendations(self) -> List[AnalysisRecommendation]:
        """Get all recommendations sorted by score."""
        all_recs = (self.primary_recommendations + 
                   self.secondary_recommendations + 
                   self.optional_analyses)
        return sorted(all_recs, key=lambda x: x.score, reverse=True)
    
    def get_by_confidence(self, confidence: AnalysisConfidence) -> List[AnalysisRecommendation]:
        """Get recommendations by confidence level."""
        return [rec for rec in self.get_all_recommendations() 
                if rec.confidence == confidence]

class BaseAutoDetector(ABC):
    """
    Abstract base class for all auto-detection systems.
    Provides standardized interface and shared functionality.
    """
    
    def __init__(self, name: str):
        self.name = name
        self.version = "1.0.0"
        self.logger = logging.getLogger(f"{__name__}.{name}")
        self._data_profiler = StandardizedDataProfiler()
    
    @abstractmethod
    def get_method_requirements(self) -> Dict[str, Dict[str, Any]]:
        """
        Return method requirements specific to this detector.
        Must be implemented by each subclass.
        """
        pass
    
    @abstractmethod
    def assess_method_suitability(self, method_name: str, 
                                characteristics: DataCharacteristics,
                                **kwargs) -> AnalysisRecommendation:
        """
        Assess how suitable a method is for the given data.
        Must be implemented by each subclass.
        """
        pass
    
    def detect_data_characteristics(self, data: Union[pd.DataFrame, pd.Series, Dict],
                                  **kwargs) -> DataCharacteristics:
        """
        Standardized data characteristics detection.
        Can be overridden by subclasses for specialized behavior.
        """
        return self._data_profiler.profile_data(data, **kwargs)
    
    def suggest_analyses(self, data: Union[pd.DataFrame, pd.Series, Dict],
                        analysis_goals: Optional[List[str]] = None,
                        **kwargs) -> AnalysisSuggestions:
        """
        Standardized analysis suggestion process.
        """
        try:
            # Get data characteristics
            characteristics = self.detect_data_characteristics(data, **kwargs)
            
            # Initialize suggestions
            suggestions = AnalysisSuggestions()
            
            # Assess each method
            method_requirements = self.get_method_requirements()
            
            for method_name, requirements in method_requirements.items():
                try:
                    recommendation = self.assess_method_suitability(
                        method_name, characteristics, requirements=requirements, **kwargs
                    )
                    
                    # Categorize recommendation
                    if recommendation.confidence == AnalysisConfidence.HIGH:
                        suggestions.primary_recommendations.append(recommendation)
                    elif recommendation.confidence == AnalysisConfidence.MEDIUM:
                        suggestions.secondary_recommendations.append(recommendation)
                    elif recommendation.confidence == AnalysisConfidence.LOW:
                        suggestions.optional_analyses.append(recommendation)
                    else:
                        suggestions.not_recommended.append({
                            'method': method_name,
                            'score': recommendation.score,
                            'reason': recommendation.rationale
                        })
                        
                except Exception as e:
                    self.logger.warning(f"Error assessing {method_name}: {str(e)}")
                    suggestions.not_recommended.append({
                        'method': method_name,
                        'score': 0.0,
                        'reason': f"Assessment failed: {str(e)}"
                    })
            
            # Sort recommendations
            suggestions.primary_recommendations.sort(key=lambda x: x.score, reverse=True)
            suggestions.secondary_recommendations.sort(key=lambda x: x.score, reverse=True)
            suggestions.optional_analyses.sort(key=lambda x: x.score, reverse=True)
            
            # Generate analysis order
            suggestions.analysis_order = self._generate_analysis_order(suggestions)
            
            # Add data quality warnings
            suggestions.data_quality_warnings = self._generate_quality_warnings(characteristics)
            
            # Filter by goals if provided
            if analysis_goals:
                suggestions = self._filter_by_goals(suggestions, analysis_goals)
            
            return suggestions
            
        except Exception as e:
            self.logger.error(f"Error in suggest_analyses: {str(e)}")
            # Return empty suggestions with error
            suggestions = AnalysisSuggestions()
            suggestions.data_quality_warnings = [f"Analysis suggestion failed: {str(e)}"]
            return suggestions
    
    def auto_configure_analysis(self, method_name: str, 
                              characteristics: DataCharacteristics,
                              **kwargs) -> Dict[str, Any]:
        """
        Auto-configure parameters for a specific analysis method.
        Can be overridden by subclasses for specialized configuration.
        """
        # Base configuration that works for most methods
        config = {
            'analysis_type': method_name,
            'data_characteristics': characteristics,
            'auto_configured': True,
            'configuration_version': self.version
        }
        
        # Add common parameters based on data characteristics
        config.update(self._get_common_parameters(characteristics))
        
        return config
    
    def _get_common_parameters(self, characteristics: DataCharacteristics) -> Dict[str, Any]:
        """Get common parameters based on data characteristics."""
        params = {}
        
        # Sample size considerations
        if characteristics.sample_size_category in ['very_small', 'small']:
            params['use_bootstrap'] = True
            params['min_sample_warning'] = True
        
        # Missing data considerations
        if characteristics.missing_percentage > 10:
            params['handle_missing'] = True
            params['missing_strategy'] = 'exclude' if characteristics.missing_percentage < 30 else 'impute'
        
        # Performance considerations
        if characteristics.n_observations > 10000:
            params['use_sampling'] = True
            params['sample_size'] = min(10000, characteristics.n_observations)
        
        return params
    
    def _generate_analysis_order(self, suggestions: AnalysisSuggestions) -> List[str]:
        """Generate recommended order for executing analyses."""
        # Default order prioritizes data quality, then exploration, then modeling
        priority_order = [
            'missing_data_analysis', 'basic_statistics', 'data_quality_check',
            'distribution_analysis', 'categorical_analysis', 'correlation_analysis',
            'outlier_detection', 'cross_tabulation', 'grouped_analysis',
            'regression_analysis', 'time_series_analysis', 'spatial_analysis'
        ]
        
        # Get all recommended methods
        all_methods = [rec.method for rec in suggestions.get_all_recommendations()]
        
        # Order according to priority
        ordered_methods = []
        for method in priority_order:
            if method in all_methods:
                ordered_methods.append(method)
        
        # Add remaining methods
        for method in all_methods:
            if method not in ordered_methods:
                ordered_methods.append(method)
        
        return ordered_methods
    
    def _generate_quality_warnings(self, characteristics: DataCharacteristics) -> List[str]:
        """Generate data quality warnings."""
        warnings = []
        
        if characteristics.missing_percentage > 20:
            warnings.append(f"High missing data rate: {characteristics.missing_percentage:.1f}%")
        
        if characteristics.duplicate_rows > 0:
            warnings.append(f"{characteristics.duplicate_rows} duplicate rows detected")
        
        if characteristics.constant_columns:
            warnings.append(f"Constant columns detected: {', '.join(characteristics.constant_columns)}")
        
        if characteristics.sample_size_category == 'very_small':
            warnings.append("Very small sample size may limit analysis reliability")
        
        return warnings
    
    def _filter_by_goals(self, suggestions: AnalysisSuggestions, 
                        goals: List[str]) -> AnalysisSuggestions:
        """Filter suggestions based on analysis goals."""
        # This is a base implementation - subclasses should override for specific filtering
        return suggestions
    
    def generate_report(self, data: Union[pd.DataFrame, pd.Series, Dict],
                       **kwargs) -> str:
        """Generate a standardized analysis report."""
        characteristics = self.detect_data_characteristics(data, **kwargs)
        suggestions = self.suggest_analyses(data, **kwargs)
        
        report = f"{self.name} Auto-Detection Report\n"
        report += "=" * 50 + "\n\n"
        
        # Data overview
        report += "Data Overview:\n"
        report += f"- Sample size: {characteristics.n_observations}\n"
        report += f"- Variables: {characteristics.n_variables}\n"
        report += f"- Missing data: {characteristics.missing_percentage:.1f}%\n"
        report += f"- Data types: {dict(characteristics.type_counts)}\n\n"
        
        # Primary recommendations
        if suggestions.primary_recommendations:
            report += "Primary Recommendations:\n"
            report += "-" * 25 + "\n"
            
            for i, rec in enumerate(suggestions.primary_recommendations[:3], 1):
                report += f"{i}. {rec.method.replace('_', ' ').title()}\n"
                report += f"   Confidence: {rec.confidence.value}\n"
                report += f"   Score: {rec.score:.3f}\n"
                report += f"   Rationale: {rec.rationale}\n"
                report += f"   Estimated time: {rec.estimated_time}\n\n"
        
        # Warnings
        if suggestions.data_quality_warnings:
            report += "Data Quality Warnings:\n"
            report += "-" * 25 + "\n"
            for warning in suggestions.data_quality_warnings:
                report += f"- {warning}\n"
            report += "\n"
        
        return report

class StandardizedDataProfiler:
    """
    Standardized data profiling system used across all auto-detectors.
    Eliminates duplication and ensures consistency.
    """
    
    def profile_data(self, data: Union[pd.DataFrame, pd.Series, Dict],
                     **kwargs) -> DataCharacteristics:
        """Profile data and return standardized characteristics."""
        try:
            # Convert to DataFrame if needed
            df = self._ensure_dataframe(data)
            
            characteristics = DataCharacteristics()
            
            # Basic structure - ensure native Python types
            characteristics.n_observations = int(len(df))
            characteristics.n_variables = int(len(df.columns))
            characteristics.data_shape = (int(df.shape[0]), int(df.shape[1]))
            
            # Analyze variable types
            characteristics.variable_types = self._analyze_variable_types(df)
            characteristics.type_counts = Counter(characteristics.variable_types.values())
            
            # Data quality metrics - ensure native Python types
            characteristics.missing_percentage = float(self._calculate_missing_percentage(df))
            characteristics.missing_patterns = self._analyze_missing_patterns(df)
            characteristics.duplicate_rows = int(df.duplicated().sum())
            characteristics.constant_columns = self._find_constant_columns(df)
            characteristics.completeness_score = float(100 - characteristics.missing_percentage)
            
            # Sample characteristics
            characteristics.sample_size_category = self._categorize_sample_size(characteristics.n_observations)
            
            # Statistical summaries
            characteristics.numeric_summaries = self._create_numeric_summaries(df)
            characteristics.categorical_summaries = self._create_categorical_summaries(df)
            
            # Relationships
            characteristics.potential_correlations = self._count_potential_correlations(df)
            characteristics.potential_cross_tabs = self._count_potential_cross_tabs(df)
            characteristics.grouping_variables = self._identify_grouping_variables(df)
            
            # Special features
            characteristics.has_datetime = self._has_datetime_columns(df)
            characteristics.has_geographic = self._has_geographic_columns(df)
            characteristics.has_text = self._has_text_columns(df)
            characteristics.has_identifiers = self._find_identifier_columns(df)
            characteristics.survey_like = self._is_survey_like(df, characteristics)
            
            # Metadata
            from datetime import datetime
            characteristics.detection_timestamp = datetime.now().isoformat()
            
            return characteristics
            
        except Exception as e:
            logger.error(f"Error in profile_data: {str(e)}")
            # Return minimal characteristics with error info
            characteristics = DataCharacteristics()
            characteristics.n_observations = 0
            characteristics.n_variables = 0
            return characteristics
    
    def _ensure_dataframe(self, data: Union[pd.DataFrame, pd.Series, Dict]) -> pd.DataFrame:
        """Convert input data to DataFrame."""
        if isinstance(data, pd.DataFrame):
            return data
        elif isinstance(data, pd.Series):
            return data.to_frame()
        elif isinstance(data, dict):
            return pd.DataFrame(data)
        else:
            raise ValueError(f"Unsupported data type: {type(data)}")
    
    def _analyze_variable_types(self, df: pd.DataFrame) -> Dict[str, DataType]:
        """Analyze and classify variable types."""
        variable_types = {}
        
        for col in df.columns:
            variable_types[col] = self._classify_variable_type(df[col])
        
        return variable_types
    
    def _classify_variable_type(self, series: pd.Series) -> DataType:
        """Classify a single variable's type."""
        try:
            # Remove missing values for analysis
            clean_series = series.dropna()
            
            if len(clean_series) == 0:
                return DataType.EMPTY
            
            # Check for geographic coordinates
            if series.name and any(geo_term in str(series.name).lower() for geo_term in ['lat', 'lon', 'latitude', 'longitude']):
                return DataType.GEOGRAPHIC
            
            # Check for datetime
            if pd.api.types.is_datetime64_any_dtype(series):
                return DataType.DATETIME
            
            # Check if binary
            try:
                unique_vals = clean_series.unique()
                if len(unique_vals) == 2:
                    return DataType.BINARY
            except (TypeError, ValueError) as e:
                # Handle case where values are not hashable (like lists) or other type errors
                logger.debug(f"Error getting unique values for binary check: {e}")
                try:
                    # Convert to string and then get unique values
                    unique_vals = clean_series.astype(str).unique()
                    if len(unique_vals) == 2:
                        return DataType.BINARY
                except Exception as e2:
                    logger.debug(f"Error converting to string for binary check: {e2}")
                    # If all else fails, treat as text
                    return DataType.TEXT
            
            # Check if numeric
            if pd.api.types.is_numeric_dtype(clean_series):
                try:
                    # Check for continuous vs discrete
                    # Use the unique_vals from above if available, otherwise get them safely
                    if 'unique_vals' not in locals():
                        try:
                            unique_vals = clean_series.unique()
                        except Exception:
                            # If we can't get unique values, default to continuous
                            return DataType.NUMERIC_CONTINUOUS
                    
                    if len(unique_vals) > 20 or self._has_floating_point_values(clean_series):
                        return DataType.NUMERIC_CONTINUOUS
                    else:
                        return DataType.NUMERIC_DISCRETE
                except Exception as e:
                    logger.debug(f"Error determining continuous vs discrete: {e}")
                    # If there's an error determining continuous vs discrete, default to discrete
                    return DataType.NUMERIC_DISCRETE
            
            # Check if ordinal (ordered categorical)
            if hasattr(series, 'cat') and series.cat.ordered:
                return DataType.ORDINAL
            
            # Check if categorical
            try:
                # Get unique values safely
                if 'unique_vals' not in locals():
                    try:
                        unique_vals = clean_series.unique()
                    except Exception:
                        # If we can't get unique values, treat as text
                        return DataType.TEXT
                
                if len(unique_vals) <= 50:
                    return DataType.CATEGORICAL
                else:
                    return DataType.TEXT
            except Exception as e:
                logger.debug(f"Error in categorical classification: {e}")
                # If we can't determine unique values, default to text
                return DataType.TEXT
                
        except Exception as e:
            logger.error(f"Error classifying variable type for series {series.name}: {e}")
            return DataType.UNKNOWN
    
    def _has_floating_point_values(self, series: pd.Series) -> bool:
        """Check if series has floating point values."""
        try:
            sample = series.dropna().iloc[:100]  # Check first 100 non-null values
            
            # Additional safety check for complex data types
            if not pd.api.types.is_numeric_dtype(sample):
                return False
            
            # Ensure we have actual values to check
            if len(sample) == 0:
                return False
                
            for val in sample:
                if pd.notnull(val) and isinstance(val, (int, float)):
                    try:
                        # Safely check if value is not equal to its integer conversion
                        int_val = int(val)
                        if float(val) != float(int_val):
                            return True
                    except (ValueError, OverflowError, TypeError):
                        # If conversion fails, skip this value
                        continue
            return False
        except Exception as e:
            logger.debug(f"Error checking floating point values: {e}")
            return False
    
    def _calculate_missing_percentage(self, df: pd.DataFrame) -> float:
        """Calculate percentage of missing values."""
        total_cells = df.size
        missing_cells = df.isnull().sum().sum()
        return (missing_cells / total_cells * 100) if total_cells > 0 else 0
    
    def _analyze_missing_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze missing data patterns."""
        missing_counts = df.isnull().sum()
        missing_vars = {col: int(count) for col, count in missing_counts.items() if count > 0}
        
        return {
            'variables_with_missing': missing_vars,
            'missing_count': len(missing_vars),
            'completely_missing_vars': missing_counts[missing_counts == len(df)].index.tolist()
        }
    
    def _find_constant_columns(self, df: pd.DataFrame) -> List[str]:
        """Find columns with constant values."""
        return [col for col in df.columns if df[col].nunique() <= 1]
    
    def _categorize_sample_size(self, n: int) -> str:
        """Categorize sample size."""
        if n < 10:
            return 'very_small'
        elif n < 50:
            return 'small'
        elif n < 200:
            return 'medium'
        elif n < 1000:
            return 'large'
        else:
            return 'very_large'
    
    def _create_numeric_summaries(self, df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
        """Create summaries for numeric variables."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        summaries = {}
        
        for col in numeric_cols:
            try:
                series = df[col].dropna()
                if len(series) > 0:
                    summaries[col] = {
                        'mean': float(series.mean()),
                        'median': float(series.median()),
                        'std': float(series.std()),
                        'min': float(series.min()),
                        'max': float(series.max()),
                        'q25': float(series.quantile(0.25)),
                        'q75': float(series.quantile(0.75)),
                        'skewness': float(series.skew()),
                        'kurtosis': float(series.kurtosis())
                    }
            except Exception as e:
                logger.warning(f"Error creating summary for {col}: {str(e)}")
                summaries[col] = {'error': str(e)}
        
        return summaries
    
    def _create_categorical_summaries(self, df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
        """Create summaries for categorical variables."""
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns
        summaries = {}
        
        for col in categorical_cols:
            try:
                series = df[col].dropna()
                if len(series) > 0:
                    value_counts = series.value_counts()
                    summaries[col] = {
                        'unique_count': int(len(value_counts)),
                        'most_frequent': str(value_counts.index[0]) if len(value_counts) > 0 else None,
                        'most_frequent_count': int(value_counts.iloc[0]) if len(value_counts) > 0 else 0,
                        'least_frequent': str(value_counts.index[-1]) if len(value_counts) > 0 else None,
                        'least_frequent_count': int(value_counts.iloc[-1]) if len(value_counts) > 0 else 0,
                        'mode_frequency': float(value_counts.iloc[0] / len(series)) if len(value_counts) > 0 else 0
                    }
            except Exception as e:
                logger.warning(f"Error creating categorical summary for {col}: {str(e)}")
                summaries[col] = {'error': str(e)}
        
        return summaries
    
    def _count_potential_correlations(self, df: pd.DataFrame) -> int:
        """Count potential correlation pairs."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        n_numeric = len(numeric_cols)
        return int(n_numeric * (n_numeric - 1) // 2) if n_numeric >= 2 else 0
    
    def _count_potential_cross_tabs(self, df: pd.DataFrame) -> int:
        """Count potential cross-tabulation pairs."""
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns
        n_categorical = len(categorical_cols)
        return int(n_categorical * (n_categorical - 1) // 2) if n_categorical >= 2 else 0
    
    def _identify_grouping_variables(self, df: pd.DataFrame) -> List[str]:
        """Identify potential grouping variables."""
        grouping_vars = []
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns
        
        for col in categorical_cols:
            unique_count = df[col].nunique()
            if 2 <= unique_count <= 10:  # Good grouping variable range
                grouping_vars.append(col)
        
        return grouping_vars
    
    def _has_datetime_columns(self, df: pd.DataFrame) -> bool:
        """Check if data has datetime columns."""
        return any(pd.api.types.is_datetime64_any_dtype(df[col]) for col in df.columns)
    
    def _has_geographic_columns(self, df: pd.DataFrame) -> bool:
        """Check if data has geographic columns."""
        geo_terms = ['lat', 'lon', 'latitude', 'longitude', 'coord']
        return any(any(term in str(col).lower() for term in geo_terms) for col in df.columns)
    
    def _has_text_columns(self, df: pd.DataFrame) -> bool:
        """Check if data has substantial text columns."""
        text_cols = df.select_dtypes(include=['object']).columns
        for col in text_cols:
            try:
                if df[col].str.len().mean() > 50:  # Average text length > 50 chars
                    return True
            except:
                continue
        return False
    
    def _find_identifier_columns(self, df: pd.DataFrame) -> List[str]:
        """Find potential identifier columns."""
        identifiers = []
        id_terms = ['id', 'identifier', 'key', 'uuid']
        
        for col in df.columns:
            col_lower = str(col).lower()
            if (any(term in col_lower for term in id_terms) and 
                df[col].nunique() == len(df)):
                identifiers.append(col)
        
        return identifiers
    
    def _is_survey_like(self, df: pd.DataFrame, characteristics: DataCharacteristics) -> bool:
        """Determine if data looks like survey data."""
        categorical_ratio = characteristics.type_counts.get(DataType.CATEGORICAL, 0) / characteristics.n_variables
        return (categorical_ratio > 0.5 and 
                characteristics.n_variables > 10 and
                characteristics.n_observations < 10000) 