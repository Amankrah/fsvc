# Qualitative Analytics Module

A comprehensive suite of qualitative research analytics tools designed for offline-first research data collection. This module provides advanced qualitative analysis capabilities specifically tailored for research projects in Africa and other environments where connectivity may be limited.

## Overview

The qualitative analytics module includes seven specialized components:

1. **Enhanced Sentiment Analysis** - Advanced sentiment detection with emotion analysis
2. **Thematic Analysis** - Automated theme identification using clustering and LDA
3. **Content Analysis** - Systematic content structure and pattern analysis
4. **Qualitative Coding** - Tools for coding and categorizing qualitative data
5. **Survey Analysis** - Specialized analysis for survey responses
6. **Qualitative Statistics** - Comprehensive statistical summaries
7. **Auto-Detection** - Intelligent analysis method recommendation

## Features

### ✨ Key Capabilities

- **Offline-First Design**: All analyses work without internet connectivity
- **Auto-Detection**: Automatically suggests appropriate analysis methods
- **Multi-Method Support**: Comprehensive coverage of qualitative research methods
- **Research-Focused**: Designed specifically for academic and field research
- **Export Ready**: Generate human-readable reports and summaries
- **Scalable**: Handles datasets from small pilots to large-scale studies

### 📊 Analysis Types Supported

- Sentiment analysis with emotion detection
- Thematic analysis (clustering and LDA-based)
- Content analysis with linguistic features
- Systematic qualitative coding
- Survey response quality analysis
- Cross-question comparison
- Respondent pattern analysis
- Data quality assessment

## Module Structure

```
qualitative/
├── __init__.py              # Package interface and convenience functions
├── sentiment.py             # Enhanced sentiment analysis
├── thematic_analysis.py     # Theme identification and analysis
├── content_analysis.py      # Content structure and pattern analysis
├── coding.py               # Qualitative coding and categorization
├── survey_analysis.py      # Survey-specific analysis tools
├── qualitative_stats.py    # Statistical summaries and insights
├── auto_detection.py       # Intelligent method selection
└── README.md              # This documentation
```

## Quick Start

### Basic Usage

```python
from analytics.qualitative import analyze_qualitative_data

# Automatic analysis with method detection
texts = ["I really enjoyed the workshop", "The training was disappointing", ...]
results = analyze_qualitative_data(texts, analysis_type="auto")

# Specific analysis types
sentiment_results = analyze_qualitative_data(texts, analysis_type="sentiment")
theme_results = analyze_qualitative_data(texts, analysis_type="themes")
```

### Convenience Functions

```python
from analytics.qualitative import (
    quick_sentiment_analysis,
    quick_theme_analysis,
    quick_content_analysis,
    get_analysis_recommendations
)

# Quick analyses with default settings
sentiment = quick_sentiment_analysis(texts)
themes = quick_theme_analysis(texts, n_themes=5)
content = quick_content_analysis(texts)

# Get recommendations for best analysis methods
recommendations = get_analysis_recommendations(texts)
```

## Detailed Module Documentation

### 1. Sentiment Analysis (`sentiment.py`)

Enhanced sentiment analysis with emotion detection and pattern analysis.

**Key Features:**
- Multi-dimensional sentiment scoring (polarity, subjectivity, intensity)
- Emotion detection (joy, anger, sadness, fear, surprise, disgust)
- Sentiment trends over time
- Cross-question sentiment comparison
- Pattern detection and volatility analysis

**Usage:**
```python
from analytics.qualitative.sentiment import analyze_sentiment_trends

results = analyze_sentiment_trends(
    texts=texts,
    timestamps=timestamps,  # Optional
    categories=categories   # Optional
)
```

### 2. Thematic Analysis (`thematic_analysis.py`)

Automated theme identification using machine learning approaches.

**Key Features:**
- Clustering-based theme identification
- Latent Dirichlet Allocation (LDA) topic modeling
- Theme evolution over time
- Theme relationship analysis
- Representative quote extraction

**Usage:**
```python
from analytics.qualitative.thematic_analysis import ThematicAnalyzer

analyzer = ThematicAnalyzer()
themes = analyzer.identify_themes_clustering(texts, n_themes=5)
```

### 3. Content Analysis (`content_analysis.py`)

Systematic analysis of content structure and linguistic features.

**Key Features:**
- Content structure analysis (word counts, sentence patterns)
- Linguistic feature extraction (POS tagging, lexical diversity)
- Content categorization with custom categories
- Pattern identification (n-grams, repeating phrases)
- Metadata-based content comparison

**Usage:**
```python
from analytics.qualitative.content_analysis import ContentAnalyzer

analyzer = ContentAnalyzer()
results = analyzer.analyze_content_structure(texts)
```

### 4. Qualitative Coding (`coding.py`)

Tools for systematic coding and categorization of qualitative data.

**Key Features:**
- Code creation and management
- Automated keyword-based coding
- Code frequency and co-occurrence analysis
- Inter-coder reliability calculation
- Hierarchical coding schemes

**Usage:**
```python
from analytics.qualitative.coding import QualitativeCoder

coder = QualitativeCoder()
coder.create_code("positive_experience", "Responses indicating positive experiences")
coded_segments = coder.auto_code_keywords(texts, keyword_codes)
```

### 5. Survey Analysis (`survey_analysis.py`)

Specialized tools for analyzing survey responses.

**Key Features:**
- Response quality assessment
- Question-by-question analysis
- Cross-question comparison
- Respondent pattern analysis
- Engagement level calculation

