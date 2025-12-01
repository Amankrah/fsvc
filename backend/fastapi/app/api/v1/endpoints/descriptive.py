"""
Descriptive Analytics Endpoints
Handles comprehensive statistical analysis including distributions, correlations, and data quality assessment.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional, Union
import pandas as pd
from asgiref.sync import sync_to_async

from core.database import get_db
from app.utils.shared import AnalyticsUtils

# Import descriptive analytics modules for comprehensive functionality
from app.analytics.descriptive import (
    # Basic statistics
    calculate_basic_stats,
    calculate_percentiles,
    calculate_grouped_stats,
    calculate_weighted_stats,
    calculate_correlation_matrix,
    calculate_covariance_matrix,
    
    # Distributions
    analyze_distribution,
    test_normality,
    calculate_skewness_kurtosis,
    fit_distribution,
    
    # Categorical analysis
    analyze_categorical,
    calculate_chi_square,
    calculate_cramers_v,
    analyze_cross_tabulation,
    calculate_diversity_metrics,
    analyze_categorical_associations,
    
    # Outlier detection
    detect_outliers_iqr,
    detect_outliers_zscore,
    detect_outliers_isolation_forest,
    detect_outliers_mad,
    get_outlier_summary,
    
    # Missing data
    analyze_missing_data,
    get_missing_patterns,
    calculate_missing_correlations,
    create_missing_data_heatmap,
    analyze_missing_by_group,
    
    # Temporal analysis
    analyze_temporal_patterns,
    calculate_time_series_stats,
    detect_seasonality,
    
    # Geospatial analysis
    analyze_spatial_distribution,
    calculate_spatial_autocorrelation,
    create_location_clusters,
    
    # Summary generation
    generate_full_report,
    generate_executive_summary,
    export_statistics
)

router = APIRouter()

@router.post("/project/{project_id}/analyze/basic-statistics")
async def analyze_basic_statistics(
    project_id: str,
    variables: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run basic statistical analysis on project data.
    
    Args:
        project_id: Project identifier
        variables: Optional list of variables to analyze
        db: Database session
        
    Returns:
        Basic statistics results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_basic_statistics(df, variables)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'basic_statistics',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "basic statistics analysis")

@router.post("/project/{project_id}/analyze/distributions")
async def analyze_distributions(
    project_id: str,
    variables: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run distribution analysis on project data.
    
    Args:
        project_id: Project identifier
        variables: Optional list of variables to analyze
        db: Database session
        
    Returns:
        Distribution analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_distribution_analysis(df, variables)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'distribution_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "distribution analysis")

@router.post("/project/{project_id}/analyze/categorical")
async def analyze_categorical_data(
    project_id: str,
    variables: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run categorical analysis on project data.
    
    Args:
        project_id: Project identifier
        variables: Optional list of variables to analyze
        db: Database session
        
    Returns:
        Categorical analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_categorical_analysis(df, variables)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'categorical_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "categorical analysis")

@router.post("/project/{project_id}/analyze/outliers")
async def analyze_outliers(
    project_id: str,
    variables: Optional[List[str]] = None,
    methods: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run outlier detection analysis on project data.
    
    Args:
        project_id: Project identifier
        variables: Optional list of variables to analyze
        methods: Optional list of outlier detection methods (iqr, zscore, isolation_forest, mad)
        db: Database session
        
    Returns:
        Outlier analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_outlier_analysis(df, variables, methods)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'outlier_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "outlier analysis")

@router.post("/project/{project_id}/analyze/missing-data")
async def analyze_missing_data(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run missing data analysis on project data.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Missing data analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_missing_data_analysis(df)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'missing_data_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "missing data analysis")

@router.post("/project/{project_id}/analyze/data-quality")
async def analyze_data_quality(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive data quality analysis on project data.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Data quality analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_data_quality_analysis(df)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'data_quality_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "data quality analysis")

@router.post("/project/{project_id}/analyze/descriptive")
async def analyze_descriptive(
    project_id: str,
    analysis_type: str = "comprehensive",
    target_variables: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive descriptive analysis on project data.
    
    Args:
        project_id: Project identifier
        analysis_type: Type of descriptive analysis (basic, comprehensive)
        target_variables: Optional list of specific variables to analyze
        db: Database session
        
    Returns:
        Descriptive analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = AnalyticsUtils.run_descriptive_analysis(df, analysis_type, target_variables)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'descriptive_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "descriptive analysis")

@router.post("/project/{project_id}/generate-report")
async def generate_comprehensive_report(
    project_id: str,
    include_plots: bool = False,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate a comprehensive analytics report for project data.
    
    Args:
        project_id: Project identifier
        include_plots: Whether to include plot data in the report
        db: Database session
        
    Returns:
        Comprehensive analytics report
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for report generation'
            )
        
        results = AnalyticsUtils.generate_comprehensive_report(df, include_plots)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'report_type': 'comprehensive_analytics_report',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "comprehensive report generation")

@router.get("/project/{project_id}/explore-data")
async def explore_project_data(
    project_id: str,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    question_filter: Optional[str] = None,
    respondent_filter: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Explore project data with filtering, pagination, and search capabilities.
    
    Args:
        project_id: Project identifier
        page: Page number (1-based)
        page_size: Number of records per page (max 200)
        search: Search term for response values
        question_filter: Filter by specific question text/ID
        respondent_filter: Filter by specific respondent ID
        date_from: Filter responses from this date (YYYY-MM-DD)
        date_to: Filter responses to this date (YYYY-MM-DD)
        db: Database session
        
    Returns:
        Paginated data exploration results
    """
    try:
        # Validate parameters
        page = max(1, page)
        page_size = min(200, max(1, page_size))
        offset = (page - 1) * page_size
        
        from core.database import get_django_db_connection
        from django.db import connection
        
        # Wrap database operations in sync_to_async
        @sync_to_async
        def explore_data_sync():
            # Normalize project_id for database query
            normalized_project_id = AnalyticsUtils.normalize_uuid(project_id)
            
            # Build the base query
            base_query = """
                SELECT 
                    r.response_id,
                    r.respondent_id,
                    r.response_value,
                    r.numeric_value,
                    r.datetime_value,
                    r.choice_selections,
                    r.collected_at,
                    r.is_validated,
                    r.data_quality_score,
                    r.location_data,
                    q.question_text,
                    q.response_type,
                    q.options,
                    resp.name as respondent_name,
                    resp.email as respondent_email,
                    rt.display_name as response_type_name,
                    rt.data_type as response_data_type
                FROM responses_response r
                JOIN forms_question q ON r.question_id = q.id
                JOIN responses_respondent resp ON r.respondent_id = resp.id
                LEFT JOIN responses_responsetype rt ON r.response_type_id = rt.id
                WHERE r.project_id = %s
            """
            
            params = [normalized_project_id]
            
            # Add filters
            if search:
                base_query += " AND (r.response_value LIKE %s OR q.question_text LIKE %s)"
                search_param = f"%{search}%"
                params.extend([search_param, search_param])
            
            if question_filter:
                base_query += " AND q.question_text LIKE %s"
                params.append(f"%{question_filter}%")
            
            if respondent_filter:
                base_query += " AND r.respondent_id LIKE %s"
                params.append(f"%{respondent_filter}%")
            
            if date_from:
                base_query += " AND DATE(r.collected_at) >= %s"
                params.append(date_from)
            
            if date_to:
                base_query += " AND DATE(r.collected_at) <= %s"
                params.append(date_to)
            
            # Count total records
            count_query = f"SELECT COUNT(*) FROM ({base_query}) as total_count"
            
            with connection.cursor() as cursor:
                cursor.execute(count_query, params)
                total_count = cursor.fetchone()[0]
            
            # Add pagination
            paginated_query = base_query + " ORDER BY r.collected_at DESC LIMIT %s OFFSET %s"
            params.extend([page_size, offset])
            
            with connection.cursor() as cursor:
                cursor.execute(paginated_query, params)
                results = cursor.fetchall()
            
            # Get filter options for UI
            filter_options = {}
            
            # Get available questions for filter dropdown
            questions_query = """
                SELECT DISTINCT q.question_text
                FROM responses_response r
                JOIN forms_question q ON r.question_id = q.id
                WHERE r.project_id = %s
                ORDER BY q.question_text
                LIMIT 50
            """
            
            with connection.cursor() as cursor:
                cursor.execute(questions_query, [normalized_project_id])
                filter_options['questions'] = [row[0] for row in cursor.fetchall()]
            
            # Format results
            data = []
            for row in results:
                data.append({
                    'response_id': row[0],
                    'respondent_id': row[1],
                    'response_value': row[2],
                    'numeric_value': row[3],
                    'datetime_value': str(row[4]) if row[4] else None,
                    'choice_selections': row[5],
                    'collected_at': str(row[6]) if row[6] else None,
                    'is_validated': bool(row[7]),
                    'data_quality_score': row[8],
                    'location_data': row[9],
                    'question_text': row[10],
                    'response_type': row[11],
                    'options': row[12],
                    'respondent_name': row[13],
                    'respondent_email': row[14],
                    'response_type_name': row[15],
                    'response_data_type': row[16]
                })
            
            total_pages = (total_count + page_size - 1) // page_size
            
            return {
                'data': data,
                'pagination': {
                    'current_page': page,
                    'page_size': page_size,
                    'total_count': total_count,
                    'total_pages': total_pages,
                    'has_next': page < total_pages,
                    'has_previous': page > 1
                },
                'filter_options': filter_options
            }
        
        # Execute the sync function
        result = await explore_data_sync()
        
        return AnalyticsUtils.format_api_response('success', result)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "data exploration")

