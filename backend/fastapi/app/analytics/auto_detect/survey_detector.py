"""
Survey-specific data detection and analysis recommendation system.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum

class SurveyQuestionType(Enum):
    """Survey question types that researchers can specify."""
    LIKERT_SCALE = "likert_scale"
    MULTIPLE_CHOICE = "multiple_choice"
    OPEN_ENDED = "open_ended"
    DEMOGRAPHIC = "demographic"
    RANKING = "ranking"
    NUMERIC_INPUT = "numeric_input"
    YES_NO = "yes_no"
    CHECKBOX = "checkbox"
    RATING_SCALE = "rating_scale"
    SLIDER = "slider"
    MATRIX_QUESTION = "matrix_question"

class DataType(Enum):
    """Data types for analysis purposes."""
    ORDINAL = "ordinal"
    NOMINAL = "nominal"
    CONTINUOUS = "continuous"
    DISCRETE = "discrete"
    BINARY = "binary"
    TEXT = "text"
    DATETIME = "datetime"

@dataclass
class SurveyVariable:
    """Represents a survey variable with metadata."""
    column_name: str
    question_text: str
    question_type: SurveyQuestionType
    data_type: DataType
    scale_range: Optional[tuple] = None
    categories: Optional[List[str]] = None
    is_required: bool = True
    demographics_category: Optional[str] = None

@dataclass
class SurveyDataset:
    """Represents a complete survey dataset with metadata."""
    data: pd.DataFrame
    variables: List[SurveyVariable]
    survey_title: str
    sample_size: int
    collection_method: str
    target_population: str

class SurveyDetector:
    """Main survey detection class."""
    
    def __init__(self):
        self.variable_map = {}
    
    def analyze_survey_dataset(
        self, 
        df: pd.DataFrame, 
        variable_metadata: List[Dict[str, Any]],
        survey_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze a complete survey dataset with researcher-provided metadata.
        
        Args:
            df: Survey response DataFrame
            variable_metadata: List of variable metadata dictionaries
            survey_info: General survey information
            
        Returns:
            Comprehensive analysis recommendations
        """
        # Create survey variables
        variables = self._create_survey_variables(variable_metadata)
        
        # Create survey dataset object
        survey_dataset = SurveyDataset(
            data=df,
            variables=variables,
            survey_title=survey_info.get('title', 'Untitled Survey'),
            sample_size=len(df),
            collection_method=survey_info.get('collection_method', 'Unknown'),
            target_population=survey_info.get('target_population', 'Unknown')
        )
        
        # Validate data quality
        data_quality = self._assess_data_quality(survey_dataset)
        
        # Detect data characteristics
        characteristics = self._detect_data_characteristics(survey_dataset)
        
        # Generate analysis recommendations
        recommendations = self._generate_analysis_recommendations(survey_dataset, characteristics)
        
        return {
            "survey_info": {
                "title": survey_dataset.survey_title,
                "sample_size": survey_dataset.sample_size,
                "variables_count": len(survey_dataset.variables),
                "collection_method": survey_dataset.collection_method,
                "target_population": survey_dataset.target_population
            },
            "data_quality": data_quality,
            "characteristics": characteristics,
            "recommendations": recommendations
        }
    
    def _create_survey_variables(self, metadata_list: List[Dict[str, Any]]) -> List[SurveyVariable]:
        """Create SurveyVariable objects from metadata."""
        variables = []
        
        for meta in metadata_list:
            try:
                question_type = SurveyQuestionType(meta.get('question_type', 'multiple_choice'))
                data_type = DataType(meta.get('data_type', 'nominal'))
                
                variable = SurveyVariable(
                    column_name=meta['column_name'],
                    question_text=meta.get('question_text', ''),
                    question_type=question_type,
                    data_type=data_type,
                    scale_range=meta.get('scale_range'),
                    categories=meta.get('categories'),
                    is_required=meta.get('is_required', True),
                    demographics_category=meta.get('demographics_category')
                )
                variables.append(variable)
                
            except (KeyError, ValueError) as e:
                print(f"Warning: Invalid metadata for variable {meta.get('column_name', 'unknown')}: {e}")
                continue
        
        return variables
    
    def _assess_data_quality(self, survey_dataset: SurveyDataset) -> Dict[str, Any]:
        """Assess data quality of the survey dataset."""
        df = survey_dataset.data
        quality_metrics = {
            "overall_completion_rate": 0.0,
            "variable_quality": {},
            "response_patterns": {},
            "data_issues": []
        }
        
        total_responses = len(df)
        if total_responses == 0:
            quality_metrics["data_issues"].append("No response data available")
            return quality_metrics
        
        # Overall completion rate
        non_null_count = df.count().sum()
        total_possible = len(df) * len(df.columns)
        quality_metrics["overall_completion_rate"] = float(non_null_count / total_possible * 100)
        
        # Variable-specific quality
        for variable in survey_dataset.variables:
            col_name = variable.column_name
            if col_name in df.columns:
                col_data = df[col_name]
                
                # Missing data analysis
                missing_count = col_data.isna().sum()
                missing_rate = missing_count / len(df) * 100
                
                # Response pattern analysis
                if variable.data_type in [DataType.ORDINAL, DataType.NOMINAL]:
                    # Check for straight-lining (same answer repeatedly)
                    value_counts = col_data.value_counts()
                    most_common_pct = value_counts.iloc[0] / value_counts.sum() * 100 if not value_counts.empty else 0
                    
                    quality_metrics["variable_quality"][col_name] = {
                        "missing_rate": float(missing_rate),
                        "completion_rate": float(100 - missing_rate),
                        "unique_responses": int(col_data.nunique()),
                        "most_common_response_pct": float(most_common_pct),
                        "straight_lining_risk": "High" if most_common_pct > 80 else "Low"
                    }
                else:
                    quality_metrics["variable_quality"][col_name] = {
                        "missing_rate": float(missing_rate),
                        "completion_rate": float(100 - missing_rate),
                        "unique_responses": int(col_data.nunique())
                    }
                
                # Flag quality issues
                if missing_rate > 50:
                    quality_metrics["data_issues"].append(f"High missing rate ({missing_rate:.1f}%) in {col_name}")
                
                if variable.is_required and missing_rate > 10:
                    quality_metrics["data_issues"].append(f"Required variable {col_name} has {missing_rate:.1f}% missing data")
        
        return quality_metrics
    
    def _detect_data_characteristics(self, survey_dataset: SurveyDataset) -> Dict[str, Any]:
        """Detect key characteristics of the survey data."""
        df = survey_dataset.data
        characteristics = {
            "variable_types": {},
            "relationships": {},
            "distributions": {},
            "demographic_breakdown": {}
        }
        
        # Variable type summary
        type_counts = {}
        for variable in survey_dataset.variables:
            data_type = variable.data_type.value
            type_counts[data_type] = type_counts.get(data_type, 0) + 1
        
        characteristics["variable_types"] = type_counts
        
        # Demographic breakdown
        demographic_vars = [v for v in survey_dataset.variables if v.demographics_category]
        for demo_var in demographic_vars:
            col_name = demo_var.column_name
            if col_name in df.columns:
                value_counts = df[col_name].value_counts()
                characteristics["demographic_breakdown"][col_name] = {
                    "category": demo_var.demographics_category,
                    "distribution": value_counts.to_dict()
                }
        
        # Detect potential scale variables
        likert_vars = [v for v in survey_dataset.variables if v.question_type == SurveyQuestionType.LIKERT_SCALE]
        if likert_vars:
            characteristics["scale_variables"] = len(likert_vars)
            
        # Detect matrix questions (grouped variables)
        matrix_vars = [v for v in survey_dataset.variables if v.question_type == SurveyQuestionType.MATRIX_QUESTION]
        if matrix_vars:
            characteristics["matrix_questions"] = len(matrix_vars)
        
        return characteristics
    
    def _generate_analysis_recommendations(
        self, 
        survey_dataset: SurveyDataset, 
        characteristics: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """Generate specific analysis recommendations based on survey characteristics."""
        recommendations = {
            "descriptive": [],
            "inferential": [],
            "specialized": []
        }
        
        # Basic descriptive analyses (always recommended)
        recommendations["descriptive"].extend([
            "basic_statistics",
            "frequency_analysis",
            "missing_data_analysis"
        ])
        
        # Variable type specific recommendations
        variable_types = characteristics.get("variable_types", {})
        
        # Continuous/numeric variables
        if variable_types.get("continuous", 0) > 0 or variable_types.get("discrete", 0) > 0:
            recommendations["descriptive"].extend([
                "distribution_analysis",
                "outlier_detection"
            ])
            
            if variable_types.get("continuous", 0) + variable_types.get("discrete", 0) >= 2:
                recommendations["descriptive"].append("correlation_analysis")
                recommendations["inferential"].append("regression_analysis")
        
        # Categorical variables
        if variable_types.get("nominal", 0) > 0 or variable_types.get("ordinal", 0) > 0:
            recommendations["descriptive"].append("categorical_analysis")
            
            if variable_types.get("nominal", 0) + variable_types.get("ordinal", 0) >= 2:
                recommendations["descriptive"].append("cross_tabulation")
                recommendations["inferential"].append("chi_square_tests")
        
        # Likert scale specific
        likert_count = characteristics.get("scale_variables", 0)
        if likert_count > 0:
            recommendations["specialized"].extend([
                "likert_scale_analysis",
                "reliability_analysis"
            ])
            
            if likert_count >= 2:
                recommendations["specialized"].append("scale_correlation_analysis")
        
        # Matrix questions
        matrix_count = characteristics.get("matrix_questions", 0)
        if matrix_count > 0:
            recommendations["specialized"].append("matrix_question_analysis")
        
        # Demographic analysis
        if characteristics.get("demographic_breakdown"):
            recommendations["descriptive"].append("demographic_analysis")
            recommendations["inferential"].append("group_comparisons")
        
        # Survey-specific analyses
        recommendations["specialized"].extend([
            "response_quality_analysis",
            "survey_completion_analysis"
        ])
        
        return recommendations 