"""
Qualitative analytics package for comprehensive research data analysis.

This package provides a complete suite of tools for analyzing qualitative research data,
including sentiment analysis, thematic analysis, content analysis, coding, and survey analysis.
"""

# Import main classes and functions for easy access
from .sentiment import (
    analyze_sentiment,
    analyze_sentiment_batch,
    analyze_sentiment_trends,
    analyze_sentiment_by_question,
    detect_sentiment_patterns,
    generate_sentiment_summary
)

from .thematic_analysis import (
    ThematicAnalyzer,
    analyze_themes
)

from .content_analysis import (
    ContentAnalyzer,
    analyze_content_comprehensively
)

from .coding import (
    QualitativeCoder,
    create_coding_scheme_from_themes,
    analyze_coded_data
)

from .survey_analysis import (
    SurveyAnalyzer,
    analyze_survey_data
)

from .qualitative_stats import (
    QualitativeStatistics,
    generate_qualitative_report
)

from .auto_detection import (
    QualitativeAutoDetector,
    auto_analyze
)

# Package version
__version__ = "1.0.0"

# Package metadata
__author__ = "Research Data Collection Tool Team"
__description__ = "Comprehensive qualitative analytics for research data"

# Main analysis functions for easy access
def analyze_qualitative_data(texts, analysis_type="auto", **kwargs):
    """
    Main function to analyze qualitative data with automatic method selection.
    
    Args:
        texts: List of text documents
        analysis_type: Type of analysis ("auto", "sentiment", "themes", "content", "survey")
        **kwargs: Additional parameters for specific analyses
        
    Returns:
        Dictionary with analysis results
    """
    if analysis_type == "auto":
        return auto_analyze(texts, **kwargs)
    elif analysis_type == "sentiment":
        return analyze_sentiment_trends(texts, **kwargs)
    elif analysis_type == "themes":
        return analyze_themes(texts, **kwargs)
    elif analysis_type == "content":
        return analyze_content_comprehensively(texts, **kwargs)
    elif analysis_type == "survey":
        return analyze_survey_data(texts, **kwargs)
    else:
        raise ValueError(f"Unknown analysis type: {analysis_type}")

# Convenience functions
def quick_sentiment_analysis(texts):
    """Quick sentiment analysis with default settings."""
    return analyze_sentiment_trends(texts)

def quick_theme_analysis(texts, n_themes=5):
    """Quick thematic analysis with default settings."""
    return analyze_themes(texts, n_themes=n_themes)

def quick_content_analysis(texts):
    """Quick content analysis with default settings."""
    return analyze_content_comprehensively(texts)

def get_analysis_recommendations(texts):
    """Get recommendations for which analysis methods to use."""
    detector = QualitativeAutoDetector()
    return detector.suggest_analysis_methods(texts)

# Export all main components
__all__ = [
    # Main analysis functions
    'analyze_qualitative_data',
    'quick_sentiment_analysis',
    'quick_theme_analysis', 
    'quick_content_analysis',
    'get_analysis_recommendations',
    
    # Core classes
    'ThematicAnalyzer',
    'ContentAnalyzer',
    'QualitativeCoder',
    'SurveyAnalyzer',
    'QualitativeStatistics',
    'QualitativeAutoDetector',
    
    # Individual analysis functions
    'analyze_sentiment',
    'analyze_sentiment_batch',
    'analyze_sentiment_trends',
    'analyze_themes',
    'analyze_content_comprehensively',
    'analyze_coded_data',
    'analyze_survey_data',
    'generate_qualitative_report',
    'auto_analyze',
    
    # Utility functions
    'create_coding_scheme_from_themes',
    'detect_sentiment_patterns',
    'generate_sentiment_summary'
] 