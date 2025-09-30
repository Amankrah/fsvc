# Descriptive Statistics with Auto-Detection

A comprehensive descriptive statistics package with intelligent auto-detection of appropriate analyses based on data characteristics. Designed for research data analysis with support for offline environments.

## Features

- **🤖 Intelligent Auto-Detection**: Automatically suggests appropriate descriptive analyses based on data characteristics
- **📊 Comprehensive Analysis Suite**: Complete collection of descriptive statistical methods
- **🔍 Data Quality Assessment**: Automatic validation of data quality with recommendations
- **📈 Multi-Variable Analysis**: Support for univariate, bivariate, and multivariate analyses
- **🎯 Smart Configuration**: Automatic parameter optimization for each analysis method
- **📋 Flexible Input**: Support for pandas DataFrames with optional metadata
- **📝 Human-Readable Reports**: Automated generation of analysis reports
- **⚡ Performance Optimized**: Efficient algorithms suitable for large datasets

## Quick Start

### Basic Auto-Detection

```python
from analytics.descriptive import auto_analyze_descriptive_data
import pandas as pd

# Load your data
data = pd.read_csv('research_data.csv')

# Automatically detect and perform analyses
results = auto_analyze_descriptive_data(data)

# View recommendations and results
print(results['analysis_report'])
```

### Quick Analysis Overview

```python
from analytics.descriptive import quick_data_overview

# Get instant data overview
overview = quick_data_overview(data)
print(f"Recommended approach: {overview}")
```

### Targeted Analysis

```python
from analytics.descriptive import analyze_descriptive_data

# Basic analysis
basic_results = analyze_descriptive_data(data, analysis_type="basic")

# Comprehensive analysis
comprehensive_results = analyze_descriptive_data(data, analysis_type="comprehensive")

# Quality-focused analysis
quality_results = analyze_descriptive_data(data, analysis_type="quality")
```

## Supported Analyses

### Basic Statistics
- **Summary Statistics**: Mean, median, mode, standard deviation, variance
- **Percentiles**: Quartiles, custom percentiles, robust statistics
- **Grouped Statistics**: Summary statistics by categorical variables
- **Weighted Statistics**: When survey weights are present

### Distribution Analysis
- **Normality Testing**: Shapiro-Wilk, Anderson-Darling tests
- **Distribution Fitting**: Automatic fitting of common distributions
- **Shape Analysis**: Skewness, kurtosis, distribution characteristics
- **Visualization Recommendations**: Appropriate plots for data types

### Categorical Analysis
- **Frequency Analysis**: Counts, percentages, mode identification
- **Cross-Tabulation**: Contingency tables with chi-square tests
- **Association Measures**: Cramer's V, phi coefficient
- **Category Optimization**: Handling of rare categories

### Relationship Analysis
- **Correlation Analysis**: Pearson, Spearman correlation matrices
- **Covariance Analysis**: Detailed covariance structure
- **Partial Correlations**: Controlling for confounding variables
- **Significance Testing**: Statistical significance of relationships

### Data Quality Analysis
- **Missing Data Patterns**: Comprehensive missing data analysis
- **Outlier Detection**: Multiple detection methods (IQR, Z-score, Isolation Forest)
- **Data Completeness**: Assessment of data coverage and quality
- **Consistency Checks**: Logical consistency validation

### Specialized Analyses
- **Temporal Analysis**: Time series patterns, seasonality detection
- **Geospatial Analysis**: Spatial patterns, coordinate validation
- **Grouped Comparisons**: Statistical comparison across groups
- **Survey-Specific**: Response quality, completion patterns

## Auto-Detection System

### How It Works

The auto-detection system analyzes your data across multiple dimensions:

1. **Data Structure Analysis**
   - Sample size and variable count
   - Variable types (numeric, categorical, datetime, geographic)
   - Data quality metrics
   - Memory usage and performance considerations

2. **Variable Type Classification**
   - Continuous vs discrete numeric variables
   - Binary vs multi-category categorical variables
   - Date/time variable detection
   - Geographic coordinate identification

3. **Analysis Suitability Assessment**
   - Method compatibility with data types
   - Sample size adequacy for each method
   - Data quality requirements
   - Computational feasibility

4. **Smart Recommendations**
   - Primary recommendations (>80% suitability)
   - Secondary alternatives (>50% suitability)  
   - Optional analyses for comprehensive exploration
   - Execution time estimates

### Example Output

```python
detector = DescriptiveAutoDetector()
suggestions = detector.suggest_descriptive_analyses(data)

# Output structure:
{
    'primary_recommendations': [
        {
            'method': 'basic_statistics',
            'score': 0.95,
            'rationale': 'adequate sample size; 5 compatible variables; high data quality',
            'estimated_time': '< 5 seconds',
            'function_calls': ['calculate_basic_stats(data, numeric_columns)']
        }
    ],
    'secondary_recommendations': [...],
    'data_quality_warnings': ['High missing data rate: 15.2%'],
    'analysis_order': ['missing_data_analysis', 'basic_statistics', ...]
}
```

## Usage Examples

### Example 1: Research Dataset Analysis

