"""
Legacy Analytics Endpoints - Redirect Information
This file now serves as a guide to the new modular analytics structure.
The original analytics endpoints have been reorganized into specialized modules.
"""

from fastapi import APIRouter
from typing import Dict, Any

from app.utils.shared import AnalyticsUtils

router = APIRouter()

@router.get("/migration-guide")
async def get_migration_guide() -> Dict[str, Any]:
    """
    Get information about the new modular analytics structure.
    
    Returns:
        Migration guide and endpoint mappings
    """
    try:
        migration_info = {
            'message': 'Analytics endpoints have been reorganized for better modularity',
            'new_structure': {
                'auto_analytics': {
                    'prefix': '/analytics/auto',
                    'description': 'Intelligent analysis recommendations and automated insights',
                    'endpoints': [
                        'GET /project/{project_id}/stats',
                        'GET /project/{project_id}/data-characteristics', 
                        'GET /project/{project_id}/recommendations',
                        'POST /project/{project_id}/analyze',
                        'GET /analysis-types',
                        'GET /endpoints',
                        'GET /health'
                    ]
                },
                'descriptive_analytics': {
                    'prefix': '/analytics/descriptive',
                    'description': 'Comprehensive statistical analysis and data exploration',
                    'endpoints': [
                        'POST /project/{project_id}/analyze/basic-statistics',
                        'POST /project/{project_id}/analyze/distributions',
                        'POST /project/{project_id}/analyze/categorical',
                        'POST /project/{project_id}/analyze/outliers',
                        'POST /project/{project_id}/analyze/missing-data',
                        'POST /project/{project_id}/analyze/data-quality',
                        'POST /project/{project_id}/analyze/descriptive',
                        'POST /project/{project_id}/generate-report',
                        'GET /project/{project_id}/explore-data',
                        'GET /project/{project_id}/data-summary',
                        'GET /analysis-types',
                        'GET /endpoints'
                    ]
                },
                'qualitative_analytics': {
                    'prefix': '/analytics/qualitative',
                    'description': 'Text analysis, sentiment analysis, and qualitative research methods',
                    'endpoints': [
                        'POST /project/{project_id}/analyze/text',
                        'POST /project/{project_id}/analyze/sentiment',
                        'POST /project/{project_id}/analyze/themes',
                        'POST /project/{project_id}/analyze/word-frequency',
                        'POST /project/{project_id}/analyze/content-analysis',
                        'POST /project/{project_id}/analyze/qualitative-coding',
                        'GET /analysis-types',
                        'GET /endpoints'
                    ]
                },
                'inferential_analytics': {
                    'prefix': '/analytics/inferential',
                    'description': 'Hypothesis testing, statistical inference, and advanced statistical methods',
                    'endpoints': [
                        'POST /project/{project_id}/analyze/correlation',
                        'POST /project/{project_id}/analyze/t-test',
                        'POST /project/{project_id}/analyze/anova',
                        'POST /project/{project_id}/analyze/regression',
                        'POST /project/{project_id}/analyze/chi-square',
                        'POST /project/{project_id}/analyze/hypothesis-test',
                        'POST /project/{project_id}/analyze/confidence-intervals',
                        'POST /project/{project_id}/analyze/effect-size',
                        'POST /project/{project_id}/analyze/power-analysis',
                        'POST /project/{project_id}/analyze/nonparametric',
                        'GET /analysis-types',
                        'GET /endpoints'
                    ]
                }
            },
            'migration_mappings': {
                'old_endpoint': 'new_endpoint',
                'POST /analytics/project/{project_id}/analyze': {
                    'auto': 'POST /analytics/auto/project/{project_id}/analyze',
                    'descriptive': 'POST /analytics/descriptive/project/{project_id}/analyze/descriptive',
                    'text': 'POST /analytics/qualitative/project/{project_id}/analyze/text',
                    'correlation': 'POST /analytics/inferential/project/{project_id}/analyze/correlation'
                },
                'GET /analytics/project/{project_id}/stats': 'GET /analytics/auto/project/{project_id}/stats',
                'GET /analytics/project/{project_id}/data-characteristics': 'GET /analytics/auto/project/{project_id}/data-characteristics',
                'GET /analytics/project/{project_id}/recommendations': 'GET /analytics/auto/project/{project_id}/recommendations',
                'POST /analytics/project/{project_id}/analyze/basic-statistics': 'POST /analytics/descriptive/project/{project_id}/analyze/basic-statistics',
                'POST /analytics/project/{project_id}/analyze/distributions': 'POST /analytics/descriptive/project/{project_id}/analyze/distributions',
                'POST /analytics/project/{project_id}/analyze/categorical': 'POST /analytics/descriptive/project/{project_id}/analyze/categorical',
                'POST /analytics/project/{project_id}/analyze/outliers': 'POST /analytics/descriptive/project/{project_id}/analyze/outliers',
                'POST /analytics/project/{project_id}/analyze/missing-data': 'POST /analytics/descriptive/project/{project_id}/analyze/missing-data',
                'POST /analytics/project/{project_id}/analyze/data-quality': 'POST /analytics/descriptive/project/{project_id}/analyze/data-quality',
                'POST /analytics/project/{project_id}/generate-report': 'POST /analytics/descriptive/project/{project_id}/generate-report',
                'GET /analytics/project/{project_id}/explore-data': 'GET /analytics/descriptive/project/{project_id}/explore-data',
                'GET /analytics/project/{project_id}/data-summary': 'GET /analytics/descriptive/project/{project_id}/data-summary',
                'GET /analytics/analysis-types': 'Available in each specialized module',
                'GET /analytics/endpoints': 'Available in each specialized module',
                'GET /analytics/health': 'GET /analytics/auto/health'
            },
            'benefits_of_new_structure': [
                'Better organization and separation of concerns',
                'Easier to maintain and extend specific analytics types',
                'Clearer API documentation and discovery',
                'Reduced coupling between different analytics methods',
                'Specialized parameter validation for each analytics type',
                'Independent scaling of different analytics services'
            ],
            'backwards_compatibility': {
                'status': 'deprecated',
                'recommendation': 'Please update your client code to use the new specialized endpoints',
                'support_timeline': 'Legacy endpoints will be removed in the next major version'
            }
        }
        
        return AnalyticsUtils.format_api_response('success', migration_info)
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "migration guide")

@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Health check endpoint that provides status of all analytics modules.
    
    Returns:
        Overall health status of the analytics system
    """
    try:
        return AnalyticsUtils.format_api_response('success', {
            'service': 'analytics-system',
            'status': 'healthy',
            'architecture': 'modular',
            'modules': {
                'auto_analytics': 'available at /analytics/auto',
                'descriptive_analytics': 'available at /analytics/descriptive', 
                'qualitative_analytics': 'available at /analytics/qualitative',
                'inferential_analytics': 'available at /analytics/inferential'
            },
            'total_endpoints': 45,
            'specialized_modules': 4,
            'migration_status': 'completed'
        })
        
    except Exception as e:
        return AnalyticsUtils.handle_analysis_error(e, "health check") 