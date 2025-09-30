"""
Auto-detection module for inferential statistics.
Automatically suggests appropriate statistical tests and methods based on data characteristics.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Optional, Union
from collections import Counter
import warnings
from scipy import stats

# Import base classes
from ..auto_detect.base_detector import (
    BaseAutoDetector, DataCharacteristics, AnalysisRecommendation, 
    DataType, AnalysisConfidence
)

from .inference_utils import (
    validate_series_data, validate_two_samples, validate_dataframe_columns,
    test_normality, test_equal_variances, test_independence,
    check_test_assumptions, get_test_recommendations
)

class InferentialAutoDetector(BaseAutoDetector):
    """
    Comprehensive auto-detection system for inferential statistics.
    """
    
    def __init__(self):
        super().__init__("Inferential Statistics")
        
    def get_method_requirements(self) -> Dict[str, Dict[str, Any]]:
        """Return method requirements for inferential analyses."""
        return {
            'one_sample_t_test': {
                'min_n': 5,
                'data_types': ['continuous'],
                'assumptions': ['normality'],
                'use_cases': ['single_group_mean', 'test_against_value']
            },
            'two_sample_t_test': {
                'min_n': 10,  # 5 per group
                'data_types': ['continuous'],
                'assumptions': ['normality', 'equal_variances'],
                'use_cases': ['compare_two_groups', 'independent_groups']
            },
            'paired_t_test': {
                'min_n': 5,
                'data_types': ['continuous'],
                'assumptions': ['normality_differences'],
                'use_cases': ['before_after', 'matched_pairs']
            },
            'welch_t_test': {
                'min_n': 10,
                'data_types': ['continuous'],
                'assumptions': ['normality'],
                'use_cases': ['unequal_variances', 'robust_t_test']
            },
            'mann_whitney_u': {
                'min_n': 6,
                'data_types': ['ordinal', 'continuous'],
                'assumptions': [],
                'use_cases': ['non_parametric', 'violated_normality']
            },
            'wilcoxon_signed_rank': {
                'min_n': 6,
                'data_types': ['ordinal', 'continuous'],
                'assumptions': [],
                'use_cases': ['non_parametric_paired', 'violated_normality_paired']
            },
            'one_way_anova': {
                'min_n': 15,  # 5 per group minimum
                'data_types': ['continuous'],
                'assumptions': ['normality', 'equal_variances'],
                'use_cases': ['multiple_groups', 'compare_means']
            },
            'kruskal_wallis': {
                'min_n': 12,
                'data_types': ['ordinal', 'continuous'],
                'assumptions': [],
                'use_cases': ['non_parametric_multiple_groups']
            },
            'chi_square_independence': {
                'min_n': 20,
                'data_types': ['categorical'],
                'assumptions': ['expected_frequencies'],
                'use_cases': ['categorical_association']
            },
            'chi_square_goodness_of_fit': {
                'min_n': 15,
                'data_types': ['categorical'],
                'assumptions': ['expected_frequencies'],
                'use_cases': ['distribution_test']
            },
            'fisher_exact': {
                'min_n': 4,
                'data_types': ['categorical'],
                'assumptions': [],
                'use_cases': ['small_sample_categorical', '2x2_table']
            },
            'correlation_test': {
                'min_n': 10,
                'data_types': ['continuous'],
                'assumptions': ['bivariate_normality'],
                'use_cases': ['relationship_strength']
            },
            'linear_regression': {
                'min_n': 20,
                'data_types': ['continuous'],
                'assumptions': ['linearity', 'normality', 'homoscedasticity'],
                'use_cases': ['prediction', 'relationship_modeling']
            },
            'logistic_regression': {
                'min_n': 50,
                'data_types': ['binary_outcome'],
                'assumptions': ['linearity_logit'],
                'use_cases': ['binary_prediction', 'odds_modeling']
            },
            'bootstrap_test': {
                'min_n': 15,
                'data_types': ['any'],
                'assumptions': [],
                'use_cases': ['robust_inference', 'small_samples']
            }
        }
    
    def detect_data_characteristics(self, data: Union[pd.DataFrame, pd.Series, Dict],
                                  target_variable: Optional[str] = None,
                                  grouping_variable: Optional[str] = None) -> DataCharacteristics:
        """
        Analyze data characteristics for statistical test selection.
        Uses the standardized base class method.
        
        Args:
            data: Input data (DataFrame, Series, or dict)
            target_variable: Name of target/dependent variable
            grouping_variable: Name of grouping/independent variable
            
        Returns:
            Standardized DataCharacteristics object
        """
        # Convert data to DataFrame if needed
        if isinstance(data, pd.Series):
            data = data.to_frame()
        elif isinstance(data, dict):
            data = pd.DataFrame(data)
        
        # Use the standardized base class method
        return super().detect_data_characteristics(data, variable_metadata=None)
    
    def suggest_statistical_tests(self, data: Union[pd.DataFrame, pd.Series, Dict],
                                target_variable: Optional[str] = None,
                                grouping_variable: Optional[str] = None,
                                research_question: Optional[str] = None,
                                alpha: float = 0.05) -> Dict[str, Any]:
        """
        Suggest appropriate statistical tests based on data characteristics.
        This method now uses the standardized base class implementation.
        """
        # Use the standardized base class method
        kwargs = {
            'target_variable': target_variable,
            'grouping_variable': grouping_variable,
            'research_question': research_question,
            'alpha': alpha
        }
        
        suggestions = self.suggest_analyses(data, **kwargs)
        
        # Convert to legacy format for backward compatibility
        legacy_format = {
            'primary_recommendations': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale,
                    'parameters': rec.parameters,
                    'function_call': rec.function_call
                }
                for rec in suggestions.primary_recommendations
            ],
            'secondary_recommendations': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale,
                    'parameters': rec.parameters,
                    'function_call': rec.function_call
                }
                for rec in suggestions.secondary_recommendations
            ],
            'not_recommended': [
                {
                    'method': item['method'],
                    'score': item['score'],
                    'reason': item['reason']
                }
                for item in suggestions.not_recommended
            ],
            'power_analysis_needed': len(suggestions.primary_recommendations) == 0,
            'sample_size_recommendations': {},
            'assumption_violations': []
        }
        
        return legacy_format
    
    def auto_configure_test(self, method_name: str, data: Union[pd.DataFrame, pd.Series],
                          target_variable: Optional[str] = None,
                          grouping_variable: Optional[str] = None) -> Dict[str, Any]:
        """
        Automatically configure parameters for a specific statistical test.
        
        Args:
            method_name: Name of the statistical method
            data: Input data
            target_variable: Dependent variable
            grouping_variable: Independent variable
            
        Returns:
            Dictionary with optimized test configuration
        """
        characteristics = self.detect_data_characteristics(data, target_variable, grouping_variable)
        
        configurations = {
            'one_sample_t_test': self._configure_one_sample_t_test,
            'two_sample_t_test': self._configure_two_sample_t_test,
            'paired_t_test': self._configure_paired_t_test,
            'welch_t_test': self._configure_welch_t_test,
            'mann_whitney_u': self._configure_mann_whitney,
            'wilcoxon_signed_rank': self._configure_wilcoxon,
            'one_way_anova': self._configure_anova,
            'kruskal_wallis': self._configure_kruskal_wallis,
            'chi_square_independence': self._configure_chi_square,
            'correlation_test': self._configure_correlation,
            'linear_regression': self._configure_linear_regression,
            'logistic_regression': self._configure_logistic_regression,
            'bootstrap_test': self._configure_bootstrap_test
        }
        
        if method_name in configurations:
            return configurations[method_name](characteristics, data, target_variable, grouping_variable)
        else:
            return {"error": f"Unknown method: {method_name}"}
    
    def generate_analysis_report(self, data: Union[pd.DataFrame, pd.Series],
                               target_variable: Optional[str] = None,
                               grouping_variable: Optional[str] = None) -> str:
        """
        Generate a comprehensive analysis report with recommendations.
        
        Args:
            data: Input data
            target_variable: Dependent variable
            grouping_variable: Independent variable
            
        Returns:
            Human-readable analysis report
        """
        characteristics = self.detect_data_characteristics(data, target_variable, grouping_variable)
        suggestions = self.suggest_statistical_tests(data, target_variable, grouping_variable)
        
        report = "Statistical Analysis Auto-Detection Report\n"
        report += "=" * 50 + "\n\n"
        
        # Data overview
        report += "Data Overview:\n"
        report += f"- Sample size: {characteristics.n_observations}\n"
        report += f"- Data structure: dataframe\n"
        report += f"- Research design: comparative\n"
        
        if characteristics.missing_percentage > 0:
            report += f"- Missing data: {characteristics.missing_percentage:.1f}%\n"
        
        report += "\n"
        
        # Variable information
        if target_variable:
            target_type = characteristics.variable_types.get(target_variable, DataType.NUMERIC_CONTINUOUS)
            report += f"Target variable '{target_variable}': {target_type.value}\n"
        
        if grouping_variable:
            group_type = characteristics.variable_types.get(grouping_variable, DataType.CATEGORICAL)
            report += f"Grouping variable '{grouping_variable}': {group_type.value}\n"
        
        report += "\n"
        
        # Primary recommendations
        if suggestions['primary_recommendations']:
            report += "Recommended Statistical Tests:\n"
            report += "-" * 35 + "\n"
            
            for i, rec in enumerate(suggestions['primary_recommendations'][:3], 1):
                report += f"{i}. {rec['method'].replace('_', ' ').title()}\n"
                report += f"   Confidence: {rec['score']:.2f}\n"
                report += f"   Rationale: {rec['rationale']}\n"
                report += f"   Function: {rec['function_call']}\n\n"
        
        # Assumption warnings
        if suggestions['assumption_violations']:
            report += "Assumption Violations Detected:\n"
            report += "-" * 35 + "\n"
            for violation in suggestions['assumption_violations']:
                report += f"- {violation}\n"
            report += "\n"
        
        # Sample size recommendations
        if suggestions['power_analysis_needed']:
            report += "Sample Size Considerations:\n"
            report += "-" * 30 + "\n"
            report += "Current sample size may be insufficient for adequate statistical power.\n"
            if suggestions['sample_size_recommendations']:
                for test, rec in suggestions['sample_size_recommendations'].items():
                    report += f"- {test}: Recommended minimum n = {rec}\n"
            report += "\n"
        
        # Alternative methods
        if suggestions['secondary_recommendations']:
            report += "Alternative Methods to Consider:\n"
            report += "-" * 35 + "\n"
            for rec in suggestions['secondary_recommendations'][:3]:
                report += f"- {rec['method'].replace('_', ' ').title()}: {rec['rationale']}\n"
        
        return report
    
    # Private helper methods
    def _analyze_data_structure(self, data: Union[pd.DataFrame, pd.Series, Dict]) -> Dict[str, Any]:
        """Analyze the structure of the input data."""
        if isinstance(data, pd.DataFrame):
            return {
                'structure_type': 'dataframe',
                'n_variables': len(data.columns),
                'n_observations': len(data),
                'variables': list(data.columns)
            }
        elif isinstance(data, pd.Series):
            return {
                'structure_type': 'series',
                'n_variables': 1,
                'n_observations': len(data),
                'variables': [data.name or 'unnamed']
            }
        elif isinstance(data, dict):
            return {
                'structure_type': 'dictionary',
                'n_variables': len(data),
                'n_observations': len(next(iter(data.values()))) if data else 0,
                'variables': list(data.keys())
            }
        else:
            return {'structure_type': 'unknown'}
    
    def _analyze_variable_types(self, data: Union[pd.DataFrame, pd.Series, Dict]) -> Dict[str, str]:
        """Determine the type of each variable."""
        variable_types = {}
        
        if isinstance(data, pd.DataFrame):
            for col in data.columns:
                variable_types[col] = self._classify_variable_type(data[col])
        elif isinstance(data, pd.Series):
            variable_types[data.name or 'variable'] = self._classify_variable_type(data)
        elif isinstance(data, dict):
            for key, values in data.items():
                if isinstance(values, (list, np.ndarray, pd.Series)):
                    variable_types[key] = self._classify_variable_type(pd.Series(values))
        
        return variable_types
    
    def _classify_variable_type(self, series: pd.Series) -> str:
        """Classify a single variable's type."""
        # Remove missing values for analysis
        clean_series = series.dropna()
        
        if len(clean_series) == 0:
            return 'empty'
        
        # Check if binary
        unique_vals = clean_series.unique()
        if len(unique_vals) == 2:
            return 'binary'
        
        # Check if numeric
        if pd.api.types.is_numeric_dtype(clean_series):
            # Check if integers that might be categorical
            if clean_series.dtype in ['int64', 'int32'] and len(unique_vals) <= 10:
                return 'ordinal'
            else:
                # Check for continuous vs discrete
                if len(unique_vals) > 20 or any(val != int(val) for val in clean_series if pd.notnull(val)):
                    return 'continuous'
                else:
                    return 'discrete'
        
        # Check if categorical
        elif len(unique_vals) <= 20:
            return 'categorical'
        else:
            return 'text'
    
    def _analyze_sample_characteristics(self, data: Union[pd.DataFrame, pd.Series, Dict]) -> Dict[str, Any]:
        """Analyze sample size and distribution characteristics."""
        if isinstance(data, pd.DataFrame):
            total_n = len(data)
            complete_cases = len(data.dropna())
        elif isinstance(data, pd.Series):
            total_n = len(data)
            complete_cases = len(data.dropna())
        elif isinstance(data, dict):
            total_n = len(next(iter(data.values()))) if data else 0
            complete_cases = total_n  # Assuming dict data is clean
        else:
            total_n = complete_cases = 0
        
        return {
            'total_n': total_n,
            'complete_cases': complete_cases,
            'sample_size_category': self._categorize_sample_size(total_n)
        }
    
    def _analyze_missing_data(self, data: Union[pd.DataFrame, pd.Series, Dict]) -> Dict[str, Any]:
        """Analyze missing data patterns."""
        if isinstance(data, pd.DataFrame):
            total_cells = data.size
            missing_cells = data.isnull().sum().sum()
        elif isinstance(data, pd.Series):
            total_cells = len(data)
            missing_cells = data.isnull().sum()
        else:
            total_cells = missing_cells = 0
        
        missing_percentage = (missing_cells / total_cells * 100) if total_cells > 0 else 0
        
        return {
            'total_missing': missing_cells,
            'missing_percentage': missing_percentage,
            'missing_level': 'high' if missing_percentage > 20 else 'moderate' if missing_percentage > 5 else 'low'
        }
    
    def _infer_research_design(self, data: Union[pd.DataFrame, pd.Series, Dict],
                             target_variable: Optional[str],
                             grouping_variable: Optional[str]) -> Dict[str, Any]:
        """Infer the research design from data structure."""
        if isinstance(data, pd.Series) or (isinstance(data, dict) and len(data) == 1):
            return {'design_type': 'single_variable', 'comparison_type': 'descriptive'}
        
        if target_variable and grouping_variable:
            if isinstance(data, pd.DataFrame) and grouping_variable in data.columns:
                n_groups = data[grouping_variable].nunique()
                return {
                    'design_type': 'comparative',
                    'comparison_type': 'between_groups' if n_groups > 1 else 'single_group',
                    'n_groups': n_groups
                }
        
        if isinstance(data, pd.DataFrame) and len(data.columns) >= 2:
            return {'design_type': 'correlational', 'comparison_type': 'association'}
        
        return {'design_type': 'unknown', 'comparison_type': 'unknown'}
    
    def _check_assumptions(self, data: Union[pd.DataFrame, pd.Series, Dict],
                          target_variable: Optional[str],
                          grouping_variable: Optional[str]) -> Dict[str, Any]:
        """Check statistical assumptions for common tests."""
        assumptions = {}
        
        if isinstance(data, pd.DataFrame) and target_variable in data.columns:
            target_data = data[target_variable].dropna()
            
            # Test normality
            if len(target_data) >= 3 and pd.api.types.is_numeric_dtype(target_data):
                normality = test_normality(target_data)
                assumptions['normality'] = normality
            
            # Test for groups if grouping variable exists
            if grouping_variable and grouping_variable in data.columns:
                groups = data.groupby(grouping_variable)[target_variable].apply(lambda x: x.dropna())
                
                if len(groups) == 2:
                    group_list = [group for _, group in groups]
                    if all(len(g) >= 2 for g in group_list):
                        # Test equal variances
                        equal_var = test_equal_variances(
                            pd.Series(group_list[0]), 
                            pd.Series(group_list[1])
                        )
                        assumptions['equal_variances'] = equal_var
        
        return assumptions
    
    def assess_method_suitability(self, method_name: str, 
                                characteristics: DataCharacteristics,
                                **kwargs) -> AnalysisRecommendation:
        """
        Assess how suitable a method is for the given data using standardized structures.
        """
        requirements = kwargs.get('requirements', {})
        alpha = kwargs.get('alpha', 0.05)
        
        score = 0.0
        rationale_parts = []
        
        # Check sample size
        total_n = characteristics.n_observations
        min_n = requirements.get('min_n', 1)
        
        if total_n >= min_n:
            score += 0.3
            rationale_parts.append(f"adequate sample size (n={total_n})")
        else:
            score -= 0.2
            rationale_parts.append(f"insufficient sample size (n={total_n}, need ≥{min_n})")
        
        # Check data types compatibility
        required_types = requirements.get('data_types', [])
        compatible_vars = self._count_compatible_variables(characteristics, required_types)
        
        if compatible_vars > 0 or 'any' in required_types:
            score += 0.3
            rationale_parts.append("compatible data types")
        else:
            score -= 0.3
            rationale_parts.append("incompatible data types")
        
        # Check assumptions (simplified for now)
        required_assumptions = requirements.get('assumptions', [])
        if not required_assumptions:  # No assumptions required
            score += 0.4
            rationale_parts.append("no assumptions required")
        else:
            # For now, assume moderate assumption satisfaction
            score += 0.2
            rationale_parts.append("some assumptions may need verification")
        
        # Normalize score
        score = max(0, min(1, score))
        
        # Create recommendation
        recommendation = AnalysisRecommendation(
            method=method_name,
            score=score,
            confidence=AnalysisConfidence.HIGH,  # Will be set by __post_init__
            rationale='; '.join(rationale_parts),
            estimated_time=self._estimate_execution_time(method_name, total_n),
            function_call=self._generate_function_call(method_name),
            parameters=self._get_suggested_parameters(method_name, characteristics, alpha)
        )
        
        return recommendation
    
    def _count_compatible_variables(self, characteristics: DataCharacteristics, required_types: List[str]) -> int:
        """Count variables compatible with required types."""
        if 'any' in required_types:
            return characteristics.n_variables
        
        compatible_count = 0
        for var_type in characteristics.variable_types.values():
            if str(var_type.value) in required_types:
                compatible_count += 1
            elif 'continuous' in required_types and var_type in [DataType.NUMERIC_CONTINUOUS]:
                compatible_count += 1
            elif 'categorical' in required_types and var_type in [DataType.CATEGORICAL, DataType.BINARY]:
                compatible_count += 1
            elif 'ordinal' in required_types and var_type in [DataType.ORDINAL, DataType.NUMERIC_DISCRETE]:
                compatible_count += 1
        
        return compatible_count
    
    def _estimate_execution_time(self, method_name: str, sample_size: int) -> str:
        """Estimate execution time for analysis method."""
        base_times = {
            'one_sample_t_test': 1,
            'two_sample_t_test': 1,
            'paired_t_test': 1,
            'welch_t_test': 1,
            'mann_whitney_u': 2,
            'wilcoxon_signed_rank': 2,
            'one_way_anova': 3,
            'kruskal_wallis': 3,
            'chi_square_independence': 2,
            'chi_square_goodness_of_fit': 2,
            'fisher_exact': 5,
            'correlation_test': 2,
            'linear_regression': 5,
            'logistic_regression': 10,
            'bootstrap_test': 15
        }
        
        base_time = base_times.get(method_name, 3)
        
        # Adjust for data size
        if sample_size > 10000:
            base_time *= 3
        elif sample_size > 1000:
            base_time *= 2
        
        if base_time < 5:
            return "< 5 seconds"
        elif base_time < 30:
            return "< 30 seconds"
        elif base_time < 60:
            return "< 1 minute"
        else:
            return "1-5 minutes"
    
    def _generate_function_call(self, method_name: str) -> str:
        """Generate appropriate function call for the method."""
        function_map = {
            'one_sample_t_test': 'perform_t_test(data, mu=0)',
            'two_sample_t_test': 'perform_t_test(group1, group2, equal_var=True)',
            'paired_t_test': 'perform_paired_t_test(before, after)',
            'welch_t_test': 'perform_welch_t_test(group1, group2)',
            'mann_whitney_u': 'mann_whitney_u_test(group1, group2)',
            'wilcoxon_signed_rank': 'wilcoxon_signed_rank_test(before, after)',
            'one_way_anova': 'perform_anova(data, group_col, value_col)',
            'kruskal_wallis': 'kruskal_wallis_test(data, group_col, value_col)',
            'chi_square_independence': 'perform_chi_square_test(crosstab)',
            'correlation_test': 'perform_correlation_test(data, x_col, y_col)',
            'linear_regression': 'perform_linear_regression(data, target, predictors)',
            'logistic_regression': 'perform_logistic_regression(data, target, predictors)',
            'bootstrap_test': 'bootstrap_hypothesis_test(data1, data2)'
        }
        
        return function_map.get(method_name, f'{method_name}(...)')
    
    def _get_suggested_parameters(self, method_name: str, characteristics: DataCharacteristics, alpha: float) -> Dict[str, Any]:
        """Get suggested parameters for a specific method."""
        base_params = {'alpha': alpha}
        
        if method_name in ['two_sample_t_test', 'welch_t_test']:
            # For now, default to equal variances unless we detect otherwise
            base_params['equal_var'] = True  # Could be improved with actual variance testing
        
        elif method_name == 'correlation_test':
            # Default to pearson, could be improved with normality testing
            base_params['method'] = 'pearson'
        
        elif method_name == 'one_way_anova':
            base_params['post_hoc'] = True
        
        elif method_name == 'bootstrap_test':
            sample_size = characteristics.n_observations
            n_bootstrap = min(10000, max(1000, sample_size * 100))
            base_params.update({
                'n_bootstrap': n_bootstrap,
                'method': 'percentile',
                'random_state': 42
            })
        
        return base_params
    
    def _categorize_sample_size(self, n: int) -> str:
        """Categorize sample size."""
        if n < 10:
            return 'very_small'
        elif n < 30:
            return 'small'
        elif n < 100:
            return 'medium'
        else:
            return 'large'
    
    def _get_sample_size_recommendations(self, characteristics: Dict[str, Any], 
                                       recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get sample size recommendations for adequate power."""
        current_n = characteristics['sample_characteristics']['total_n']
        
        recommendations_dict = {}
        for rec in recommendations[:2]:  # Top 2 recommendations
            method = rec['method']
            if 't_test' in method:
                recommended_n = max(30, current_n * 1.5)
            elif 'anova' in method:
                recommended_n = max(60, current_n * 2)
            elif 'regression' in method:
                recommended_n = max(100, current_n * 3)
            else:
                recommended_n = max(50, current_n * 2)
            
            recommendations_dict[method] = int(recommended_n)
        
        return recommendations_dict
    
    def _identify_assumption_violations(self, characteristics: Dict[str, Any]) -> List[str]:
        """Identify violated statistical assumptions."""
        violations = []
        assumptions = characteristics['statistical_assumptions']
        
        if 'normality' in assumptions and not assumptions['normality'].get('assumption_met', True):
            violations.append("Normality assumption violated - consider non-parametric tests")
        
        if 'equal_variances' in assumptions and not assumptions['equal_variances'].get('assumption_met', True):
            violations.append("Equal variances assumption violated - consider Welch's t-test")
        
        missing_level = characteristics['missing_data']['missing_level']
        if missing_level in ['moderate', 'high']:
            violations.append(f"Missing data concern ({missing_level} level) - consider imputation or robust methods")
        
        sample_size = characteristics['sample_characteristics']['sample_size_category']
        if sample_size in ['very_small', 'small']:
            violations.append(f"Small sample size - consider bootstrap methods or exact tests")
        
        return violations
    
    # Configuration methods for specific tests
    def _configure_one_sample_t_test(self, characteristics, data, target_variable, grouping_variable):
        """Configure one-sample t-test parameters."""
        return {
            'test_type': 'one_sample_t_test',
            'alpha': 0.05,
            'alternative': 'two-sided',
            'mu': 0,  # Test value
            'confidence_level': 0.95
        }
    
    def _configure_two_sample_t_test(self, characteristics, data, target_variable, grouping_variable):
        """Configure two-sample t-test parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'n_observations'):  # New format
            equal_var = True  # Default assumption for now
        else:  # Old dict format
            equal_var = characteristics.get('statistical_assumptions', {}).get('equal_variances', {}).get('assumption_met', True)
        
        return {
            'test_type': 'two_sample_t_test',
            'alpha': 0.05,
            'equal_var': equal_var,
            'alternative': 'two-sided',
            'confidence_level': 0.95
        }
    
    def _configure_paired_t_test(self, characteristics, data, target_variable, grouping_variable):
        """Configure paired t-test parameters."""
        return {
            'test_type': 'paired_t_test',
            'alpha': 0.05,
            'alternative': 'two-sided',
            'confidence_level': 0.95
        }
    
    def _configure_welch_t_test(self, characteristics, data, target_variable, grouping_variable):
        """Configure Welch's t-test parameters."""
        return {
            'test_type': 'welch_t_test',
            'alpha': 0.05,
            'alternative': 'two-sided',
            'equal_var': False,
            'confidence_level': 0.95
        }
    
    def _configure_mann_whitney(self, characteristics, data, target_variable, grouping_variable):
        """Configure Mann-Whitney U test parameters."""
        return {
            'test_type': 'mann_whitney_u',
            'alpha': 0.05,
            'alternative': 'two-sided',
            'use_continuity': True
        }
    
    def _configure_wilcoxon(self, characteristics, data, target_variable, grouping_variable):
        """Configure Wilcoxon signed-rank test parameters."""
        return {
            'test_type': 'wilcoxon_signed_rank',
            'alpha': 0.05,
            'alternative': 'two-sided',
            'mode': 'auto'
        }
    
    def _configure_anova(self, characteristics, data, target_variable, grouping_variable):
        """Configure ANOVA parameters."""
        return {
            'test_type': 'one_way_anova',
            'alpha': 0.05,
            'post_hoc': True,
            'multiple_comparisons': 'tukey'
        }
    
    def _configure_kruskal_wallis(self, characteristics, data, target_variable, grouping_variable):
        """Configure Kruskal-Wallis test parameters."""
        return {
            'test_type': 'kruskal_wallis',
            'alpha': 0.05,
            'post_hoc': True
        }
    
    def _configure_chi_square(self, characteristics, data, target_variable, grouping_variable):
        """Configure chi-square test parameters."""
        return {
            'test_type': 'chi_square',
            'alpha': 0.05,
            'correction': True
        }
    
    def _configure_correlation(self, characteristics, data, target_variable, grouping_variable):
        """Configure correlation test parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'n_observations'):  # New format
            normality_met = True  # Default assumption for now
        else:  # Old dict format
            normality_met = characteristics.get('statistical_assumptions', {}).get('normality', {}).get('assumption_met', True)
        
        return {
            'test_type': 'correlation',
            'method': 'pearson' if normality_met else 'spearman',
            'alpha': 0.05,
            'confidence_level': 0.95
        }
    
    def _configure_linear_regression(self, characteristics, data, target_variable, grouping_variable):
        """Configure linear regression parameters."""
        return {
            'test_type': 'linear_regression',
            'include_intercept': True,
            'alpha': 0.05,
            'diagnostics': True,
            'confidence_level': 0.95
        }
    
    def _configure_logistic_regression(self, characteristics, data, target_variable, grouping_variable):
        """Configure logistic regression parameters."""
        return {
            'test_type': 'logistic_regression',
            'alpha': 0.05,
            'confidence_level': 0.95,
            'max_iter': 1000
        }
    
    def _configure_bootstrap_test(self, characteristics, data, target_variable, grouping_variable):
        """Configure bootstrap test parameters."""
        # Handle both old dict format and new DataCharacteristics format
        if hasattr(characteristics, 'n_observations'):  # New format
            sample_size = characteristics.n_observations
        else:  # Old dict format
            sample_size = characteristics.get('sample_characteristics', {}).get('total_n', 100)
        
        n_bootstrap = min(10000, max(1000, sample_size * 100))
        
        return {
            'test_type': 'bootstrap',
            'n_bootstrap': n_bootstrap,
            'alpha': 0.05,
            'method': 'percentile',
            'random_state': 42
        }

# Factory function for easy usage
def auto_detect_statistical_tests(data: Union[pd.DataFrame, pd.Series, Dict],
                                target_variable: Optional[str] = None,
                                grouping_variable: Optional[str] = None,
                                research_question: Optional[str] = None,
                                alpha: float = 0.05) -> Dict[str, Any]:
    """
    Automatically detect appropriate statistical tests for the given data.
    
    Args:
        data: Input data
        target_variable: Dependent variable name
        grouping_variable: Independent/grouping variable name
        research_question: Type of research question
        alpha: Significance level
        
    Returns:
        Dictionary with comprehensive analysis and recommendations
    """
    detector = InferentialAutoDetector()
    
    # Get data characteristics
    characteristics = detector.detect_data_characteristics(data, target_variable, grouping_variable)
    
    # Get test suggestions
    suggestions = detector.suggest_statistical_tests(data, target_variable, grouping_variable, research_question, alpha)
    
    # Generate report
    report = detector.generate_analysis_report(data, target_variable, grouping_variable)
    
    return {
        'data_characteristics': characteristics,
        'test_suggestions': suggestions,
        'analysis_report': report,
        'auto_configuration': detector.auto_configure_test(
            suggestions['primary_recommendations'][0]['method'] if suggestions['primary_recommendations'] else 'bootstrap_test',
            data, target_variable, grouping_variable
        ) if suggestions['primary_recommendations'] else {}
    }

def quick_test_suggestion(data1: pd.Series, data2: Optional[pd.Series] = None,
                         paired: bool = False) -> str:
    """
    Quick suggestion for the most appropriate test given one or two samples.
    
    Args:
        data1: First sample
        data2: Second sample (optional)
        paired: Whether samples are paired
        
    Returns:
        String with test recommendation
    """
    n1 = len(data1.dropna())
    
    if data2 is None:
        # One sample
        if n1 < 10:
            return "bootstrap_hypothesis_test (small sample)"
        else:
            normality = test_normality(data1.dropna())
            if normality['assumption_met']:
                return "perform_t_test (one-sample)"
            else:
                return "wilcoxon_signed_rank_test"
    
    else:
        # Two samples
        n2 = len(data2.dropna())
        
        if paired:
            if min(n1, n2) < 10:
                return "bootstrap_hypothesis_test (small paired sample)"
            else:
                differences = data1 - data2
                normality = test_normality(differences.dropna())
                if normality['assumption_met']:
                    return "perform_paired_t_test"
                else:
                    return "wilcoxon_signed_rank_test"
        
        else:
            if min(n1, n2) < 10:
                return "mann_whitney_u_test (small sample)"
            else:
                # Check assumptions
                norm1 = test_normality(data1.dropna())
                norm2 = test_normality(data2.dropna())
                
                if norm1['assumption_met'] and norm2['assumption_met']:
                    equal_var = test_equal_variances(data1.dropna(), data2.dropna())
                    if equal_var['assumption_met']:
                        return "perform_t_test (equal variances)"
                    else:
                        return "perform_welch_t_test (unequal variances)"
                else:
                    return "mann_whitney_u_test (non-parametric)" 