```python
import pandas as pd
from analytics.descriptive import analyze_descriptive_data

# Research survey data
data = pd.DataFrame({
    'participant_id': range(200),
    'age': np.random.normal(35, 10, 200),
    'gender': np.random.choice(['M', 'F'], 200),
    'score_pre': np.random.normal(50, 15, 200),
    'score_post': np.random.normal(55, 15, 200),
    'treatment_group': np.random.choice(['A', 'B', 'Control'], 200)
})

# Comprehensive auto-analysis
results = analyze_descriptive_data(data, analysis_type="auto")

# Access specific results
basic_stats = results['data_characteristics']['sample_characteristics']
recommendations = results['analysis_suggestions']['primary_recommendations']
report = results['analysis_report']

print(report)
```

### Example 2: Data Quality Assessment

```python
# Focus on data quality
quality_results = analyze_descriptive_data(data, analysis_type="quality")

print("Missing Data Analysis:")
print(quality_results['missing_analysis'])

print("\nOutlier Summary:")
print(quality_results['outlier_summary'])
```

### Example 3: Custom Analysis Goals

```python
from analytics.descriptive import auto_analyze_descriptive_data

# Specify analysis goals
results = auto_analyze_descriptive_data(
    data=data,
    analysis_goals=['overview', 'quality', 'relationships']
)

# Results will be filtered to focus on specified goals
focused_recommendations = results['analysis_suggestions']
```

### Example 4: Individual Analysis Methods

```python
from analytics.descriptive import (
    calculate_basic_stats,
    analyze_distribution,
    calculate_correlation_matrix,
    detect_outliers_iqr
)

# Basic statistics for numeric variables
numeric_cols = data.select_dtypes(include=['number']).columns
basic_stats = calculate_basic_stats(data, numeric_cols.tolist())

# Distribution analysis for a specific variable
age_distribution = analyze_distribution(data['age'])

# Correlation matrix
correlations = calculate_correlation_matrix(data[numeric_cols])

# Outlier detection
outliers = detect_outliers_iqr(data['score_pre'])
```

### Example 5: Survey-Specific Analysis

```python
# Survey data with metadata
variable_metadata = [
    {
        'column_name': 'age',
        'question_text': 'What is your age?',
        'question_type': 'numeric',
        'demographics_category': 'basic_demographics'
    },
    {
        'column_name': 'satisfaction',
        'question_text': 'How satisfied are you with our service?',
        'question_type': 'likert_scale',
        'scale_range': [1, 5]
    }
]

# Analysis with metadata
results = auto_analyze_descriptive_data(
    data=survey_data,
    variable_metadata=variable_metadata
)

# Enhanced analysis using metadata
metadata_insights = results['data_characteristics']['metadata_analysis']
```

### Example 6: Large Dataset Optimization

```python
# For large datasets (>10k rows)
large_data = pd.read_csv('large_dataset.csv')

# Auto-detection optimizes for performance
results = auto_analyze_descriptive_data(large_data)

# Check estimated execution times
time_estimates = results['analysis_suggestions']['primary_recommendations']
for rec in time_estimates:
    print(f"{rec['method']}: {rec['estimated_time']}")
```

### Example 7: Temporal Data Analysis

```python
# Time series data
temporal_data = pd.DataFrame({
    'timestamp': pd.date_range('2023-01-01', periods=365, freq='D'),
    'value': np.random.normal(100, 15, 365),
    'category': np.random.choice(['A', 'B', 'C'], 365)
})

# Auto-detection will identify temporal patterns
results = auto_analyze_descriptive_data(temporal_data)

# Temporal analysis will be automatically recommended
temporal_rec = [r for r in results['analysis_suggestions']['primary_recommendations'] 
                if 'temporal' in r['method']]
```

## Advanced Features

### Custom Configuration

```python
from analytics.descriptive import DescriptiveAutoDetector

detector = DescriptiveAutoDetector()

# Get optimized configuration for specific analysis
config = detector.auto_configure_analysis(
    method_name='correlation_analysis',
    data=data,
    target_variables=['score_pre', 'score_post', 'age']
)

print(f"Recommended configuration: {config}")
```

### Analysis Workflow Generation

```python
from analytics.descriptive import generate_analysis_workflow

# Get step-by-step analysis workflow
workflow = generate_analysis_workflow(
    data=data,
    analysis_goals=['overview', 'relationships']
)

# Execute workflow steps
for step_name, step_info in workflow.items():
    print(f"{step_name}: {step_info['description']} (Priority: {step_info['priority']})")
```

### Data Characteristics Analysis

```python
from analytics.descriptive import get_data_characteristics

# Comprehensive data profiling
characteristics = get_data_characteristics(data)

# Examine data structure
print("Data Structure:")
print(characteristics['data_structure'])

# Examine variable types
print("\nVariable Types:")
for var, vtype in characteristics['variable_types'].items():
    print(f"  {var}: {vtype}")

# Check data quality
print(f"\nData Quality Score: {characteristics['data_quality']['completeness_score']:.1f}%")
```

### Automated Reporting

