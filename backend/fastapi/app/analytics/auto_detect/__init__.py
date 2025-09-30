"""
Central auto-detection module for comprehensive data analysis.
Coordinates between descriptive, inferential, and qualitative analytics modules.
"""

import warnings
from typing import Dict, Any, List, Optional, Union

# Import standardized base classes first
try:
    from .base_detector import (
        BaseAutoDetector, DataCharacteristics, AnalysisRecommendation, 
        AnalysisSuggestions, DataType, AnalysisConfidence, StandardizedDataProfiler
    )
except ImportError:
    # Fallback for direct execution
    from base_detector import (
        BaseAutoDetector, DataCharacteristics, AnalysisRecommendation, 
        AnalysisSuggestions, DataType, AnalysisConfidence, StandardizedDataProfiler
    )

# Import survey-specific classes (keeping for specialized survey analysis)
try:
    from .survey_detector import (
        SurveyDetector,
        SurveyVariable,
        SurveyDataset,
        SurveyQuestionType,
        DataType as SurveyDataType  # Alias to avoid confusion
    )
except ImportError:
    # Fallback for direct execution
    from survey_detector import (
        SurveyDetector,
        SurveyVariable,
        SurveyDataset,
        SurveyQuestionType,
        DataType as SurveyDataType  # Alias to avoid confusion
    )


# Import module-specific auto-detection systems with better error handling
descriptive_available = False
inferential_available = False  
qualitative_available = False

try:
    from ..descriptive.auto_detection import DescriptiveAutoDetector
    descriptive_available = True
except ImportError as e:
    try:
        # Try absolute import when relative import fails
        import sys
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        from descriptive.auto_detection import DescriptiveAutoDetector
        descriptive_available = True
    except ImportError:
        print(f"Warning: Could not import descriptive auto-detection: {e}")

try:
    # Use lazy import to avoid circular imports
    InferentialAutoDetector = None
    inferential_available = True
    
    def get_inferential_detector():
        global InferentialAutoDetector
        if InferentialAutoDetector is None:
            try:
                from ..inferential.auto_detection import InferentialAutoDetector as IAD
                InferentialAutoDetector = IAD
            except ImportError:
                try:
                    from inferential.auto_detection import InferentialAutoDetector as IAD
                    InferentialAutoDetector = IAD
                except ImportError as e:
                    print(f"Warning: Could not import inferential auto-detection: {e}")
                    return None
        return InferentialAutoDetector
        
except Exception as e:
    print(f"Warning: Could not setup inferential auto-detection: {e}")
    inferential_available = False

try:
    from ..qualitative.auto_detection import QualitativeAutoDetector
    qualitative_available = True
except ImportError as e:
    try:
        # Try absolute import when relative import fails
        import sys
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        from qualitative.auto_detection import QualitativeAutoDetector
        qualitative_available = True
    except ImportError:
        print(f"Warning: Could not import qualitative auto-detection: {e}")

