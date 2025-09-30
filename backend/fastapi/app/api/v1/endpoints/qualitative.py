"""
Qualitative Analytics Endpoints
Handles text analysis, sentiment analysis, thematic analysis, and qualitative research methods.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import pandas as pd
from asgiref.sync import sync_to_async
import numpy as np

from core.database import get_db
from app.utils.shared import AnalyticsUtils

router = APIRouter()

@router.post("/project/{project_id}/analyze/text")
async def analyze_text_data(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    analysis_type: str = "comprehensive",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive text analysis on project data.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        analysis_type: Type of text analysis (basic, comprehensive, sentiment, themes)
        db: Database session
        
    Returns:
        Text analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_basic_text_analysis(df, text_fields)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'text_analysis',
            'text_fields_analyzed': text_fields,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "text analysis")

@router.post("/project/{project_id}/analyze/sentiment")
async def analyze_sentiment(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    sentiment_method: str = "vader",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run sentiment analysis on text data.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        sentiment_method: Sentiment analysis method (vader, textblob)
        db: Database session
        
    Returns:
        Sentiment analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_sentiment_analysis(df, text_fields, sentiment_method)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'sentiment_analysis',
            'text_fields_analyzed': text_fields,
            'sentiment_method': sentiment_method,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "sentiment analysis")

@router.post("/project/{project_id}/analyze/themes")
async def analyze_themes(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    num_themes: int = 5,
    theme_method: str = "lda",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run thematic analysis on text data.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        num_themes: Number of themes to extract
        theme_method: Thematic analysis method (lda, nmf, clustering)
        db: Database session
        
    Returns:
        Thematic analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_theme_analysis(df, text_fields, num_themes, theme_method)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'theme_analysis',
            'text_fields_analyzed': text_fields,
            'num_themes': num_themes,
            'theme_method': theme_method,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "theme analysis")

@router.post("/project/{project_id}/analyze/word-frequency")
async def analyze_word_frequency(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    top_n: int = 50,
    min_word_length: int = 3,
    remove_stopwords: bool = True,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run word frequency analysis on text data.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        top_n: Number of top words to return
        min_word_length: Minimum word length to include
        remove_stopwords: Whether to remove common stopwords
        db: Database session
        
    Returns:
        Word frequency analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_word_frequency_analysis(
            df, text_fields, top_n, min_word_length, remove_stopwords
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'word_frequency_analysis',
            'text_fields_analyzed': text_fields,
            'parameters': {
                'top_n': top_n,
                'min_word_length': min_word_length,
                'remove_stopwords': remove_stopwords
            },
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "word frequency analysis")

@router.post("/project/{project_id}/analyze/content-analysis")
async def analyze_content(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    analysis_framework: str = "inductive",
    coding_scheme: Optional[Dict[str, List[str]]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run content analysis on text data using specified framework.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        analysis_framework: Content analysis framework (inductive, deductive, mixed)
        coding_scheme: Optional predefined coding scheme for deductive analysis
        db: Database session
        
    Returns:
        Content analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_content_analysis(
            df, text_fields, analysis_framework, coding_scheme
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'content_analysis',
            'text_fields_analyzed': text_fields,
            'analysis_framework': analysis_framework,
            'coding_scheme_used': coding_scheme is not None,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "content analysis")

@router.post("/project/{project_id}/analyze/qualitative-coding") 
async def analyze_qualitative_coding(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    coding_method: str = "open",
    auto_code: bool = True,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run qualitative coding analysis on text data.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        coding_method: Coding method (open, axial, selective)
        auto_code: Whether to use automated coding assistance
        db: Database session
        
    Returns:
        Qualitative coding results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_qualitative_coding(
            df, text_fields, coding_method, auto_code
        )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'qualitative_coding',
            'text_fields_analyzed': text_fields,
            'coding_method': coding_method,
            'auto_code_enabled': auto_code,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "qualitative coding analysis")

@router.post("/project/{project_id}/analyze/survey")
async def analyze_survey_responses(
    project_id: str,
    response_fields: Optional[List[str]] = None,
    question_metadata: Optional[Dict[str, str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive survey analysis on qualitative responses.
    
    Args:
        project_id: Project identifier
        response_fields: Optional list of response fields to analyze
        question_metadata: Optional question descriptions/metadata
        db: Database session
        
    Returns:
        Survey analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not response_fields:
            response_fields = characteristics.get('text_variables', [])
        
        if not response_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No response fields found in the data'
            )
        
        results = AnalyticsUtils.run_survey_analysis(df, response_fields, question_metadata)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'survey_analysis',
            'response_fields_analyzed': response_fields,
            'question_metadata_provided': question_metadata is not None,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "survey analysis")

@router.post("/project/{project_id}/analyze/qualitative-statistics")
async def analyze_qualitative_statistics(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    analysis_type: str = "general",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate comprehensive qualitative statistics and data quality metrics.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        analysis_type: Type of analysis ("survey", "interview", "general")
        db: Database session
        
    Returns:
        Comprehensive qualitative statistics
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        results = AnalyticsUtils.run_qualitative_statistics(df, text_fields, analysis_type)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'qualitative_statistics',
            'text_fields_analyzed': text_fields,
            'statistical_analysis_type': analysis_type,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "qualitative statistics analysis")

@router.post("/project/{project_id}/analyze/sentiment-trends")
async def analyze_sentiment_trends(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    time_field: Optional[str] = None,
    category_field: Optional[str] = None,
    sentiment_method: str = "vader",
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Analyze sentiment trends over time and by categories.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        time_field: Optional timestamp field for trend analysis
        category_field: Optional category field for grouped analysis
        sentiment_method: Sentiment analysis method (vader, textblob)
        db: Database session
        
    Returns:
        Sentiment trend analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        # First run basic sentiment analysis
        sentiment_results = AnalyticsUtils.run_sentiment_analysis(df, text_fields, sentiment_method)
        
        # Then perform trend analysis if time field is available
        trend_results = {}
        if time_field and time_field in df.columns:
            try:
                from app.analytics.qualitative.sentiment import analyze_sentiment_trends
                
                for field in text_fields:
                    if field in df.columns:
                        texts = df[field].dropna().astype(str).tolist()
                        timestamps = df[time_field].dropna().astype(str).tolist()
                        categories = df[category_field].tolist() if category_field and category_field in df.columns else None
                        
                        if len(texts) == len(timestamps):
                            trend_analysis = analyze_sentiment_trends(texts, timestamps, categories)
                            trend_results[field] = trend_analysis
                        
            except Exception as trend_error:
                trend_results['error'] = f'Trend analysis failed: {str(trend_error)}'
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'sentiment_trends',
            'text_fields_analyzed': text_fields,
            'sentiment_method': sentiment_method,
            'time_field_used': time_field,
            'category_field_used': category_field,
            'basic_sentiment_results': sentiment_results,
            'trend_results': trend_results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "sentiment trends analysis")

@router.post("/project/{project_id}/analyze/text-similarity")
async def analyze_text_similarity(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    similarity_threshold: float = 0.5,
    max_comparisons: int = 100,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Analyze text similarity between responses.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        similarity_threshold: Minimum similarity score to report
        max_comparisons: Maximum number of comparisons to perform
        db: Database session
        
    Returns:
        Text similarity analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        # Perform similarity analysis
        similarity_results = {}
        
        try:
            from app.analytics.qualitative.text_analysis import analyze_text_similarity
            
            for field in text_fields:
                if field in df.columns:
                    texts = df[field].dropna().astype(str).tolist()
                    
                    if len(texts) >= 2:
                        similarities = []
                        comparisons_made = 0
                        
                        for i in range(len(texts)):
                            for j in range(i + 1, len(texts)):
                                if comparisons_made >= max_comparisons:
                                    break
                                    
                                similarity = analyze_text_similarity(texts[i], texts[j])
                                if similarity >= similarity_threshold:
                                    similarities.append({
                                        'text1_index': i,
                                        'text2_index': j,
                                        'text1_preview': texts[i][:100] + "..." if len(texts[i]) > 100 else texts[i],
                                        'text2_preview': texts[j][:100] + "..." if len(texts[j]) > 100 else texts[j],
                                        'similarity_score': float(similarity)
                                    })
                                comparisons_made += 1
                            
                            if comparisons_made >= max_comparisons:
                                break
                        
                        # Sort by similarity score
                        similarities.sort(key=lambda x: x['similarity_score'], reverse=True)
                        
                        similarity_results[field] = {
                            'total_texts': len(texts),
                            'comparisons_made': comparisons_made,
                            'similarities_found': len(similarities),
                            'similar_pairs': similarities[:20],  # Top 20 most similar pairs
                            'average_similarity': float(np.mean([s['similarity_score'] for s in similarities])) if similarities else 0.0
                        }
                    else:
                        similarity_results[field] = {
                            'error': f'Need at least 2 texts for similarity analysis, found {len(texts)}'
                        }
                        
        except Exception as similarity_error:
            similarity_results['error'] = f'Similarity analysis failed: {str(similarity_error)}'
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'text_similarity',
            'text_fields_analyzed': text_fields,
            'parameters': {
                'similarity_threshold': similarity_threshold,
                'max_comparisons': max_comparisons
            },
            'results': similarity_results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "text similarity analysis")

@router.post("/project/{project_id}/analyze/theme-evolution")
async def analyze_theme_evolution(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    time_field: Optional[str] = None,
    num_themes: int = 5,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Analyze how themes evolve over time in text data.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        time_field: Timestamp field for evolution analysis
        num_themes: Number of themes to track
        db: Database session
        
    Returns:
        Theme evolution analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        # Check for time field
        if not time_field:
            time_variables = characteristics.get('datetime_variables', [])
            if time_variables:
                time_field = time_variables[0]
        
        if not time_field or time_field not in df.columns:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No time field available for evolution analysis'
            )
        
        # Perform theme evolution analysis
        evolution_results = {}
        
        try:
            from app.analytics.qualitative.thematic_analysis import ThematicAnalyzer
            
            analyzer = ThematicAnalyzer()
            
            for field in text_fields:
                if field in df.columns:
                    # Get texts and timestamps, ensuring they align
                    valid_indices = df[field].notna() & df[time_field].notna()
                    texts = df.loc[valid_indices, field].astype(str).tolist()
                    timestamps = df.loc[valid_indices, time_field].astype(str).tolist()
                    
                    if len(texts) >= 10:  # Need sufficient data for evolution analysis
                        evolution = analyzer.analyze_theme_evolution(texts, timestamps, num_themes)
                        evolution_results[field] = evolution
                    else:
                        evolution_results[field] = {
                            'error': f'Need at least 10 timestamped texts for evolution analysis, found {len(texts)}'
                        }
                        
        except Exception as evolution_error:
            evolution_results['error'] = f'Theme evolution analysis failed: {str(evolution_error)}'
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'theme_evolution',
            'text_fields_analyzed': text_fields,
            'time_field_used': time_field,
            'num_themes': num_themes,
            'results': evolution_results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "theme evolution analysis")

@router.post("/project/{project_id}/analyze/extract-quotes")
async def extract_quotes_by_theme(
    project_id: str,
    text_fields: Optional[List[str]] = None,
    theme_keywords: Optional[List[str]] = None,
    max_quotes: int = 5,
    auto_extract_themes: bool = True,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Extract representative quotes for specific themes or auto-detected themes.
    
    Args:
        project_id: Project identifier
        text_fields: Optional list of text fields to analyze
        theme_keywords: Optional list of theme keywords to search for
        max_quotes: Maximum number of quotes per theme
        auto_extract_themes: Whether to auto-detect themes if keywords not provided
        db: Database session
        
    Returns:
        Quote extraction results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Get data characteristics to identify text variables if not specified
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        if not text_fields:
            text_fields = characteristics.get('text_variables', [])
        
        if not text_fields:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No text variables found in the data'
            )
        
        # Perform quote extraction
        quote_results = {}
        
        try:
            from app.analytics.qualitative.thematic_analysis import ThematicAnalyzer
            
            analyzer = ThematicAnalyzer()
            
            for field in text_fields:
                if field in df.columns:
                    texts = df[field].dropna().astype(str).tolist()
                    
                    if len(texts) >= 3:
                        field_results = {}
                        
                        # If no theme keywords provided, auto-extract themes first
                        if not theme_keywords and auto_extract_themes:
                            theme_analysis = analyzer.identify_themes_clustering(texts, min(5, len(texts)//2))
                            auto_themes = theme_analysis.get('themes', [])
                            
                            for i, theme in enumerate(auto_themes):
                                theme_name = f"theme_{i+1}"
                                keywords = theme.get('keywords', [])[:3]  # Top 3 keywords
                                
                                if keywords:
                                    quotes = analyzer.extract_quotes_by_theme(texts, keywords, max_quotes)
                                    field_results[theme_name] = {
                                        'keywords': keywords,
                                        'quotes': quotes,
                                        'theme_description': f"Auto-detected theme with keywords: {', '.join(keywords)}"
                                    }
                        
                        # If theme keywords provided, extract quotes for each
                        elif theme_keywords:
                            quotes = analyzer.extract_quotes_by_theme(texts, theme_keywords, max_quotes)
                            field_results['custom_theme'] = {
                                'keywords': theme_keywords,
                                'quotes': quotes,
                                'theme_description': f"Custom theme with keywords: {', '.join(theme_keywords)}"
                            }
                        else:
                            field_results['error'] = 'No theme keywords provided and auto-extraction disabled'
                        
                        quote_results[field] = {
                            'total_texts_analyzed': len(texts),
                            'themes_with_quotes': field_results,
                            'extraction_method': 'auto-detected' if auto_extract_themes and not theme_keywords else 'custom_keywords'
                        }
                    else:
                        quote_results[field] = {
                            'error': f'Need at least 3 texts for quote extraction, found {len(texts)}'
                        }
                        
        except Exception as extraction_error:
            quote_results['error'] = f'Quote extraction failed: {str(extraction_error)}'
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'quote_extraction',
            'text_fields_analyzed': text_fields,
            'theme_keywords_provided': theme_keywords,
            'max_quotes_per_theme': max_quotes,
            'auto_extraction_enabled': auto_extract_themes,
            'results': quote_results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "quote extraction analysis")

@router.get("/analysis-types")
async def get_qualitative_analysis_types() -> Dict[str, Any]:
    """
    Get available qualitative analysis types and methods.
    
    Returns:
        Available qualitative analysis types
    """
    try:
        analysis_types = {
            'qualitative_analysis_types': {
                'text_analysis': {
                    'description': 'Comprehensive text analysis including basic statistics and patterns',
                    'includes': ['word_count', 'readability', 'basic_patterns', 'text_statistics']
                },
                'sentiment_analysis': {
                    'description': 'Sentiment analysis using various methods',
                    'methods': ['vader', 'textblob', 'custom'],
                    'includes': ['sentiment_scores', 'emotion_detection', 'polarity_analysis']
                },
                'sentiment_trends': {
                    'description': 'Advanced sentiment analysis with temporal and categorical trends',
                    'methods': ['vader', 'textblob'],
                    'includes': ['trend_analysis', 'category_comparison', 'temporal_patterns']
                },
                'theme_analysis': {
                    'description': 'Thematic analysis and topic modeling',
                    'methods': ['lda', 'nmf', 'clustering', 'manual'],
                    'includes': ['topic_extraction', 'theme_identification', 'conceptual_mapping']
                },
                'theme_evolution': {
                    'description': 'Analysis of how themes change and evolve over time',
                    'methods': ['temporal_clustering', 'longitudinal_analysis'],
                    'includes': ['trend_tracking', 'theme_emergence', 'temporal_patterns']
                },
                'word_frequency': {
                    'description': 'Word frequency and lexical analysis',
                    'includes': ['frequency_counts', 'tf_idf', 'n_gram_analysis', 'vocabulary_analysis']
                },
                'content_analysis': {
                    'description': 'Systematic content analysis using various frameworks',
                    'frameworks': ['inductive', 'deductive', 'mixed'],
                    'includes': ['category_development', 'pattern_identification', 'systematic_coding']
                },
                'qualitative_coding': {
                    'description': 'Qualitative data coding and analysis',
                    'methods': ['open', 'axial', 'selective'],
                    'includes': ['code_development', 'category_formation', 'theoretical_integration']
                },
                'survey_analysis': {
                    'description': 'Comprehensive analysis of survey responses',
                    'includes': ['question_analysis', 'respondent_patterns', 'cross_question_comparison', 'quality_metrics']
                },
                'qualitative_statistics': {
                    'description': 'Comprehensive qualitative data statistics and quality metrics',
                    'types': ['survey', 'interview', 'general'],
                    'includes': ['data_quality', 'completeness_metrics', 'response_patterns', 'statistical_summaries']
                },
                'text_similarity': {
                    'description': 'Analysis of similarity between text responses',
                    'includes': ['jaccard_similarity', 'semantic_similarity', 'duplicate_detection']
                },
                'quote_extraction': {
                    'description': 'Extract representative quotes for themes',
                    'methods': ['auto_detection', 'keyword_based'],
                    'includes': ['theme_quotes', 'representative_examples', 'contextual_extraction']
                }
            },
            'text_analysis_methods': {
                'sentiment_methods': ['vader', 'textblob', 'custom'],
                'theme_methods': ['lda', 'nmf', 'clustering', 'manual'],
                'coding_methods': ['open', 'axial', 'selective'],
                'content_frameworks': ['inductive', 'deductive', 'mixed'],
                'statistical_types': ['survey', 'interview', 'general']
            }
        }
        
        return AnalyticsUtils.format_api_response('success', analysis_types)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting qualitative analysis types")

@router.get("/endpoints")
async def get_qualitative_endpoints() -> Dict[str, Any]:
    """
    Get all available qualitative analytics endpoints.
    
    Returns:
        List of all qualitative analytics endpoints
    """
    try:
        endpoints = {
            'qualitative_analytics_endpoints': {
                'POST /project/{project_id}/analyze/text': 'Run comprehensive text analysis',
                'POST /project/{project_id}/analyze/sentiment': 'Run sentiment analysis',
                'POST /project/{project_id}/analyze/themes': 'Run thematic analysis',
                'POST /project/{project_id}/analyze/word-frequency': 'Run word frequency analysis',
                'POST /project/{project_id}/analyze/content-analysis': 'Run content analysis',
                'POST /project/{project_id}/analyze/qualitative-coding': 'Run qualitative coding analysis',
                'POST /project/{project_id}/analyze/survey': 'Run comprehensive survey analysis',
                'POST /project/{project_id}/analyze/qualitative-statistics': 'Generate qualitative statistics',
                'POST /project/{project_id}/analyze/sentiment-trends': 'Analyze sentiment trends',
                'POST /project/{project_id}/analyze/text-similarity': 'Analyze text similarity',
                'POST /project/{project_id}/analyze/theme-evolution': 'Analyze theme evolution',
                'POST /project/{project_id}/analyze/extract-quotes': 'Extract quotes by theme',
                'GET /analysis-types': 'Get available qualitative analysis types',
                'GET /endpoints': 'Get all qualitative analytics endpoints'
            },
            'parameters': {
                'text_fields': {
                    'description': 'Optional list of text fields to analyze',
                    'type': 'List[str]',
                    'applicable_endpoints': 'all'
                },
                'sentiment_method': {
                    'values': ['vader', 'textblob', 'custom'],
                    'default': 'vader',
                    'endpoint': '/analyze/sentiment'
                },
                'num_themes': {
                    'description': 'Number of themes to extract',
                    'type': 'int',
                    'default': 5,
                    'endpoint': '/analyze/themes'
                },
                'theme_method': {
                    'values': ['lda', 'nmf', 'clustering', 'manual'],
                    'default': 'lda',
                    'endpoint': '/analyze/themes'
                },
                'coding_method': {
                    'values': ['open', 'axial', 'selective'],
                    'default': 'open',
                    'endpoint': '/analyze/qualitative-coding'
                },
                'analysis_framework': {
                    'values': ['inductive', 'deductive', 'mixed'],
                    'default': 'inductive',
                    'endpoint': '/analyze/content-analysis'
                }
            }
        }
        
        return AnalyticsUtils.format_api_response('success', endpoints)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting qualitative endpoints") 