@router.get("/project/{project_id}/data-summary")
async def get_data_summary(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get a quick summary of project data for exploration overview.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Data summary with counts, types, and sample records
    """
    try:
        from core.database import get_django_db_connection
        from django.db import connection
        
        # Wrap database operations in sync_to_async
        @sync_to_async
        def get_data_summary_sync():
            # Normalize project_id for database query
            normalized_project_id = AnalyticsUtils.normalize_uuid(project_id)
            
            # Get comprehensive data summary
            summary_query = """
                SELECT 
                    COUNT(*) as total_responses,
                    COUNT(DISTINCT r.respondent_id) as unique_respondents,
                    COUNT(DISTINCT q.id) as unique_questions,
                    COUNT(DISTINCT rt.data_type) as response_types,
                    MIN(r.collected_at) as earliest_response,
                    MAX(r.collected_at) as latest_response,
                    AVG(CASE WHEN r.data_quality_score IS NOT NULL THEN r.data_quality_score ELSE 0 END) as avg_quality_score,
                    COUNT(CASE WHEN r.is_validated = TRUE THEN 1 END) as validated_responses,
                    COUNT(CASE WHEN r.location_data IS NOT NULL AND r.location_data != '{}' THEN 1 END) as responses_with_location
                FROM responses_response r
                JOIN forms_question q ON r.question_id = q.id
                LEFT JOIN responses_responsetype rt ON r.response_type_id = rt.id
                WHERE r.project_id = %s
            """
            
            with connection.cursor() as cursor:
                cursor.execute(summary_query, [normalized_project_id])
                summary_result = cursor.fetchone()
            
            if not summary_result or summary_result[0] == 0:
                return None
            
            # Get response type breakdown
            type_breakdown_query = """
                SELECT 
                    rt.display_name,
                    rt.data_type,
                    COUNT(*) as count
                FROM responses_response r
                LEFT JOIN responses_responsetype rt ON r.response_type_id = rt.id
                WHERE r.project_id = %s
                GROUP BY rt.display_name, rt.data_type
                ORDER BY count DESC
            """
            
            with connection.cursor() as cursor:
                cursor.execute(type_breakdown_query, [normalized_project_id])
                type_results = cursor.fetchall()
            
            # Format results
            summary = {
                'total_responses': summary_result[0],
                'unique_respondents': summary_result[1],
                'unique_questions': summary_result[2],
                'response_types_count': summary_result[3],
                'earliest_response': str(summary_result[4]) if summary_result[4] else None,
                'latest_response': str(summary_result[5]) if summary_result[5] else None,
                'avg_quality_score': round(float(summary_result[6]), 2) if summary_result[6] else 0,
                'validated_responses': summary_result[7],
                'responses_with_location': summary_result[8],
                'validation_rate': round((summary_result[7] / summary_result[0]) * 100, 1) if summary_result[0] > 0 else 0,
                'location_coverage': round((summary_result[8] / summary_result[0]) * 100, 1) if summary_result[0] > 0 else 0
            }
            
            response_types = [
                {
                    'display_name': row[0] or 'Unknown',
                    'data_type': row[1] or 'unknown',
                    'count': row[2]
                }
                for row in type_results
            ]
            
            return {
                'summary': summary,
                'response_types': response_types
            }
        
        # Execute the sync function
        result = await get_data_summary_sync()
        
        if result is None:
            # Return empty data structure instead of None
            empty_result = {
                'summary': {
                    'total_responses': 0,
                    'unique_respondents': 0,
                    'unique_questions': 0,
                    'response_types_count': 0,
                    'earliest_response': None,
                    'latest_response': None,
                    'avg_quality_score': 0,
                    'validated_responses': 0,
                    'responses_with_location': 0,
                    'validation_rate': 0,
                    'location_coverage': 0
                },
                'response_types': []
            }
            return AnalyticsUtils.format_api_response('success', empty_result)
        
        return AnalyticsUtils.format_api_response('success', result)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "data summary")

@router.get("/project/{project_id}/available-questions")
async def get_available_questions(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get list of available questions for analytics variable selection.
    Returns questions with their text, response type, analytics category, and data type.

    Args:
        project_id: Project identifier
        db: Database session

    Returns:
        List of questions available for analysis
    """
    try:
        from django.db import connection

        @sync_to_async
        def get_questions_sync():
            normalized_project_id = AnalyticsUtils.normalize_uuid(project_id)

            # Get unique questions with metadata
            questions_query = """
                SELECT DISTINCT
                    q.question_text,
                    rt.name as response_type,
                    rt.display_name as response_type_display,
                    rt.data_type,
                    rt.analytics_category,
                    r.question_category,
                    COUNT(r.response_id) as response_count
                FROM forms_question q
                JOIN responses_response r ON r.question_id = q.id
                LEFT JOIN responses_responsetype rt ON r.response_type_id = rt.id
                WHERE r.project_id = %s
                GROUP BY q.question_text, rt.name, rt.display_name, rt.data_type, rt.analytics_category, r.question_category
                ORDER BY response_count DESC, q.question_text
            """

            with connection.cursor() as cursor:
                cursor.execute(questions_query, [normalized_project_id])
                results = cursor.fetchall()

            questions = [
                {
                    'question_text': row[0],
                    'response_type': row[1],
                    'response_type_display': row[2],
                    'data_type': row[3],
                    'analytics_category': row[4],
                    'question_category': row[5],
                    'response_count': row[6]
                }
                for row in results
            ]

            return questions

        questions = await get_questions_sync()

        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'total_questions': len(questions),
            'questions': questions
        })

    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "fetching available questions")

