"""
Auto-Detection Analytics Endpoints
Handles intelligent analysis recommendations and automated insights.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import pandas as pd
from asgiref.sync import sync_to_async

from core.database import get_db
from app.utils.shared import AnalyticsUtils

router = APIRouter()

@router.get("/project/{project_id}/stats")
async def get_project_stats(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get basic project statistics.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Project statistics
    """
    try:
        stats = await AnalyticsUtils.get_project_stats(project_id)
        return AnalyticsUtils.format_api_response('success', stats)
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "project stats")

@router.get("/project/{project_id}/data-characteristics")
async def get_data_characteristics(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get data characteristics for a project.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Data characteristics and analysis recommendations
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', 
                None, 
                'No data available for this project'
            )
        
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        recommendations = AnalyticsUtils.generate_analysis_recommendations(characteristics)
        
        return AnalyticsUtils.format_api_response('success', {
            'characteristics': characteristics,
            'recommendations': recommendations
        })
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "data characteristics")

@router.get("/project/{project_id}/recommendations")
async def get_analysis_recommendations(
    project_id: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get smart analysis recommendations for a project.
    
    Args:
        project_id: Project identifier
        db: Database session
        
    Returns:
        Analysis recommendations
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', 
                None, 
                'No data available for recommendations'
            )
        
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        recommendations = AnalyticsUtils.generate_analysis_recommendations(characteristics)
        
        return AnalyticsUtils.format_api_response('success', {
            'project_id': project_id,
            'recommendations': recommendations,
            'data_summary': {
                'sample_size': characteristics.get('sample_size', 0),
                'variables': characteristics.get('variable_count', 0),
                'data_quality': characteristics.get('completeness_score', 0)
            }
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "recommendations")

@router.post("/project/{project_id}/analyze")
async def analyze_project_data(
    project_id: str,
    analysis_type: str = "auto",
    target_variables: Optional[List[str]] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Run comprehensive auto-detection analysis on project data.
    
    Args:
        project_id: Project identifier
        analysis_type: Type of analysis (auto, comprehensive)
        target_variables: Optional list of specific variables to analyze
        db: Database session
        
    Returns:
        Analysis results
    """
    try:
        df = await AnalyticsUtils.get_project_data(project_id)
        
        if df.empty:
            return AnalyticsUtils.format_api_response(
                'error', 
                None, 
                'No data available for analysis'
            )
        
        # Get data characteristics first
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        results = {
            'project_id': project_id,
            'analysis_type': analysis_type,
            'data_characteristics': characteristics,
            'analyses': {}
        }
        
        if analysis_type == "auto":
            # Run all applicable analyses based on data characteristics
            results['analyses']['descriptive'] = AnalyticsUtils.run_descriptive_analysis(
                df, "comprehensive", target_variables
            )
            
            if len(characteristics.get('numeric_variables', [])) >= 2:
                results['analyses']['correlation'] = AnalyticsUtils.run_correlation_analysis(df)
            
            if len(characteristics.get('text_variables', [])) >= 1:
                results['analyses']['text'] = AnalyticsUtils.run_basic_text_analysis(
                    df, characteristics['text_variables']
                )
            
            # Add missing data analysis if there's missing data
            if characteristics.get('missing_percentage', 0) > 0:
                results['analyses']['missing_data'] = AnalyticsUtils.run_missing_data_analysis(df)
        
        elif analysis_type == "comprehensive":
            results['analyses'] = {
                'comprehensive_report': AnalyticsUtils.generate_comprehensive_report(df),
                'descriptive': AnalyticsUtils.run_descriptive_analysis(df, "comprehensive"),
                'data_quality': AnalyticsUtils.run_data_quality_analysis(df)
            }
        
        else:
            return AnalyticsUtils.format_api_response(
                'error', 
                None, 
                f'Unsupported analysis type for auto-analytics: {analysis_type}. Available types: auto, comprehensive'
            )
        
        return AnalyticsUtils.format_api_response('success', results)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, f"{analysis_type} analysis")

@router.get("/analysis-types")
async def get_available_analysis_types() -> Dict[str, Any]:
    """
    Get all available analysis types and methods.
    
    Returns:
        Available analysis types and their descriptions
    """
    try:
        analysis_types = {
            'auto_analysis_types': {
                'auto': {
                    'description': 'Automatically runs all applicable analyses based on data characteristics',
                    'includes': ['descriptive', 'correlation', 'text', 'missing_data_if_needed']
                },
                'comprehensive': {
                    'description': 'Full comprehensive report with all analyses',
                    'includes': ['comprehensive_report', 'descriptive', 'data_quality']
                }
            },
            'specialized_endpoints': {
                '/descriptive/': 'Descriptive analytics endpoints',
                '/qualitative/': 'Qualitative analytics endpoints',
                '/inferential/': 'Inferential statistics endpoints'
            }
        }
        
        return AnalyticsUtils.format_api_response('success', analysis_types)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting analysis types")

@router.get("/endpoints")
async def get_autoanalytics_endpoints() -> Dict[str, Any]:
    """
    Get all available auto-analytics endpoints with their descriptions.
    
    Returns:
        List of all auto-analytics endpoints and their functionality
    """
    try:
        endpoints = {
            'auto_analytics_endpoints': {
                'GET /project/{project_id}/stats': 'Get basic project statistics',
                'GET /project/{project_id}/data-characteristics': 'Get data characteristics and recommendations',
                'GET /project/{project_id}/recommendations': 'Get smart analysis recommendations',
                'POST /project/{project_id}/analyze': 'Run comprehensive auto-detection analysis',
                'GET /analysis-types': 'Get available analysis types and methods',
                'GET /endpoints': 'Get all available auto-analytics endpoints',
                'GET /health': 'Health check for auto-analytics service'
            },
            'parameters': {
                'analysis_type': {
                    'values': ['auto', 'comprehensive'],
                    'default': 'auto',
                    'description': 'Type of auto-analysis to run'
                },
                'target_variables': {
                    'description': 'Optional list of specific variables to analyze',
                    'type': 'List[str]'
                }
            }
        }
        
        return AnalyticsUtils.format_api_response('success', endpoints)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "getting endpoints")

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint for the auto-analytics service.
    
    Returns:
        Health status
    """
    try:
        # Test database connection using sync_to_async
        @sync_to_async
        def test_db_connection():
            conn = AnalyticsUtils.get_django_db_connection()
            conn.close()
            return True
        
        await test_db_connection()
        
        return AnalyticsUtils.format_api_response('success', {
            'service': 'auto-analytics',
            'status': 'healthy',
            'database': 'connected',
            'endpoints_available': 7,
            'analysis_types_supported': 2
        })
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "health check") 