class UnifiedAutoDetector:
    """
    Unified auto-detection system that coordinates all analytics modules
    with standardized interfaces and cross-module intelligence.
    """
    
    def __init__(self):
        self.data_profiler = StandardizedDataProfiler()
        self.detectors = {}
        
        # Initialize available detectors
        if descriptive_available:
            self.detectors['descriptive'] = DescriptiveAutoDetector()
        if inferential_available:
            detector_class = get_inferential_detector()
            if detector_class:
                self.detectors['inferential'] = detector_class()
        if qualitative_available:
            self.detectors['qualitative'] = QualitativeAutoDetector()
    
    def analyze_comprehensive_data(self, data, analysis_type="auto", **kwargs):
        """
        Comprehensive data analysis using all available analytics modules with improved coordination.
        """
        # Get unified data characteristics once
        characteristics = self.data_profiler.profile_data(data)
        
        results = {
            "data_characteristics": characteristics,
            "module_results": {},
            "coordination": {
                "analysis_type": analysis_type,
                "modules_used": [],
                "cross_module_insights": {},
                "unified_recommendations": {}
            }
        }
        
        # Determine which modules to use based on data characteristics
        modules_to_use = self._determine_optimal_modules(characteristics, analysis_type, **kwargs)
        
        # Run analyses in parallel conceptually (synchronous for now)
        for module_name in modules_to_use:
            if module_name in self.detectors:
                try:
                    module_result = self._run_module_analysis(
                        module_name, data, characteristics, **kwargs
                    )
                    results["module_results"][module_name] = module_result
                    results["coordination"]["modules_used"].append(module_name)
                except Exception as e:
                    results["module_results"][module_name] = {
                        "error": f"Analysis failed: {str(e)}"
                    }
        
        # Generate cross-module insights
        results["coordination"]["cross_module_insights"] = self._generate_cross_module_insights(
            results["module_results"], characteristics
        )
        
        # Generate unified recommendations
        results["coordination"]["unified_recommendations"] = self._generate_unified_recommendations(
            results["module_results"], characteristics
        )
        
        return results
    
    def _determine_optimal_modules(self, characteristics: DataCharacteristics, 
                                 analysis_type: str, **kwargs) -> List[str]:
        """Determine which modules should be used based on data characteristics."""
        modules = []
        
        if analysis_type == "auto":
            # Smart module selection based on data characteristics
            
            # Always include descriptive if available
            if descriptive_available:
                modules.append("descriptive")
            
            # Include inferential if we have suitable numeric/categorical data
            if (inferential_available and 
                (characteristics.type_counts.get(DataType.NUMERIC_CONTINUOUS, 0) > 0 or
                 characteristics.type_counts.get(DataType.CATEGORICAL, 0) > 1)):
                modules.append("inferential")
            
            # Include qualitative if we have text data
            if (qualitative_available and 
                (characteristics.has_text or 
                 characteristics.type_counts.get(DataType.TEXT, 0) > 0)):
                modules.append("qualitative")
        
        elif analysis_type == "comprehensive":
            # Use all available modules
            modules = list(self.detectors.keys())
        
        else:
            # Specific module requested
            if analysis_type in self.detectors:
                modules = [analysis_type]
        
        return modules
    
    def _run_module_analysis(self, module_name: str, data, 
                           characteristics: DataCharacteristics, **kwargs):
        """Run analysis for a specific module with standardized interface."""
        detector = self.detectors[module_name]
        
        if module_name == "descriptive":
            # Use standardized method
            suggestions = detector.suggest_analyses(data, **kwargs)
            return {
                "suggestions": suggestions,
                "characteristics": characteristics,
                "module_type": "descriptive"
            }
        
        elif module_name == "inferential":
            # Use standardized method
            suggestions = detector.suggest_analyses(data, **kwargs)
            return {
                "suggestions": suggestions,
                "characteristics": characteristics,
                "module_type": "inferential"
            }
        
        elif module_name == "qualitative":
            # Convert data to text format if needed
            texts = self._extract_text_data(data)
            if texts:
                # Use standardized method with text data
                suggestions = detector.suggest_analyses(data, texts=texts, **kwargs)
                return {
                    "suggestions": suggestions,
                    "characteristics": characteristics,
                    "module_type": "qualitative",
                    "text_count": len(texts)
                }
            else:
                return {"error": "No text data found for qualitative analysis"}
        
        return {"error": f"Unknown module: {module_name}"}
    
    def _extract_text_data(self, data) -> List[str]:
        """Extract text data for qualitative analysis."""
        texts = []
        
        if hasattr(data, 'select_dtypes'):
            # DataFrame
            text_cols = data.select_dtypes(include=['object']).columns
            for col in text_cols:
                # Only include columns with substantial text content
                mean_length = data[col].str.len().mean()
                if mean_length > 20:  
                    col_texts = data[col].dropna().tolist()
                    texts.extend(col_texts)
        elif hasattr(data, 'dtype') and data.dtype == 'object':
            # Series with text
            texts = data.dropna().tolist()
        elif isinstance(data, list):
            # List of texts
            texts = [str(item) for item in data if str(item).strip()]
        
        return texts
    
    def _generate_cross_module_insights(self, module_results: Dict[str, Any], 
                                      characteristics: DataCharacteristics) -> Dict[str, Any]:
        """Generate insights that span multiple modules."""
        insights = {
            "data_quality_summary": self._summarize_data_quality(characteristics),
            "pattern_convergence": {},
            "complementary_findings": {},
            "analysis_conflicts": []
        }
        
        # Look for convergent patterns across modules
        if "descriptive" in module_results and "inferential" in module_results:
            insights["pattern_convergence"]["quantitative_alignment"] = (
                self._check_quantitative_alignment(
                    module_results["descriptive"], 
                    module_results["inferential"]
                )
            )
        
        if "descriptive" in module_results and "qualitative" in module_results:
            insights["complementary_findings"]["mixed_methods"] = (
                "Quantitative patterns can be explored with qualitative insights"
            )
        
        # Identify potential analysis conflicts
        insights["analysis_conflicts"] = self._identify_conflicts(module_results)
        
        return insights
    
    def _summarize_data_quality(self, characteristics: DataCharacteristics) -> Dict[str, Any]:
        """Summarize data quality across all dimensions."""
        return {
            "overall_score": characteristics.completeness_score,
            "missing_data_level": "high" if characteristics.missing_percentage > 20 else 
                                  "moderate" if characteristics.missing_percentage > 5 else "low",
            "sample_size_adequacy": characteristics.sample_size_category,
            "data_complexity": "high" if characteristics.n_variables > 50 else 
                              "moderate" if characteristics.n_variables > 10 else "low",
            "recommendations": self._get_quality_recommendations(characteristics)
        }
    
    def _get_quality_recommendations(self, characteristics: DataCharacteristics) -> List[str]:
        """Get data quality improvement recommendations."""
        recommendations = []
        
        if characteristics.missing_percentage > 10:
            recommendations.append("Consider imputation strategies for missing data")
        
        if characteristics.duplicate_rows > 0:
            recommendations.append("Remove duplicate rows before analysis")
        
        if characteristics.constant_columns:
            recommendations.append("Remove constant columns (no variance)")
        
        if characteristics.sample_size_category in ['very_small', 'small']:
            recommendations.append("Consider collecting more data for robust analysis")
        
        return recommendations
    
    def _check_quantitative_alignment(self, desc_results: Dict[str, Any], 
                                    inf_results: Dict[str, Any]) -> Dict[str, Any]:
        """Check alignment between descriptive and inferential findings."""
        alignment = {
            "correlation_consistency": False,
            "distribution_assumptions": False,
            "sample_size_adequacy": False
        }
        
        # Safely extract methods from results
        desc_methods = []
        if "suggestions" in desc_results:
            suggestions = desc_results["suggestions"]
            if hasattr(suggestions, 'primary_recommendations'):
                desc_methods = [rec.method for rec in suggestions.primary_recommendations]
            elif isinstance(suggestions, dict):
                desc_methods = [rec.get('method', '') for rec in suggestions.get("primary_recommendations", [])]
        
        inf_methods = []
        if "suggestions" in inf_results:
            suggestions = inf_results["suggestions"]
            if hasattr(suggestions, 'primary_recommendations'):
                inf_methods = [rec.method for rec in suggestions.primary_recommendations]
            elif isinstance(suggestions, dict):
                inf_methods = [rec.get('method', '') for rec in suggestions.get("primary_recommendations", [])]
        
        if any("correlation" in method for method in desc_methods) and \
           any("correlation" in method for method in inf_methods):
            alignment["correlation_consistency"] = True
        
        return alignment
    
    def _identify_conflicts(self, module_results: Dict[str, Any]) -> List[str]:
        """Identify potential conflicts between module recommendations."""
        conflicts = []
        
        # Check for contradictory assumptions
        if "descriptive" in module_results and "inferential" in module_results:
            # Could add logic to detect assumption conflicts
            pass
        
        return conflicts
    
    def _generate_unified_recommendations(self, module_results: Dict[str, Any], 
                                        characteristics: DataCharacteristics) -> Dict[str, Any]:
        """Generate unified recommendations across all modules."""
        recommendations = {
            "immediate_actions": [],
            "analysis_sequence": [],
            "integration_opportunities": [],
            "reporting_strategy": {},
            "next_steps": []
        }
        
        # Immediate actions based on data quality
        if characteristics.missing_percentage > 20:
            recommendations["immediate_actions"].append(
                "Address missing data before proceeding with analysis"
            )
        
        # Analysis sequence
        if "descriptive" in module_results:
            recommendations["analysis_sequence"].append("descriptive_overview")
        if "inferential" in module_results:
            recommendations["analysis_sequence"].append("statistical_testing")
        if "qualitative" in module_results:
            recommendations["analysis_sequence"].append("qualitative_exploration")
        
        # Integration opportunities
        if len(module_results) > 1:
            recommendations["integration_opportunities"].extend([
                "Cross-validate findings across analytical approaches",
                "Use descriptive insights to inform statistical interpretation",
                "Triangulate results using multiple methods"
            ])
        
        # Reporting strategy
        recommendations["reporting_strategy"] = {
            "primary_narrative": self._determine_primary_narrative(module_results),
            "supporting_analyses": list(module_results.keys()),
            "visualization_priorities": self._get_visualization_priorities(characteristics)
        }
        
        return recommendations
    
    def _determine_primary_narrative(self, module_results: Dict[str, Any]) -> str:
        """Determine the primary narrative based on available analyses."""
        if "qualitative" in module_results and "descriptive" in module_results:
            return "mixed_methods"
        elif "inferential" in module_results:
            return "statistical_hypothesis_testing"
        elif "descriptive" in module_results:
            return "exploratory_data_analysis"
        elif "qualitative" in module_results:
            return "qualitative_insights"
        else:
            return "data_exploration"
    
    def _get_visualization_priorities(self, characteristics: DataCharacteristics) -> List[str]:
        """Get visualization priorities based on data characteristics."""
        priorities = []
        
        if characteristics.type_counts.get(DataType.NUMERIC_CONTINUOUS, 0) > 0:
            priorities.append("distribution_plots")
        
        if characteristics.type_counts.get(DataType.CATEGORICAL, 0) > 0:
            priorities.append("frequency_charts")
        
        if characteristics.potential_correlations > 0:
            priorities.append("correlation_matrix")
        
        if characteristics.has_datetime:
            priorities.append("time_series_plots")
        
        if characteristics.has_geographic:
            priorities.append("spatial_maps")
        
        return priorities