@router.post("/project/{project_id}/analyze/geospatial")
async def analyze_geospatial_data(
    project_id: str,
    lat_column: str,
    lon_column: str,
    value_column: Optional[str] = None,
    max_distance_km: float = 10.0,
    n_clusters: int = 5,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive geospatial analysis on project data.

    Args:
        project_id: Project identifier
        lat_column: Name of latitude column
        lon_column: Name of longitude column
        value_column: Optional value column for weighted analysis
        max_distance_km: Maximum distance for spatial autocorrelation
        n_clusters: Number of location clusters to create
        db: Database session

    Returns:
        Geospatial analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Check if required columns exist
        if lat_column not in df.columns or lon_column not in df.columns:
            return AnalyticsUtils.format_api_response(
                'error', None, f'Required columns {lat_column} or {lon_column} not found'
            )
        
        results = {}
        
        # Spatial distribution analysis
        results['spatial_distribution'] = analyze_spatial_distribution(
            df, lat_column, lon_column, value_column
        )
        
        # Spatial autocorrelation
        if value_column and value_column in df.columns:
            results['spatial_autocorrelation'] = calculate_spatial_autocorrelation(
                df, lat_column, lon_column, value_column, max_distance_km
            )
        
        # Location clustering
        clustered_df = create_location_clusters(df, lat_column, lon_column, n_clusters)
        results['location_clusters'] = {
            'n_clusters': n_clusters,
            'cluster_summary': clustered_df['location_cluster'].value_counts().to_dict()
        }
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'geospatial_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "geospatial analysis")

@router.post("/project/{project_id}/analyze/temporal")
async def analyze_temporal_data(
    project_id: str,
    date_column: str,
    value_columns: Optional[List[str]] = None,
    detect_seasonal: bool = True,
    seasonal_period: Optional[int] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive temporal analysis on project data.
    
    Args:
        project_id: Project identifier
        date_column: Name of date/datetime column
        value_columns: List of value columns to analyze
        detect_seasonal: Whether to perform seasonality detection
        seasonal_period: Period for seasonality analysis (auto-detect if None)
        db: Database session
        
    Returns:
        Temporal analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Check if date column exists
        if date_column not in df.columns:
            return AnalyticsUtils.format_api_response(
                'error', None, f'Date column {date_column} not found'
            )
        
        results = {}
        
        # Temporal patterns analysis
        results['temporal_patterns'] = analyze_temporal_patterns(
            df, date_column, value_columns
        )
        
        # Time series statistics
        if value_columns is None:
            value_columns = df.select_dtypes(include=['number']).columns.tolist()
        
        for col in value_columns:
            if col in df.columns:
                # Convert to datetime index for time series analysis
                temp_df = df[[date_column, col]].dropna()
                temp_df[date_column] = pd.to_datetime(temp_df[date_column])
                temp_df = temp_df.set_index(date_column).sort_index()
                
                results[f'{col}_time_series'] = calculate_time_series_stats(
                    temp_df[col], temp_df.index
                )
                
                # Seasonality detection
                if detect_seasonal:
                    results[f'{col}_seasonality'] = detect_seasonality(
                        temp_df[col], temp_df.index, seasonal_period
                    )
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'temporal_analysis',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "temporal analysis")

@router.post("/project/{project_id}/analyze/cross-tabulation")
async def analyze_cross_tabulation_data(
    project_id: str,
    var1: str,
    var2: str,
    normalize: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run cross-tabulation analysis between two categorical variables.
    
    Args:
        project_id: Project identifier
        var1: First categorical variable (rows)
        var2: Second categorical variable (columns)
        normalize: How to normalize ('index', 'columns', 'all', or None)
        db: Database session
        
    Returns:
        Cross-tabulation analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Check if variables exist
        if var1 not in df.columns or var2 not in df.columns:
            return AnalyticsUtils.format_api_response(
                'error', None, f'Variables {var1} or {var2} not found'
            )
        
        # Perform cross-tabulation analysis
        results = analyze_cross_tabulation(df, var1, var2, normalize)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'cross_tabulation',
            'var1': var1,
            'var2': var2,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "cross-tabulation analysis")

@router.post("/project/{project_id}/analyze/normality")
async def test_normality_data(
    project_id: str,
    variables: Optional[List[str]] = None,
    alpha: float = 0.05,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run normality tests on numeric variables.
    
    Args:
        project_id: Project identifier
        variables: List of variables to test (all numeric if None)
        alpha: Significance level for tests
        db: Database session
        
    Returns:
        Normality test results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Select variables
        if variables is None:
            variables = df.select_dtypes(include=['number']).columns.tolist()
        
        results = {}
        for var in variables:
            if var in df.columns and pd.api.types.is_numeric_dtype(df[var]):
                results[var] = test_normality(df[var], alpha)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'normality_tests',
            'alpha': alpha,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "normality testing")

@router.post("/project/{project_id}/analyze/distribution-fitting")
async def fit_distributions_data(
    project_id: str,
    variables: Optional[List[str]] = None,
    distributions: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Fit various statistical distributions to numeric variables.
    
    Args:
        project_id: Project identifier
        variables: List of variables to analyze (all numeric if None)
        distributions: List of distributions to fit
        db: Database session
        
    Returns:
        Distribution fitting results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Select variables
        if variables is None:
            variables = df.select_dtypes(include=['number']).columns.tolist()
        
        results = {}
        for var in variables:
            if var in df.columns and pd.api.types.is_numeric_dtype(df[var]):
                results[var] = fit_distribution(df[var], distributions)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'distribution_fitting',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "distribution fitting")

@router.post("/project/{project_id}/analyze/weighted-statistics")
async def calculate_weighted_statistics(
    project_id: str,
    value_column: str,
    weight_column: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate weighted statistics for a value column.
    
    Args:
        project_id: Project identifier
        value_column: Column containing values
        weight_column: Column containing weights
        db: Database session
        
    Returns:
        Weighted statistics results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Check if columns exist
        if value_column not in df.columns or weight_column not in df.columns:
            return AnalyticsUtils.format_api_response(
                'error', None, f'Columns {value_column} or {weight_column} not found'
            )
        
        # Calculate weighted statistics
        results = calculate_weighted_stats(df, value_column, weight_column)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'weighted_statistics',
            'value_column': value_column,
            'weight_column': weight_column,
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "weighted statistics")

@router.post("/project/{project_id}/analyze/grouped-statistics")
async def calculate_grouped_statistics(
    project_id: str,
    group_by: Union[str, List[str]],
    target_columns: Optional[List[str]] = None,
    stats_functions: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate statistics grouped by categorical variables.
    
    Args:
        project_id: Project identifier
        group_by: Column(s) to group by
        target_columns: Columns to calculate statistics for
        stats_functions: List of statistics to calculate
        db: Database session
        
    Returns:
        Grouped statistics results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Check if group columns exist
        group_cols = [group_by] if isinstance(group_by, str) else group_by
        missing_cols = [col for col in group_cols if col not in df.columns]
        if missing_cols:
            return AnalyticsUtils.format_api_response(
                'error', None, f'Grouping columns not found: {missing_cols}'
            )
        
        # Calculate grouped statistics
        results = calculate_grouped_stats(df, group_by, target_columns, stats_functions)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'grouped_statistics',
            'group_by': group_by,
            'results': results.to_dict() if hasattr(results, 'to_dict') else results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "grouped statistics")

@router.post("/project/{project_id}/analyze/missing-patterns")
async def analyze_missing_patterns(
    project_id: str,
    max_patterns: int = 20,
    group_column: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Analyze patterns in missing data.
    
    Args:
        project_id: Project identifier
        max_patterns: Maximum number of patterns to return
        group_column: Optional column to group missing analysis by
        db: Database session
        
    Returns:
        Missing data patterns analysis
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        results = {}
        
        # Missing patterns
        results['patterns'] = get_missing_patterns(df, max_patterns)
        
        # Missing correlations
        results['correlations'] = calculate_missing_correlations(df)
        if hasattr(results['correlations'], 'to_dict'):
            results['correlations'] = results['correlations'].to_dict()
        
        # Heatmap data
        results['heatmap_data'] = create_missing_data_heatmap(df)
        
        # Grouped missing analysis
        if group_column and group_column in df.columns:
            results['grouped_analysis'] = analyze_missing_by_group(df, group_column)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'missing_patterns',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "missing patterns analysis")

@router.post("/project/{project_id}/analyze/diversity-metrics")
async def calculate_diversity_metrics_data(
    project_id: str,
    variables: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate diversity metrics for categorical variables.
    
    Args:
        project_id: Project identifier
        variables: List of categorical variables (all categorical if None)
        db: Database session
        
    Returns:
        Diversity metrics results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Select categorical variables
        if variables is None:
            variables = df.select_dtypes(include=['object', 'category']).columns.tolist()
        
        results = {}
        for var in variables:
            if var in df.columns:
                value_counts = df[var].value_counts()
                results[var] = calculate_diversity_metrics(value_counts)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'diversity_metrics',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "diversity metrics calculation")

@router.post("/project/{project_id}/analyze/categorical-associations")
async def analyze_categorical_associations_data(
    project_id: str,
    variables: Optional[List[str]] = None,
    method: str = 'cramers_v',
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Calculate pairwise associations between categorical variables.
    
    Args:
        project_id: Project identifier
        variables: List of categorical variables
        method: Association measure ('cramers_v' or 'theil_u')
        db: Database session
        
    Returns:
        Categorical associations results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Calculate associations
        associations = analyze_categorical_associations(df, variables, method)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'analysis_type': 'categorical_associations',
            'method': method,
            'results': associations.to_dict() if hasattr(associations, 'to_dict') else associations
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "categorical associations analysis")

@router.post("/project/{project_id}/generate-executive-summary")
async def generate_executive_summary_report(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate an executive summary of the project data.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Executive summary report
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Generate executive summary
        results = generate_executive_summary(df)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'report_type': 'executive_summary',
            'results': results
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "executive summary generation")

@router.post("/project/{project_id}/export-report")
async def export_analysis_report(
    project_id: str,
    format: str = 'json',
    analysis_type: str = 'comprehensive',
    include_metadata: bool = True,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Export analysis results in various formats.
    
    Args:
        project_id: Project identifier
        format: Export format ('json', 'html', 'markdown')
        analysis_type: Type of analysis to export
        include_metadata: Include analysis metadata
        db: Database session
        
    Returns:
        Exported report in specified format
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', None, 'No data available for analysis'
            )
        
        # Generate analysis results
        if analysis_type == 'executive':
            analysis_results = generate_executive_summary(df)
        else:
            analysis_results = generate_full_report(df, project_name=f"Project {project_id}")
        
        # Export in specified format
        exported_content = export_statistics(analysis_results, format, include_metadata)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'export_format': format,
            'analysis_type': analysis_type,
            'content': exported_content
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "report export")

