# Inferential Statistics with Auto-Detection

A comprehensive inferential statistics package with intelligent auto-detection of appropriate statistical tests and methods. Designed specifically for research data analysis with support for offline environments and limited connectivity scenarios.

## Features

- **🤖 Intelligent Auto-Detection**: Automatically suggests appropriate statistical tests based on data characteristics
- **📊 Comprehensive Test Suite**: Complete collection of parametric and non-parametric tests
- **🔍 Assumption Testing**: Automatic validation of statistical assumptions with recommendations
- **📈 Power Analysis**: Sample size calculations and post-hoc power analysis
- **🎯 Effect Size Calculations**: Complete range of effect size measures with interpretations
- **🔄 Bootstrap Methods**: Robust statistical inference for small samples or violated assumptions
- **📋 Bayesian Inference**: Modern Bayesian statistical methods
- **📊 Regression Analysis**: Linear, logistic, and robust regression methods
- **⏰ Time Series Analysis**: Specialized tests for time series data
- **📝 Human-Readable Reports**: Automated generation of analysis reports

## Quick Start

### Basic Auto-Detection

```python
from analytics.inferential import auto_detect_statistical_tests
import pandas as pd

# Load your data
data = pd.read_csv('research_data.csv')

# Automatically detect and recommend tests
results = auto_detect_statistical_tests(
    data=data,
    target_variable='outcome_score',
    grouping_variable='treatment_group'
)

# View recommendations
print(results['analysis_report'])
```

### Quick Test Comparison

```python
from analytics.inferential import quick_test_suggestion
import pandas as pd

# Compare two groups
group1 = data[data['group'] == 'A']['score']
group2 = data[data['group'] == 'B']['score']

# Get instant recommendation
recommended_test = quick_test_suggestion(group1, group2)
print(f"Recommended test: {recommended_test}")
```

### Complete Analysis Workflow

```python
from analytics.inferential import analyze_inferential_data

# Comprehensive analysis with auto-detection
results = analyze_inferential_data(
    data=data,
    target_variable='outcome',
    grouping_variable='condition',
    analysis_type='auto'
)

# Access detailed results
characteristics = results['data_characteristics']
suggestions = results['test_suggestions']
report = results['analysis_report']
```

## Supported Statistical Tests

### Parametric Tests
- **T-Tests**: One-sample, independent samples, paired samples, Welch's t-test
- **ANOVA**: One-way, two-way, repeated measures, mixed ANOVA
- **Correlation**: Pearson, partial correlation
- **Regression**: Linear, multiple, logistic, Poisson, ridge, lasso

### Non-Parametric Tests
- **Mann-Whitney U Test**: Non-parametric alternative to independent t-test
- **Wilcoxon Signed-Rank Test**: Non-parametric alternative to paired t-test
- **Kruskal-Wallis Test**: Non-parametric alternative to one-way ANOVA
- **Friedman Test**: Non-parametric alternative to repeated measures ANOVA
- **Chi-Square Tests**: Independence and goodness of fit
- **Fisher's Exact Test**: For small sample categorical data

### Bootstrap Methods
- **Bootstrap Confidence Intervals**: For any statistic
- **Permutation Tests**: Distribution-free hypothesis testing
- **Bootstrap Hypothesis Tests**: Robust alternatives when assumptions are violated

### Bayesian Methods
- **Bayesian T-Tests**: With Bayes factors
- **Bayesian Proportion Tests**: For categorical outcomes
- **Credible Intervals**: Bayesian confidence intervals

## Auto-Detection System

### How It Works

The auto-detection system analyzes your data across multiple dimensions:

1. **Data Structure Analysis**
   - Sample size and completeness
   - Variable types (continuous, categorical, binary, ordinal)
   - Missing data patterns
   - Research design inference