# Central analysis coordination function (updated to use UnifiedAutoDetector)
def analyze_comprehensive_data(
    data,
    variable_metadata=None,
    analysis_type="auto",
    include_descriptive=True,
    include_inferential=True,
    include_qualitative=True,
    target_variable=None,
    grouping_variable=None,
    **kwargs
):
    """
    Comprehensive data analysis using all three analytics modules with improved coordination.
    
    Args:
        data: Input data (DataFrame, Series, or dict)
        variable_metadata: Optional variable metadata
        analysis_type: Type of analysis ("auto", "basic", "comprehensive")
        include_descriptive: Whether to include descriptive analytics
        include_inferential: Whether to include inferential analytics  
        include_qualitative: Whether to include qualitative analytics
        target_variable: Target/dependent variable for inferential analysis
        grouping_variable: Grouping/independent variable
        **kwargs: Additional parameters
        
    Returns:
        Dictionary with comprehensive analysis results
    """
    # Use the new unified detector
    unified_detector = UnifiedAutoDetector()
    
    # Filter modules based on include flags
    analysis_kwargs = {
        "target_variable": target_variable,
        "grouping_variable": grouping_variable,
        **kwargs
    }
    
    # For backward compatibility, filter which modules to include
    if analysis_type == "auto":
        if not include_descriptive:
            analysis_kwargs["exclude_modules"] = analysis_kwargs.get("exclude_modules", []) + ["descriptive"]
        if not include_inferential:
            analysis_kwargs["exclude_modules"] = analysis_kwargs.get("exclude_modules", []) + ["inferential"]
        if not include_qualitative:
            analysis_kwargs["exclude_modules"] = analysis_kwargs.get("exclude_modules", []) + ["qualitative"]
    
    return unified_detector.analyze_comprehensive_data(data, analysis_type, **analysis_kwargs)