@router.get("/analysis-types")
async def get_descriptive_analysis_types() -> Dict[str, Any]:
    """
    Get available descriptive analysis types and methods.
    
    Returns:
        Available descriptive analysis types
    """
    try:
        analysis_types = {
            'descriptive_analysis_types': {
                'basic_statistics': {
                    'description': 'Basic statistical analysis (means, medians, standard deviations)',
                    'includes': ['basic_statistics', 'percentiles', 'correlations', 'covariances']
                },
                'distributions': {
                    'description': 'Distribution analysis for numeric variables',
                    'includes': ['normality_tests', 'skewness_kurtosis', 'distribution_fitting']
                },
                'categorical': {
                    'description': 'Categorical variable analysis',
                    'includes': ['frequency_analysis', 'cross_tabulations', 'chi_square_tests', 'diversity_metrics']
                },
                'outliers': {
                    'description': 'Outlier detection using multiple methods',
                    'methods': ['iqr', 'zscore', 'isolation_forest', 'mad']
                },
                'missing_data': {
                    'description': 'Missing data pattern analysis',
                    'includes': ['missing_patterns', 'missing_correlations', 'heatmap_data']
                },
                'data_quality': {
                    'description': 'Data quality assessment',
                    'includes': ['completeness', 'consistency', 'validity']
                },
                'geospatial': {
                    'description': 'Spatial analysis for location-based data',
                    'includes': ['spatial_distribution', 'spatial_autocorrelation', 'location_clustering']
                },
                'temporal': {
                    'description': 'Time-based analysis and trends',
                    'includes': ['temporal_patterns', 'time_series_stats', 'seasonality_detection']
                },
                'weighted_statistics': {
                    'description': 'Weighted statistical analysis',
                    'includes': ['weighted_mean', 'weighted_variance', 'weighted_median']
                },
                'grouped_statistics': {
                    'description': 'Statistics grouped by categorical variables',
                    'includes': ['group_by_analysis', 'comparative_statistics']
                },
                'cross_tabulation': {
                    'description': 'Cross-tabulation analysis between categorical variables',
                    'includes': ['contingency_tables', 'chi_square_tests', 'association_measures']
                },
                'normality_testing': {
                    'description': 'Comprehensive normality testing',
                    'methods': ['shapiro_wilk', 'dagostino_pearson', 'kolmogorov_smirnov', 'anderson_darling']
                },
                'distribution_fitting': {
                    'description': 'Fit statistical distributions to data',
                    'distributions': ['normal', 'lognormal', 'exponential', 'gamma', 'beta', 'uniform']
                },
                'diversity_metrics': {
                    'description': 'Diversity metrics for categorical data',
                    'metrics': ['shannon_entropy', 'simpson_index', 'gini_simpson', 'evenness']
                },
                'categorical_associations': {
                    'description': 'Association measures between categorical variables',
                    'methods': ['cramers_v', 'theil_u']
                },
                'comprehensive_report': {
                    'description': 'Full comprehensive report with all descriptive analyses',
                    'includes': ['all_above']
                },
                'executive_summary': {
                    'description': 'Executive summary with key insights and recommendations',
                    'includes': ['overview', 'key_insights', 'recommendations']
                }
            },
            'outlier_detection_methods': {
                'iqr': 'Interquartile Range method',
                'zscore': 'Z-score method (assumes normal distribution)',
                'isolation_forest': 'Isolation Forest algorithm (for larger datasets)',
                'mad': 'Median Absolute Deviation method (robust to non-normal data)'
            },
            'export_formats': {
                'json': 'JSON format for programmatic access',
                'html': 'HTML format for web display',
                'markdown': 'Markdown format for documentation'
            },
            'analysis_scopes': {
                'basic': 'Basic statistics and quality checks',
                'comprehensive': 'Full statistical analysis including advanced methods',
                'quality': 'Focus on data quality assessment',
                'auto': 'Automatic method selection based on data characteristics'
            }
        }
        
        return AnalyticsUtils.format_api_response('success', analysis_types)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting descriptive analysis types")