**Usage:**
```python
from analytics.qualitative.survey_analysis import SurveyAnalyzer

analyzer = SurveyAnalyzer()
# survey_data: {question_id: [list_of_responses]}
results = analyzer.analyze_survey_by_questions(survey_data)
```

### 6. Qualitative Statistics (`qualitative_stats.py`)

Comprehensive statistical summaries and data quality metrics.

**Key Features:**
- Basic descriptive statistics
- Data quality assessment
- Comprehensive reporting
- Key insights generation
- Methodology recommendations

**Usage:**
```python
from analytics.qualitative.qualitative_stats import QualitativeStatistics

stats = QualitativeStatistics()
summary = stats.generate_comprehensive_summary(texts, analysis_type="survey")
```

### 7. Auto-Detection (`auto_detection.py`)

Intelligent analysis method selection and configuration.

**Key Features:**
- Data type detection (interview, survey, open-ended, etc.)
- Method suitability assessment
- Automatic parameter configuration
- Analysis workflow recommendations

**Usage:**
```python
from analytics.qualitative.auto_detection import auto_analyze

# Complete auto-analysis with recommendations
results = auto_analyze(texts, metadata=metadata, research_goals=goals)
```

## Data Input Formats

### Text Data
- **Format**: List of strings
- **Example**: `["Response 1", "Response 2", ...]`
- **Requirements**: UTF-8 encoded text

### Metadata (Optional)
- **Format**: List of dictionaries
- **Example**: `[{"respondent_id": 1, "age": 25}, ...]`
- **Use**: Enhanced analysis and grouping

### Survey Data
- **Format**: Dictionary mapping question IDs to response lists
- **Example**: `{"q1": ["answer1", "answer2"], "q2": ["answer1", "answer2"]}`

## Output Formats

All analysis functions return structured dictionaries with:

- **Analysis results**: Quantitative metrics and scores
- **Qualitative insights**: Themes, patterns, representative quotes
- **Statistical summaries**: Descriptive statistics and distributions
- **Recommendations**: Actionable insights for research improvement
- **Human-readable reports**: Formatted text summaries

## Integration with Research Workflow

### Data Collection Phase
```python
# Quick quality check during data collection
from analytics.qualitative import get_analysis_recommendations

recommendations = get_analysis_recommendations(collected_responses)
# Adjust data collection strategy based on recommendations
```

### Analysis Phase
```python
# Comprehensive analysis
from analytics.qualitative import analyze_qualitative_data

results = analyze_qualitative_data(
    texts=all_responses,
    analysis_type="auto",
    metadata=respondent_metadata
)
```

### Reporting Phase
```python
# Generate final report
from analytics.qualitative import generate_qualitative_report

report = generate_qualitative_report(
    texts=final_dataset,
    analysis_type="survey"
)
```

## Performance Considerations

### Recommended Dataset Sizes
- **Sentiment Analysis**: 5+ texts
- **Thematic Analysis**: 10+ texts (optimal: 50+)
- **Content Analysis**: 5+ texts
- **Coding**: 8+ texts
- **Survey Analysis**: Variable (depends on questions)

### Memory Usage
- **Small datasets** (<100 texts): <50MB RAM
- **Medium datasets** (100-1000 texts): 50-200MB RAM
- **Large datasets** (1000+ texts): 200MB+ RAM

### Processing Time
- **Auto-detection**: <1 second for 100 texts
- **Sentiment analysis**: ~1-2 seconds per 100 texts
- **Thematic analysis**: ~5-10 seconds per 100 texts
- **Content analysis**: ~2-5 seconds per 100 texts

## Dependencies

### Required
- `pandas` - Data manipulation
- `numpy` - Numerical operations
- `scikit-learn` - Machine learning algorithms
- `nltk` - Natural language processing
- `textblob` - Simple text processing

### Optional (for enhanced features)
- `matplotlib` - Visualization (if charts needed)
- `wordcloud` - Word cloud generation

## Error Handling

All modules include comprehensive error handling:

- **Input validation**: Checks for empty or malformed data
- **Graceful degradation**: Fallback methods when primary methods fail
- **Informative error messages**: Clear guidance for troubleshooting
- **Logging**: Detailed logs for debugging

## Best Practices

### Data Preparation
1. Clean text data (remove encoding issues)
2. Ensure consistent formatting
3. Provide metadata when available
4. Consider anonymization for sensitive data

### Analysis Selection
1. Use auto-detection for initial exploration
2. Combine multiple methods for comprehensive analysis
3. Validate results with domain expertise
4. Document analysis choices and parameters

### Result Interpretation
1. Consider confidence scores and quality metrics
2. Validate findings with representative quotes
3. Cross-reference different analysis methods
4. Document limitations and assumptions

## Troubleshooting

### Common Issues

**"No texts provided" error**
- Solution: Ensure text list is not empty
- Check for None values in text data

**Poor theme identification**
- Solution: Increase dataset size (recommend 50+ texts)
- Try different n_themes parameters
- Consider using LDA instead of clustering

**Low sentiment confidence**
- Solution: Check for very short texts
- Ensure texts contain opinion/emotion words
- Consider combining with content analysis

**Memory issues with large datasets**
- Solution: Process in batches
- Use sampling for initial exploration
- Consider data preprocessing to reduce size

### Debug Mode
Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Contributing

This module is designed for extensibility. Key extension points:

1. **New analysis methods**: Add to auto-detection logic
2. **Custom categorization**: Extend content analysis categories
3. **Language support**: Add language-specific processing
4. **Visualization**: Add chart generation capabilities

## License

This module is part of the Research Data Collection Tool project and follows the same licensing terms.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the module documentation
3. Check logs for detailed error information
4. Refer to the main project documentation 