def get_unified_recommendations(data, research_context=None, **kwargs):
    """
    Get comprehensive analysis recommendations across all modules using the unified system.
    
    Args:
        data: Input data
        research_context: Optional research context information
        **kwargs: Additional parameters
        
    Returns:
        Unified analysis recommendations
    """
    unified_detector = UnifiedAutoDetector()
    
    # Get data characteristics using the standardized profiler
    characteristics = unified_detector.data_profiler.profile_data(data)
    
    # Determine optimal modules
    modules_to_use = unified_detector._determine_optimal_modules(characteristics, "auto", **kwargs)
    
    # Get recommendations from each module
    module_recommendations = {}
    for module_name in modules_to_use:
        if module_name in unified_detector.detectors:
            try:
                detector = unified_detector.detectors[module_name]
                if module_name == "qualitative":
                    texts = unified_detector._extract_text_data(data)
                    if texts:
                        recommendations = detector.suggest_analysis_methods(texts, **kwargs)
                    else:
                        recommendations = {"error": "No text data found"}
                else:
                    recommendations = detector.suggest_analyses(data, **kwargs)
                
                module_recommendations[module_name] = recommendations
            except Exception as e:
                module_recommendations[module_name] = {"error": str(e)}
    
    # Generate unified recommendations
    unified_recommendations = unified_detector._generate_unified_recommendations(
        {"_recommendations": module_recommendations}, characteristics
    )
    
    return {
        "data_characteristics": characteristics,
        "module_recommendations": module_recommendations,
        "unified_recommendations": unified_recommendations,
        "optimal_modules": modules_to_use
    }