@router.get("/endpoints")
async def get_descriptive_endpoints() -> Dict[str, Any]:
    """
    Get all available descriptive analytics endpoints.
    
    Returns:
        List of all descriptive analytics endpoints
    """
    try:
        endpoints = {
            'descriptive_analytics_endpoints': {
                # Basic Analysis Endpoints
                'POST /project/{project_id}/analyze/basic-statistics': 'Run basic statistical analysis',
                'POST /project/{project_id}/analyze/distributions': 'Run distribution analysis',
                'POST /project/{project_id}/analyze/categorical': 'Run categorical analysis',
                'POST /project/{project_id}/analyze/outliers': 'Run outlier detection',
                'POST /project/{project_id}/analyze/missing-data': 'Run missing data analysis',
                'POST /project/{project_id}/analyze/data-quality': 'Run data quality analysis',
                'POST /project/{project_id}/analyze/descriptive': 'Run comprehensive descriptive analysis',
                
                # Advanced Analysis Endpoints
                'POST /project/{project_id}/analyze/geospatial': 'Run geospatial analysis with spatial distribution and clustering',
                'POST /project/{project_id}/analyze/temporal': 'Run temporal analysis with time series and seasonality detection',
                'POST /project/{project_id}/analyze/cross-tabulation': 'Run cross-tabulation analysis between categorical variables',
                'POST /project/{project_id}/analyze/normality': 'Run comprehensive normality tests on numeric variables',
                'POST /project/{project_id}/analyze/distribution-fitting': 'Fit statistical distributions to numeric data',
                'POST /project/{project_id}/analyze/weighted-statistics': 'Calculate weighted statistics for value columns',
                'POST /project/{project_id}/analyze/grouped-statistics': 'Calculate statistics grouped by categorical variables',
                'POST /project/{project_id}/analyze/missing-patterns': 'Analyze patterns and correlations in missing data',
                'POST /project/{project_id}/analyze/diversity-metrics': 'Calculate diversity metrics for categorical variables',
                'POST /project/{project_id}/analyze/categorical-associations': 'Calculate pairwise associations between categorical variables',
                
                # Report Generation Endpoints
                'POST /project/{project_id}/generate-report': 'Generate comprehensive descriptive statistics report',
                'POST /project/{project_id}/generate-executive-summary': 'Generate executive summary with key insights',
                'POST /project/{project_id}/export-report': 'Export analysis results in various formats (JSON, HTML, Markdown)',
                
                # Data Exploration Endpoints
                'GET /project/{project_id}/explore-data': 'Explore project data with filtering and pagination',
                'GET /project/{project_id}/data-summary': 'Get quick data summary with overview statistics',
                
                # Metadata Endpoints
                'GET /analysis-types': 'Get available descriptive analysis types and methods',
                'GET /endpoints': 'Get all descriptive analytics endpoints'
            },
            'endpoint_categories': {
                'basic_analysis': [
                    'basic-statistics', 'distributions', 'categorical', 'outliers',
                    'missing-data', 'data-quality', 'descriptive'
                ],
                'advanced_analysis': [
                    'geospatial', 'temporal', 'cross-tabulation', 'normality',
                    'distribution-fitting', 'weighted-statistics', 'grouped-statistics',
                    'missing-patterns', 'diversity-metrics', 'categorical-associations'
                ],
                'reporting': [
                    'generate-report', 'generate-executive-summary', 'export-report'
                ],
                'exploration': [
                    'explore-data', 'data-summary'
                ],
                'metadata': [
                    'analysis-types', 'endpoints'
                ]
            },
            'parameter_requirements': {
                'geospatial': ['lat_column', 'lon_column'],
                'temporal': ['date_column'],
                'cross_tabulation': ['var1', 'var2'],
                'weighted_statistics': ['value_column', 'weight_column'],
                'grouped_statistics': ['group_by'],
                'export_report': ['format']
            },
            'optional_parameters': {
                'geospatial': ['value_column', 'max_distance_km', 'n_clusters'],
                'temporal': ['value_columns', 'detect_seasonal', 'seasonal_period'],
                'cross_tabulation': ['normalize'],
                'normality': ['variables', 'alpha'],
                'distribution_fitting': ['variables', 'distributions'],
                'grouped_statistics': ['target_columns', 'stats_functions'],
                'missing_patterns': ['max_patterns', 'group_column'],
                'diversity_metrics': ['variables'],
                'categorical_associations': ['variables', 'method'],
                'export_report': ['analysis_type', 'include_metadata']
            }
        }
        
        return AnalyticsUtils.format_api_response('success', endpoints)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting descriptive endpoints") 