2. **Statistical Assumptions Testing**
   - Normality (Shapiro-Wilk, Anderson-Darling)
   - Equal variances (Levene's test)
   - Independence (Runs test)
   - Linearity and homoscedasticity

3. **Method Suitability Scoring**
   - Compatibility with data types
   - Sample size adequacy
   - Assumption violations
   - Research question alignment

4. **Recommendation Generation**
   - Primary recommendations (>80% suitability)
   - Secondary alternatives (>50% suitability)
   - Parameter optimization
   - Function call generation

### Example Output

```python
detector = InferentialAutoDetector()
suggestions = detector.suggest_statistical_tests(data, 'outcome', 'group')

# Output structure:
{
    'primary_recommendations': [
        {
            'method': 'two_sample_t_test',
            'score': 0.85,
            'rationale': 'adequate sample size; compatible data types; assumptions satisfied',
            'function_call': 'perform_t_test(group1, group2, equal_var=True)',
            'parameters': {'alpha': 0.05, 'equal_var': True}
        }
    ],
    'secondary_recommendations': [...],
    'assumption_violations': [...],
    'power_analysis_needed': False
}
```

## Usage Examples

### Example 1: Comparing Treatment Groups

```python
import pandas as pd
from analytics.inferential import analyze_inferential_data

# Clinical trial data
data = pd.DataFrame({
    'patient_id': range(100),
    'treatment': ['A'] * 50 + ['B'] * 50,
    'outcome_score': np.random.normal(10, 2, 50).tolist() + 
                     np.random.normal(12, 2, 50).tolist(),
    'age': np.random.normal(45, 10, 100),
    'gender': np.random.choice(['M', 'F'], 100)
})

# Auto-detect appropriate analysis
results = analyze_inferential_data(
    data=data,
    target_variable='outcome_score',
    grouping_variable='treatment'
)

print(results['analysis_report'])
```

### Example 2: Correlation Analysis

```python
# Examine relationship between variables
results = analyze_inferential_data(
    data=data,
    analysis_type='correlation'
)

# Or specify variables
from analytics.inferential import perform_correlation_test

correlation_result = perform_correlation_test(
    data=data,
    x_column='age',
    y_column='outcome_score',
    method='pearson'
)
```

### Example 3: Multiple Group Comparison

```python
# Multi-group data
data = pd.DataFrame({
    'group': np.repeat(['A', 'B', 'C', 'D'], 25),
    'score': np.concatenate([
        np.random.normal(10, 2, 25),  # Group A
        np.random.normal(12, 2, 25),  # Group B  
        np.random.normal(14, 2, 25),  # Group C
        np.random.normal(11, 2, 25)   # Group D
    ])
})

# Auto-detection will suggest ANOVA
results = analyze_inferential_data(
    data=data,
    target_variable='score',
    grouping_variable='group'
)

# Manual ANOVA with post-hoc tests
from analytics.inferential import perform_anova

anova_results = perform_anova(
    data=data,
    group_column='group',
    value_column='score',
    post_hoc=True
)
```

### Example 4: Regression Analysis

```python
# Prediction modeling
from analytics.inferential import perform_multiple_regression

regression_results = perform_multiple_regression(
    data=data,
    dependent_var='outcome_score',
    independent_vars=['age', 'treatment_numeric'],
    interaction_terms=[('age', 'treatment_numeric')],
    alpha=0.05
)

print(f"R-squared: {regression_results['r_squared']:.3f}")
print(f"Model significant: {regression_results['model_significance']}")
```

### Example 5: Non-Parametric Analysis

```python
# When assumptions are violated
from analytics.inferential import mann_whitney_u_test, kruskal_wallis_test

# Two group comparison (non-parametric)
group1 = data[data['treatment'] == 'A']['outcome_score']
group2 = data[data['treatment'] == 'B']['outcome_score']

mann_whitney_result = mann_whitney_u_test(
    data1=group1,
    data2=group2,
    alternative='two-sided'
)

# Multiple group comparison (non-parametric)
kw_result = kruskal_wallis_test(
    data=data,
    group_column='group',
    value_column='score'
)
```

### Example 6: Power Analysis

```python
from analytics.inferential import (
    calculate_sample_size_t_test,
    calculate_power_t_test,
    post_hoc_power_analysis
)

# Sample size calculation
sample_size = calculate_sample_size_t_test(
    effect_size=0.5,  # Medium effect
    alpha=0.05,
    power=0.80,
    test_type='two-sample'
)

# Power analysis for existing study
power_result = post_hoc_power_analysis(
    observed_effect=0.3,
    n=(25, 25),  # Sample sizes
    alpha=0.05,
    test_type='two-sample'
)
```

### Example 7: Bootstrap Methods

```python
from analytics.inferential import bootstrap_hypothesis_test, bootstrap_mean

# Bootstrap hypothesis test (robust to violations)
bootstrap_result = bootstrap_hypothesis_test(
    data1=group1,
    data2=group2,
    statistic='mean',
    n_bootstrap=10000
)

# Bootstrap confidence interval for mean
bootstrap_ci = bootstrap_mean(
    data=group1,
    n_bootstrap=10000,
    confidence_level=0.95
)
```

## Advanced Features

### Custom Test Configuration

```python
from analytics.inferential import InferentialAutoDetector

detector = InferentialAutoDetector()

# Get optimized configuration for specific test
config = detector.auto_configure_test(
    method_name='two_sample_t_test',
    data=data,
    target_variable='outcome',
    grouping_variable='group'
)

print(f"Recommended parameters: {config}")
```

### Analysis Workflow Generation

```python
from analytics.inferential import generate_analysis_workflow

# Get step-by-step analysis workflow
workflow = generate_analysis_workflow(
    data=data,
    target_variable='outcome',
    grouping_variable='treatment'
)

# Execute workflow steps
for step_name, step_info in workflow.items():
    print(f"{step_name}: {step_info['description']}")
```

### Assumption Testing

```python
from analytics.inferential import auto_test_assumptions

# Comprehensive assumption testing
assumptions = auto_test_assumptions(
    data=data,
    target_variable='outcome',
    grouping_variable='group'
)

# Check specific assumptions
if 'normality' in assumptions:
    print(f"Normality test p-value: {assumptions['normality']['p_value']}")
if 'equal_variances' in assumptions:
    print(f"Equal variances: {assumptions['equal_variances']['assumption_met']}")
```

## Integration with Research Workflow

### For Field Research

```python
# Offline-first design - no internet required
from analytics.inferential import analyze_inferential_data

# Analyze data collected on tablets in the field
field_data = pd.read_csv('field_collection.csv')

# Get immediate statistical insights
results = analyze_inferential_data(
    data=field_data,
    target_variable='measurement',
    grouping_variable='site',
    analysis_type='auto'
)

# Generate report for stakeholders
report = results['analysis_report']
with open('field_analysis_report.txt', 'w') as f:
    f.write(report)
```

### Academic Research Pipeline

```python
# Complete research analysis pipeline
def research_analysis_pipeline(data, research_questions):
    results = {}
    
    for question_id, question in research_questions.items():
        # Auto-detect appropriate analysis
        analysis = analyze_inferential_data(
            data=data,
            target_variable=question['dependent_var'],
            grouping_variable=question.get('independent_var'),
            analysis_type='auto'
        )
        
        results[question_id] = {
            'research_question': question['text'],
            'analysis': analysis,
            'recommendations': analysis['test_suggestions']['primary_recommendations'],
            'effect_sizes': analysis.get('effect_sizes', {}),
            'power_analysis': analysis['test_suggestions'].get('power_analysis_needed', False)
        }
    
    return results

# Define research questions
questions = {
    'rq1': {
        'text': 'Does treatment A differ from treatment B in outcome scores?',
        'dependent_var': 'outcome_score',
        'independent_var': 'treatment_group'
    },
    'rq2': {
        'text': 'Is there a relationship between age and outcome scores?',
        'dependent_var': 'outcome_score',
        'independent_var': 'age'
    }
}

# Run complete analysis
research_results = research_analysis_pipeline(data, questions)
```

## Performance Considerations

### Memory Optimization

- Efficient handling of large datasets through chunked processing
- Memory-aware bootstrap sampling
- Optimized assumption testing for large samples

### Computational Efficiency

- Vectorized operations using NumPy and pandas
- Parallel processing for bootstrap methods
- Smart sampling for computationally intensive tests

### Mobile/Tablet Optimization

- Reduced memory footprint for mobile devices
- Battery-efficient algorithms
- Offline-first architecture with no external dependencies

## Error Handling and Validation

The package includes comprehensive error handling:

```python
# Automatic data validation
results = analyze_inferential_data(data_with_issues)

if 'error' in results:
    print(f"Data issue detected: {results['error']}")
    print("Suggestions:", results.get('suggestions', []))
else:
    # Proceed with analysis
    pass
```

## Troubleshooting

### Common Issues

1. **Small Sample Sizes**
   - Package automatically suggests bootstrap methods
   - Provides sample size recommendations
   - Warns about power limitations

2. **Assumption Violations**
   - Automatic detection of violations
   - Suggests appropriate alternatives
   - Provides robust methods

3. **Missing Data**
   - Handles missing data gracefully
   - Provides missing data summaries
   - Suggests handling strategies

### Getting Help

```python
# Generate diagnostic report
from analytics.inferential import InferentialAutoDetector

detector = InferentialAutoDetector()
report = detector.generate_analysis_report(data)
print(report)  # Comprehensive diagnostic information
```

## API Reference

### Main Functions

- `auto_detect_statistical_tests()`: Main auto-detection function
- `analyze_inferential_data()`: Comprehensive analysis with auto-detection
- `quick_test_suggestion()`: Quick test recommendation
- `InferentialAutoDetector()`: Main auto-detection class

### Test Categories

- **Parametric Tests**: `perform_t_test()`, `perform_anova()`, `perform_correlation_test()`
- **Non-Parametric Tests**: `mann_whitney_u_test()`, `kruskal_wallis_test()`, `wilcoxon_signed_rank_test()`
- **Regression**: `perform_linear_regression()`, `perform_logistic_regression()`
- **Bootstrap**: `bootstrap_hypothesis_test()`, `bootstrap_mean()`
- **Bayesian**: `bayesian_t_test()`, `calculate_bayes_factor()`

### Utility Functions

- `test_normality()`, `test_equal_variances()`: Assumption testing
- `calculate_cohens_d()`, `calculate_eta_squared()`: Effect sizes
- `calculate_sample_size_t_test()`, `calculate_power_t_test()`: Power analysis

## Contributing

This package is designed for research environments with limited connectivity. Contributions should maintain:

1. **Offline-first design** - No internet dependencies
2. **Memory efficiency** - Suitable for mobile devices
3. **Comprehensive error handling** - Graceful degradation
4. **Human-readable output** - Clear interpretations

## License

MIT License - see LICENSE file for details.

## Citation

When using this package in research, please cite:

```
Research Data Analytics Package with Inferential Statistics Auto-Detection
Version 1.0, 2024
``` 