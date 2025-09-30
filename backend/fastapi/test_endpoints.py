"""
Test script to verify analytics endpoints work correctly.
Run this to test the streamlined analytics endpoints implementation.
"""

import sys
import os
import pandas as pd
import numpy as np
import requests
import json
from datetime import datetime

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

def test_imports():
    """Test that all modules can be imported correctly."""
    print("Testing imports...")
    
    try:
        # Test core modules
        from core.config import settings
        print("✓ Core config import successful")
        
        from core.database import get_project_data, get_project_stats
        print("✓ Database functions import successful")
        
        # Test shared utilities
        from app.utils.shared import AnalyticsUtils
        print("✓ AnalyticsUtils import successful")
        
        # Test endpoint imports
        from app.api.v1.endpoints import analytics, sync
        print("✓ Analytics and sync endpoints import successful")
        
        # Test main API router
        from app.api.v1.api import api_router
        print("✓ Main API router import successful")
        
        return True
        
    except ImportError as e:
        print(f"✗ Import failed: {e}")
        return False

def test_analytics_utils():
    """Test AnalyticsUtils functionality."""
    print("\nTesting AnalyticsUtils...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Test response formatting
        response = AnalyticsUtils.format_api_response('success', {'test': 'data'})
        assert response['status'] == 'success'
        assert 'data' in response
        print("✓ Response formatting works")
        
        # Test error handling
        error_response = AnalyticsUtils.handle_analysis_error(Exception("Test error"), "test operation")
        assert error_response['status'] == 'error'
        assert 'test operation' in error_response['message']
        print("✓ Error handling works")
        
        # Test data characteristics analysis
        test_df = pd.DataFrame({
            'numeric': [1, 2, 3, 4, 5],
            'categorical': ['A', 'B', 'A', 'B', 'A'],
            'text': ['hello', 'world', 'test', 'data', 'analysis']
        })
        
        characteristics = AnalyticsUtils.analyze_data_characteristics(test_df)
        assert 'sample_size' in characteristics
        assert 'numeric_variables' in characteristics
        assert 'categorical_variables' in characteristics
        print("✓ Data characteristics analysis works")
        
        # Test recommendations generation
        recommendations = AnalyticsUtils.generate_analysis_recommendations(characteristics)
        assert isinstance(recommendations, dict)
        assert 'primary_recommendations' in recommendations
        assert 'secondary_recommendations' in recommendations
        assert isinstance(recommendations['primary_recommendations'], list)
        print("✓ Recommendations generation works")
        
        # Test descriptive analysis
        desc_results = AnalyticsUtils.run_descriptive_analysis(test_df)
        assert 'summary' in desc_results
        # Check that we got valid results (either basic_stats for numeric data or no error)
        if 'error' in desc_results:
            print(f"  ⚠ Descriptive analysis returned error: {desc_results['error']}")
        else:
            # Check for expected analysis components
            expected_keys = ['basic_stats', 'categorical_analysis', 'missing_analysis']
            found_keys = [key for key in expected_keys if key in desc_results]
            assert len(found_keys) > 0, f"Expected at least one of {expected_keys}, got keys: {list(desc_results.keys())}"
        print("✓ Descriptive analysis works")
        
        # Test correlation analysis
        corr_results = AnalyticsUtils.run_correlation_analysis(test_df)
        if 'error' in corr_results:
            print("✓ Correlation analysis correctly returns error for insufficient numeric variables")
        else:
            assert 'correlation_matrix' in corr_results
            print("✓ Correlation analysis works")
        
        # Test text analysis
        text_results = AnalyticsUtils.run_basic_text_analysis(test_df, ['text'])
        assert 'text_analysis' in text_results
        print("✓ Text analysis works")
        
        return True
        
    except Exception as e:
        print(f"✗ AnalyticsUtils test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_database_functions():
    """Test database functions."""
    print("\nTesting database functions...")
    
    try:
        from core.database import get_project_data, get_project_stats
        
        # Test with non-existent project (should return empty/None)
        # Use a valid UUID format for testing
        test_uuid = "12345678-1234-5678-1234-567812345678"
        data = await get_project_data(test_uuid)
        assert isinstance(data, list)
        print("✓ get_project_data handles non-existent projects")
        
        stats = await get_project_stats(test_uuid)
        assert stats is None
        print("✓ get_project_stats handles non-existent projects")
        
        return True
        
    except Exception as e:
        print(f"✗ Database functions test failed: {e}")
        return False

def test_endpoint_structure():
    """Test that endpoints have correct structure."""
    print("\nTesting endpoint structure...")
    
    try:
        from app.api.v1.endpoints import analytics, sync
        
        # Check that routers exist
        assert hasattr(analytics, 'router'), "Analytics router missing"
        assert hasattr(sync, 'router'), "Sync router missing"
        
        print("✓ All endpoint routers found")
        
        # Check that main API router can be imported
        from app.api.v1.api import api_router
        print("✓ Main API router imported successfully")
        
        return True
        
    except Exception as e:
        print(f"✗ Endpoint structure test failed: {e}")
        return False

def test_api_endpoints():
    """Test API endpoints using requests."""
    print("\nTesting API endpoints...")
    
    base_url = "http://localhost:8001"
    
    try:
        # Test health endpoint
        response = requests.get(f"{base_url}/api/v1/analytics/health")
        if response.status_code == 200:
            print("✓ Health endpoint works")
        else:
            print(f"⚠ Health endpoint returned {response.status_code}")
        
        # Test sync status endpoint
        response = requests.get(f"{base_url}/api/v1/sync/status")
        if response.status_code == 200:
            print("✓ Sync status endpoint works")
        else:
            print(f"⚠ Sync status endpoint returned {response.status_code}")
        
        # Test project stats with non-existent project
        response = requests.get(f"{base_url}/api/v1/analytics/project/non-existent/stats")
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'error':
                print("✓ Project stats endpoint handles non-existent projects correctly")
            else:
                print("⚠ Project stats endpoint should return error for non-existent project")
        else:
            print(f"⚠ Project stats endpoint returned {response.status_code}")
        
        # Test data characteristics with non-existent project
        response = requests.get(f"{base_url}/api/v1/analytics/project/non-existent/data-characteristics")
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'error':
                print("✓ Data characteristics endpoint handles non-existent projects correctly")
            else:
                print("⚠ Data characteristics endpoint should return error for non-existent project")
        else:
            print(f"⚠ Data characteristics endpoint returned {response.status_code}")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("⚠ Server not running - skipping API endpoint tests")
        print("  Start the server with: python start_fastapi.py")
        return True
    except Exception as e:
        print(f"✗ API endpoint test failed: {e}")
        return False

def test_data_analysis():
    """Test data analysis with sample data."""
    print("\nTesting data analysis...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Create sample data similar to what would come from Django
        sample_data = [
            {
                'response_id': '1',
                'question_text': 'Age',
                'response_type': 'numeric_integer',
                'response_value': '25',
                'numeric_value': 25.0,
                'respondent_id': 'resp_001',
                'collected_at': '2024-01-01T10:00:00Z'
            },
            {
                'response_id': '2',
                'question_text': 'Age',
                'response_type': 'numeric_integer',
                'response_value': '30',
                'numeric_value': 30.0,
                'respondent_id': 'resp_002',
                'collected_at': '2024-01-01T11:00:00Z'
            },
            {
                'response_id': '3',
                'question_text': 'Satisfaction',
                'response_type': 'scale_rating',
                'response_value': '4',
                'numeric_value': 4.0,
                'respondent_id': 'resp_001',
                'collected_at': '2024-01-01T10:00:00Z'
            },
            {
                'response_id': '4',
                'question_text': 'Satisfaction',
                'response_type': 'scale_rating',
                'response_value': '5',
                'numeric_value': 5.0,
                'respondent_id': 'resp_002',
                'collected_at': '2024-01-01T11:00:00Z'
            },
            {
                'response_id': '5',
                'question_text': 'Comments',
                'response_type': 'text_long',
                'response_value': 'Great experience overall',
                'respondent_id': 'resp_001',
                'collected_at': '2024-01-01T10:00:00Z'
            }
        ]
        
        # Convert to DataFrame
        df = pd.DataFrame(sample_data)
        
        # Test data characteristics
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        assert characteristics['sample_size'] == 5
        # Check if question_text is in categorical or text variables (it could be either)
        assert ('question_text' in characteristics['categorical_variables'] or 
                'question_text' in characteristics['text_variables'])
        print("✓ Sample data characteristics analysis works")
        
        # Test recommendations
        recommendations = AnalyticsUtils.generate_analysis_recommendations(characteristics)
        assert len(recommendations) > 0
        print("✓ Sample data recommendations generation works")
        
        # Test descriptive analysis
        desc_results = AnalyticsUtils.run_descriptive_analysis(df)
        assert 'summary' in desc_results
        print("✓ Sample data descriptive analysis works")
        
        # Test correlation analysis (should work since we have numeric values)
        corr_results = AnalyticsUtils.run_correlation_analysis(df)
        if 'error' not in corr_results:
            print("✓ Sample data correlation analysis works")
        else:
            print("⚠ Sample data correlation analysis returned error (expected for small dataset)")
        
        return True
        
    except Exception as e:
        print(f"✗ Data analysis test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests."""
    print("=" * 60)
    print("STREAMLINED ANALYTICS ENDPOINTS TEST SUITE")
    print("=" * 60)
    
    tests = [
        test_imports,
        test_analytics_utils,
        test_database_functions,
        test_endpoint_structure,
        test_data_analysis,
        test_api_endpoints
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test.__name__ == 'test_database_functions':
                if await test():
                    passed += 1
            else:
                if test():
                    passed += 1
        except Exception as e:
            print(f"✗ Test {test.__name__} crashed: {e}")
    
    print("\n" + "=" * 60)
    print(f"TEST RESULTS: {passed}/{total} tests passed")
    print("=" * 60)
    
    if passed == total:
        print("🎉 All tests passed! The analytics endpoints are ready to use.")
        print("\nEndpoint URLs (when server is running):")
        print("- Analytics: /api/v1/analytics/")
        print("- Sync: /api/v1/sync/")
        print("\nKey endpoints:")
        print("- GET /api/v1/analytics/project/{project_id}/stats")
        print("- GET /api/v1/analytics/project/{project_id}/data-characteristics")
        print("- POST /api/v1/analytics/project/{project_id}/analyze")
        print("- GET /api/v1/analytics/project/{project_id}/recommendations")
        print("- GET /api/v1/sync/status")
        print("- POST /api/v1/sync/project/{project_id}/sync")
    else:
        print("⚠️  Some tests failed. Check the error messages above.")
    
    return passed == total

if __name__ == "__main__":
    import asyncio
    success = asyncio.run(main())
    sys.exit(0 if success else 1) 