# Factory function for creating appropriate auto-detectors
def create_auto_detector(analysis_type: str):
    """
    Factory function to create appropriate auto-detector instances.
    
    Args:
        analysis_type: Type of analysis ("descriptive", "inferential", "qualitative", "unified")
        
    Returns:
        Appropriate auto-detector instance
    """
    if analysis_type == "descriptive" and descriptive_available:
        return DescriptiveAutoDetector()
    elif analysis_type == "inferential" and inferential_available:
        detector_class = get_inferential_detector()
        if detector_class:
            return detector_class()
        else:
            raise ImportError("Inferential auto-detection not available")
    elif analysis_type == "qualitative" and qualitative_available:
        return QualitativeAutoDetector()
    elif analysis_type == "unified":
        return UnifiedAutoDetector()
    else:
        raise ValueError(f"Unsupported analysis type: {analysis_type} or module not available")

# FastAPI Integration Helper
def get_analysis_for_api(data, analysis_type="auto", **kwargs):
    """
    Get analysis results in a format suitable for FastAPI responses.
    
    Args:
        data: Input data
        analysis_type: Type of analysis
        **kwargs: Additional parameters
        
    Returns:
        Dictionary formatted for API response
    """
    try:
        unified_detector = UnifiedAutoDetector()
        results = unified_detector.analyze_comprehensive_data(data, analysis_type, **kwargs)
        
        # Format for API response
        api_response = {
            "status": "success",
            "data_overview": {
                "sample_size": results["data_characteristics"].n_observations,
                "variables": results["data_characteristics"].n_variables,
                "data_types": dict(results["data_characteristics"].type_counts),
                "quality_score": results["data_characteristics"].completeness_score
            },
            "available_analyses": list(results["module_results"].keys()),
            "recommendations": results["coordination"]["unified_recommendations"],
            "insights": results["coordination"]["cross_module_insights"],
            "execution_time": "< 1 minute"  # Placeholder
        }
        
        # Add module-specific results
        for module_name, module_result in results["module_results"].items():
            if "error" not in module_result:
                # Safely extract recommendations
                recommendations = []
                if "suggestions" in module_result:
                    suggestions = module_result["suggestions"]
                    if hasattr(suggestions, 'primary_recommendations'):
                        recommendations = [
                            {
                                "method": rec.method,
                                "score": rec.score,
                                "confidence": rec.confidence.value,
                                "rationale": rec.rationale
                            }
                            for rec in suggestions.primary_recommendations[:3]
                        ]
                    elif isinstance(suggestions, dict):
                        recommendations = suggestions.get("primary_recommendations", [])[:3]
                
                api_response[f"{module_name}_analysis"] = {
                    "available": True,
                    "recommendations": recommendations
                }
            else:
                api_response[f"{module_name}_analysis"] = {
                    "available": False,
                    "error": module_result["error"]
                }
        
        return api_response
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Analysis failed: {str(e)}",
            "suggestions": ["Check data format", "Verify data types", "Ensure adequate sample size"]
        }

