#!/usr/bin/env python3
"""
Test script to verify analytics utilities work properly.
"""

import os
import sys
import pandas as pd
import numpy as np

# Add the correct paths for both FastAPI and Django
fastapi_dir = os.path.dirname(os.path.abspath(__file__))  # backend/fastapi/
backend_dir = os.path.dirname(fastapi_dir)  # backend/
sys.path.insert(0, fastapi_dir)  # Add FastAPI to path
sys.path.insert(0, backend_dir)  # Add backend/ to path so we can import django_core

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_core.settings.development')

def test_basic_imports():
    """Test basic imports work"""
    print("Testing basic imports...")
    
    try:
        import django
        django.setup()
        print("✅ Django setup successful")
    except Exception as e:
        print(f"❌ Django setup failed: {e}")
        return False
    
    try:
        from app.utils.shared import AnalyticsUtils
        print("✅ AnalyticsUtils import successful")
    except Exception as e:
        print(f"❌ AnalyticsUtils import failed: {e}")
        return False
    
    return True

def test_data_characteristics():
    """Test data characteristics analysis"""
    print("\nTesting data characteristics analysis...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Create sample data
        df = pd.DataFrame({
            'numeric_var': np.random.normal(0, 1, 100),
            'categorical_var': np.random.choice(['A', 'B', 'C'], 100),
            'text_var': [f"This is sample text {i}" for i in range(100)],
            'datetime_var': pd.date_range('2023-01-01', periods=100)
        })
        
        # Test analysis
        characteristics = AnalyticsUtils.analyze_data_characteristics(df)
        
        print(f"✅ Data characteristics analysis successful")
        print(f"  Sample size: {characteristics['sample_size']}")
        print(f"  Variables: {characteristics['variable_count']}")
        print(f"  Numeric vars: {len(characteristics['numeric_variables'])}")
        print(f"  Categorical vars: {len(characteristics['categorical_variables'])}")
        print(f"  Text vars: {len(characteristics['text_variables'])}")
        print(f"  Completeness: {characteristics['completeness_score']:.1f}%")
        
        return True
        
    except Exception as e:
        print(f"❌ Data characteristics analysis failed: {e}")
        return False

def test_recommendations():
    """Test analysis recommendations"""
    print("\nTesting analysis recommendations...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Sample characteristics
        characteristics = {
            'sample_size': 100,
            'variable_count': 4,
            'numeric_variables': ['age', 'income'],
            'categorical_variables': ['gender', 'department'],
            'text_variables': ['comments'],
            'completeness_score': 95.0
        }
        
        # Test recommendations
        recommendations = AnalyticsUtils.generate_analysis_recommendations(characteristics)
        
        print(f"✅ Analysis recommendations successful")
        print(f"  Primary analyses: {len(recommendations['primary_analyses'])}")
        print(f"  Secondary analyses: {len(recommendations['secondary_analyses'])}")
        print(f"  Quality notes: {len(recommendations['data_quality_notes'])}")
        print(f"  Analysis priority: {recommendations['analysis_priority']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Analysis recommendations failed: {e}")
        return False

def test_descriptive_analysis():
    """Test descriptive analysis"""
    print("\nTesting descriptive analysis...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Create sample data
        df = pd.DataFrame({
            'numeric_value': np.random.normal(50, 10, 100),
            'response_type': np.random.choice(['satisfied', 'neutral', 'dissatisfied'], 100),
            'data_quality_score': np.random.uniform(0.8, 1.0, 100)
        })
        
        # Test descriptive analysis
        results = AnalyticsUtils.run_descriptive_analysis(df)
        
        print(f"✅ Descriptive analysis successful")
        print(f"  Basic statistics: {len(results.get('basic_statistics', {}))}")
        print(f"  Categorical analysis: {len(results.get('categorical_analysis', {}))}")
        print(f"  Distribution analysis: {len(results.get('distribution_analysis', {}))}")
        print(f"  Summary available: {'summary' in results}")
        
        return True
        
    except Exception as e:
        print(f"❌ Descriptive analysis failed: {e}")
        return False

def test_text_analysis():
    """Test text analysis"""
    print("\nTesting text analysis...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Create sample text data
        df = pd.DataFrame({
            'response_value': [
                "I am very happy with this service",
                "The product quality is excellent",
                "I am disappointed with the results",
                "This is an average experience",
                "Outstanding customer support"
            ]
        })
        
        # Test text analysis
        results = AnalyticsUtils.run_basic_text_analysis(df, ['response_value'])
        
        print(f"✅ Text analysis successful")
        print(f"  Sentiment analysis: {'sentiment_analysis' in results}")
        print(f"  Text statistics: {'text_statistics' in results}")
        print(f"  Word frequency: {'word_frequency' in results}")
        
        return True
        
    except Exception as e:
        print(f"❌ Text analysis failed: {e}")
        return False

def test_api_response_format():
    """Test API response formatting"""
    print("\nTesting API response formatting...")
    
    try:
        from app.utils.shared import AnalyticsUtils
        
        # Test success response
        success_response = AnalyticsUtils.format_api_response(
            'success', 
            {'test': 'data'}, 
            'Test message'
        )
        
        print(f"✅ API response formatting successful")
        print(f"  Status: {success_response['status']}")
        print(f"  Has timestamp: {'timestamp' in success_response}")
        print(f"  Has data: {'data' in success_response}")
        print(f"  Has message: {'message' in success_response}")
        
        # Test error handling
        error_response = AnalyticsUtils.handle_analysis_error(
            Exception("Test error"), 
            "test analysis"
        )
        
        print(f"  Error handling works: {error_response['status'] == 'error'}")
        
        return True
        
    except Exception as e:
        print(f"❌ API response formatting failed: {e}")
        return False

def run_all_tests():
    """Run all tests"""
    print("🔬 Running Analytics Utils Tests")
    print("=" * 50)
    
    tests = [
        test_basic_imports,
        test_data_characteristics,
        test_recommendations,
        test_descriptive_analysis,
        test_text_analysis,
        test_api_response_format
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed! Analytics utilities are working correctly.")
        return True
    else:
        print(f"⚠️  {failed} tests failed. Please check the implementation.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 