```python
# Generate comprehensive report
detector = DescriptiveAutoDetector()
report = detector.generate_analysis_report(data)

# Save report to file
with open('data_analysis_report.txt', 'w') as f:
    f.write(report)

# Or get structured results for custom reporting
results = auto_analyze_descriptive_data(data)
# Process results for dashboard, API, etc.
```

## Integration with Research Workflow

### Field Research Support

```python
# Offline-first design for field data collection
field_data = pd.read_csv('field_collection.csv')

# Quick analysis during data collection
quick_overview = quick_data_overview(field_data)
print(f"Field data status: {quick_overview}")

# Comprehensive analysis when connectivity allows
if len(field_data) > 100:  # Sufficient data collected
    comprehensive_results = analyze_descriptive_data(
        field_data, 
        analysis_type="comprehensive"
    )
```

### Academic Research Pipeline

```python
def research_descriptive_pipeline(datasets, research_questions):
    """Complete descriptive analysis pipeline for academic research."""
    results = {}
    
    for dataset_name, data in datasets.items():
        print(f"\nAnalyzing {dataset_name}...")
        
        # Auto-detect optimal analysis strategy
        analysis_results = auto_analyze_descriptive_data(data)
        
        # Extract key findings
        key_findings = {
            'sample_characteristics': analysis_results['data_characteristics']['sample_characteristics'],
            'data_quality': analysis_results['data_characteristics']['data_quality'],
            'primary_analyses': analysis_results['analysis_suggestions']['primary_recommendations'][:3],
            'quality_warnings': analysis_results['analysis_suggestions']['data_quality_warnings']
        }
        
        results[dataset_name] = key_findings
    
    return results

# Execute pipeline
datasets = {
    'pilot_study': pilot_data,
    'main_study': main_data,
    'followup_study': followup_data
}

pipeline_results = research_descriptive_pipeline(datasets, research_questions)
```

## Performance Considerations

### Memory Optimization

- **Efficient Data Types**: Automatic detection and recommendation of optimal data types
- **Chunked Processing**: Large dataset support through intelligent chunking
- **Memory Monitoring**: Built-in memory usage tracking and warnings

### Computational Efficiency

- **Vectorized Operations**: NumPy/pandas optimized calculations
- **Algorithm Selection**: Automatic selection of most efficient algorithms
- **Parallel Processing**: Multi-core support where applicable

### Mobile/Tablet Support

- **Battery Efficient**: Algorithms optimized for mobile device constraints
- **Storage Aware**: Minimal temporary file usage
- **Network Independent**: Complete offline functionality

## Error Handling and Validation

```python
# Robust error handling
try:
    results = auto_analyze_descriptive_data(problematic_data)
    
    if 'error' in results:
        print(f"Analysis issue: {results['error']}")
        # Fallback to basic analysis
        basic_results = analyze_descriptive_data(problematic_data, analysis_type="basic")
    else:
        # Process successful results
        print("Analysis completed successfully")
        
except Exception as e:
    print(f"Unexpected error: {e}")
    # Implement fallback strategy
```

## API Reference

### Main Functions

- `auto_analyze_descriptive_data()`: Main auto-detection function
- `analyze_descriptive_data()`: Comprehensive analysis with type selection
- `quick_data_overview()`: Instant data overview
- `DescriptiveAutoDetector()`: Main auto-detection class

### Analysis Categories

- **Basic Statistics**: `calculate_basic_stats()`, `calculate_percentiles()`, `calculate_grouped_stats()`
- **Distributions**: `analyze_distribution()`, `test_normality()`, `fit_distribution()`
- **Categorical**: `analyze_categorical()`, `analyze_cross_tabulation()`, `calculate_cramers_v()`
- **Correlations**: `calculate_correlation_matrix()`, `calculate_covariance_matrix()`
- **Quality**: `analyze_missing_data()`, `detect_outliers_iqr()`, `get_outlier_summary()`

### Utility Functions

- `get_data_characteristics()`: Comprehensive data profiling
- `auto_detect_analysis_needs()`: Analysis need assessment
- `generate_analysis_workflow()`: Workflow generation

## Best Practices

1. **Start with Auto-Detection**: Let the system recommend the best approach
2. **Review Data Quality**: Always check data quality warnings before interpretation
3. **Use Metadata**: Provide variable metadata when available for enhanced analysis
4. **Validate Assumptions**: Check analysis assumptions, especially for small samples
5. **Document Workflow**: Save analysis configurations for reproducibility

## Troubleshooting

### Common Issues

1. **Small Sample Sizes**: System automatically adjusts recommendations
2. **High Missing Data**: Comprehensive missing data analysis provided
3. **Mixed Data Types**: Intelligent handling of heterogeneous datasets
4. **Large Datasets**: Automatic performance optimization

### Getting Help

```python
# Generate diagnostic information
detector = DescriptiveAutoDetector()
report = detector.generate_analysis_report(data)
print(report)  # Contains comprehensive diagnostic information
```

## Contributing

Contributions should maintain:
- Offline-first design
- Memory efficiency for mobile devices
- Comprehensive error handling
- Clear, interpretable output

## License

MIT License - see LICENSE file for details. 