# Update the main __all__ export list
__all__ = [
    # Standardized base classes
    'BaseAutoDetector', 
    'DataCharacteristics', 
    'AnalysisRecommendation', 
    'AnalysisSuggestions', 
    'DataType', 
    'AnalysisConfidence',
    'StandardizedDataProfiler',
    
    # Unified system
    'UnifiedAutoDetector',
    
    # Central coordination functions (updated)
    'analyze_comprehensive_data',
    'get_unified_recommendations',
    'create_auto_detector',
    'get_analysis_for_api',
    
    # Legacy functions (for backward compatibility)
    'detect_optimal_analysis_strategy',
    'analyze_survey_data',
    'quick_data_analysis',
    'get_analysis_recommendations',
    
    # Survey-specific classes and enums
    'SurveyDetector',
    'SurveyVariable',
    'SurveyDataset',
    'SurveyQuestionType',
    'SurveyDataType'
]

# Legacy functions for backward compatibility
def detect_optimal_analysis_strategy(data, research_questions=None, analysis_goals=None, constraints=None):
    """
    Legacy function - use get_unified_recommendations instead.
    Detect the optimal analysis strategy across all modules.
    """
    warnings.warn(
        "detect_optimal_analysis_strategy is deprecated. Use get_unified_recommendations instead.",
        DeprecationWarning,
        stacklevel=2
    )
    return get_unified_recommendations(data, research_context={'questions': research_questions, 'goals': analysis_goals})

def analyze_survey_data(df, variable_metadata, survey_info, priorities=None, execute_analyses=True):
    """
    Legacy function - use UnifiedAutoDetector for survey analysis.
    Comprehensive survey analysis using all applicable modules.
    """
    warnings.warn(
        "analyze_survey_data is deprecated. Use UnifiedAutoDetector.analyze_comprehensive_data instead.",
        DeprecationWarning,
        stacklevel=2
    )
    
    unified_detector = UnifiedAutoDetector()
    
    # Convert legacy format to new format
    kwargs = {
        'variable_metadata': variable_metadata,
        'survey_info': survey_info,
        'priorities': priorities
    }
    
    if execute_analyses:
        return unified_detector.analyze_comprehensive_data(df, analysis_type="comprehensive", **kwargs)
    else:
        # Return just recommendations
        return get_unified_recommendations(df, **kwargs)

def quick_data_analysis(data, analysis_focus="auto"):
    """
    Legacy function - use UnifiedAutoDetector instead.
    Quick analysis with automatic module selection.
    """
    warnings.warn(
        "quick_data_analysis is deprecated. Use UnifiedAutoDetector.analyze_comprehensive_data instead.",
        DeprecationWarning,
        stacklevel=2
    )
    
    unified_detector = UnifiedAutoDetector()
    
    # Map legacy focus to new analysis type
    if analysis_focus == "auto":
        analysis_type = "auto"
    elif analysis_focus in ["descriptive", "inferential", "qualitative"]:
        analysis_type = analysis_focus
    else:
        analysis_type = "auto"
    
    return unified_detector.analyze_comprehensive_data(data, analysis_type=analysis_type)

def get_analysis_recommendations(data, research_context=None):
    """
    Legacy function - use get_unified_recommendations instead.
    Get comprehensive analysis recommendations across all modules.
    """
    warnings.warn(
        "get_analysis_recommendations is deprecated. Use get_unified_recommendations instead.",
        DeprecationWarning,
        stacklevel=2
    )
    return get_unified_recommendations(data, research_context) 