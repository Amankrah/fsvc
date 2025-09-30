"""
Demonstration of the streamlined auto-detection system.
Shows how the integrated modules work together for comprehensive analysis.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List
import warnings
warnings.filterwarnings('ignore')

# Import the new unified system - handle both direct execution and module import
try:
    # Try relative import first (when run as module)
    from . import UnifiedAutoDetector, create_auto_detector, get_analysis_for_api
except ImportError:
    # Fall back to importing from current directory when run directly
    import sys
    import os
    
    # Add current directory to path to ensure we can import from __init__.py
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # Add the parent analytics directory to path for the module imports to work
    parent_dir = os.path.dirname(current_dir)  # analytics directory
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    
    # Import from the current __init__.py file
    try:
        from __init__ import UnifiedAutoDetector, create_auto_detector, get_analysis_for_api
    except ImportError as e:
        print(f"Failed to import from __init__.py: {e}")
        # Try direct import of the class
        try:
            sys.path.insert(0, current_dir)
            import __init__ as auto_detect_module
            UnifiedAutoDetector = auto_detect_module.UnifiedAutoDetector
            create_auto_detector = auto_detect_module.create_auto_detector
            get_analysis_for_api = auto_detect_module.get_analysis_for_api
        except Exception as final_e:
            print(f"All import attempts failed: {final_e}")
            raise ImportError("Could not import required modules")

def create_sample_datasets():
    """Create sample datasets for testing different analysis types."""
    
    # Quantitative dataset (good for descriptive + inferential)
    np.random.seed(42)
    quantitative_data = pd.DataFrame({
        'age': np.random.normal(35, 10, 200),
        'income': np.random.normal(50000, 15000, 200),
        'satisfaction': np.random.randint(1, 11, 200),
        'department': np.random.choice(['Sales', 'Engineering', 'Marketing', 'HR'], 200),
        'years_experience': np.random.exponential(5, 200),
        'performance_score': np.random.normal(7.5, 1.5, 200)
    })
    
    # Mixed dataset with text (good for all three modules)
    mixed_data = pd.DataFrame({
        'customer_id': range(100),
        'age_group': np.random.choice(['18-25', '26-35', '36-45', '46-55', '55+'], 100),
        'spending': np.random.normal(1000, 300, 100),
        'satisfaction_rating': np.random.randint(1, 6, 100),
        'feedback_text': [
            f"The service was {'excellent' if np.random.random() > 0.5 else 'poor'}. "
            f"I {'really enjoyed' if np.random.random() > 0.5 else 'was disappointed with'} "
            f"the {'product quality' if np.random.random() > 0.5 else 'customer support'}. "
            f"Would {'definitely' if np.random.random() > 0.5 else 'probably not'} recommend."
            for _ in range(100)
        ]
    })
    
    # Text-heavy dataset (good for qualitative)
    text_data = pd.DataFrame({
        'response_id': range(50),
        'interview_text': [
            f"I think the most important aspect of this experience was the {np.random.choice(['communication', 'efficiency', 'friendliness', 'professionalism'])}. "
            f"The staff made me feel {np.random.choice(['welcomed', 'valued', 'understood', 'frustrated'])}. "
            f"If I were to suggest improvements, I would focus on {np.random.choice(['training', 'technology', 'processes', 'facilities'])}. "
            f"Overall, my experience was {np.random.choice(['exceptional', 'satisfactory', 'disappointing', 'average'])}."
            for _ in range(50)
        ]
    })
    
    return {
        'quantitative': quantitative_data,
        'mixed': mixed_data,
        'text': text_data
    }

def demo_unified_detector():
    """Demonstrate the unified auto-detection system."""
    print("=" * 60)
    print("UNIFIED AUTO-DETECTION SYSTEM DEMONSTRATION")
    print("=" * 60)
    
    # Create sample datasets
    datasets = create_sample_datasets()
    
    # Initialize the unified detector
    unified_detector = UnifiedAutoDetector()
    
    for name, data in datasets.items():
        print(f"\n{'='*50}")
        print(f"ANALYZING {name.upper()} DATASET")
        print(f"{'='*50}")
        
        try:
            # Run comprehensive analysis
            results = unified_detector.analyze_comprehensive_data(data, analysis_type="auto")
            
            # Display data characteristics
            chars = results["data_characteristics"]
            print(f"\nData Overview:")
            print(f"  Sample size: {chars.n_observations}")
            print(f"  Variables: {chars.n_variables}")
            print(f"  Data types: {dict(chars.type_counts)}")
            print(f"  Quality score: {chars.completeness_score:.1f}%")
            print(f"  Missing data: {chars.missing_percentage:.1f}%")
            
            # Display modules used
            modules_used = results["coordination"]["modules_used"]
            print(f"\nModules Used: {', '.join(modules_used)}")
            
            # Display recommendations from each module
            for module_name, module_result in results["module_results"].items():
                print(f"\n{module_name.upper()} RECOMMENDATIONS:")
                if "error" in module_result:
                    print(f"  Error: {module_result['error']}")
                else:
                    suggestions = module_result.get("suggestions", {})
                    if hasattr(suggestions, 'primary_recommendations'):
                        for i, rec in enumerate(suggestions.primary_recommendations[:3], 1):
                            print(f"  {i}. {rec.method} (confidence: {rec.confidence.value}, score: {rec.score:.3f})")
                            print(f"     Rationale: {rec.rationale}")
            
            # Display cross-module insights
            insights = results["coordination"]["cross_module_insights"]
            print(f"\nCROSS-MODULE INSIGHTS:")
            quality_summary = insights.get("data_quality_summary", {})
            print(f"  Overall quality: {quality_summary.get('overall_score', 'Unknown')}")
            print(f"  Sample adequacy: {quality_summary.get('sample_size_adequacy', 'Unknown')}")
            
            # Display unified recommendations
            unified_recs = results["coordination"]["unified_recommendations"]
            print(f"\nUNIFIED RECOMMENDATIONS:")
            immediate_actions = unified_recs.get("immediate_actions", [])
            if immediate_actions:
                print("  Immediate actions:")
                for action in immediate_actions:
                    print(f"    - {action}")
            
            analysis_sequence = unified_recs.get("analysis_sequence", [])
            if analysis_sequence:
                print("  Recommended sequence:")
                for i, step in enumerate(analysis_sequence, 1):
                    print(f"    {i}. {step}")
                    
        except Exception as e:
            print(f"Error analyzing {name} dataset: {str(e)}")

def demo_individual_detectors():
    """Demonstrate individual detector modules."""
    print(f"\n{'='*60}")
    print("INDIVIDUAL DETECTOR MODULES DEMONSTRATION")
    print(f"{'='*60}")
    
    datasets = create_sample_datasets()
    
    # Test each detector type
    detector_types = ['descriptive', 'inferential', 'qualitative']
    
    for detector_type in detector_types:
        print(f"\n{'='*40}")
        print(f"TESTING {detector_type.upper()} DETECTOR")
        print(f"{'='*40}")
        
        try:
            detector = create_auto_detector(detector_type)
            
            # Use appropriate dataset for each detector
            if detector_type == 'qualitative':
                data = datasets['text']
                print(f"Using text dataset with {len(data)} responses")
            else:
                data = datasets['quantitative']
                print(f"Using quantitative dataset with {len(data)} observations")
            
            # Get suggestions
            if detector_type == 'qualitative':
                # Extract text for qualitative analysis
                texts = data['interview_text'].tolist()
                suggestions = detector.suggest_analysis_methods(texts)
            else:
                suggestions = detector.suggest_analyses(data)
            
            # Display results
            if hasattr(suggestions, 'primary_recommendations'):
                print(f"\nPrimary recommendations:")
                for i, rec in enumerate(suggestions.primary_recommendations[:3], 1):
                    print(f"  {i}. {rec.method}")
                    print(f"     Confidence: {rec.confidence.value}")
                    print(f"     Score: {rec.score:.3f}")
                    print(f"     Rationale: {rec.rationale[:100]}...")
            else:
                # Handle dictionary format for backward compatibility
                primary_recs = suggestions.get('primary_recommendations', [])
                print(f"\nPrimary recommendations:")
                for i, rec in enumerate(primary_recs[:3], 1):
                    print(f"  {i}. {rec.get('method', 'Unknown')}")
                    print(f"     Score: {rec.get('score', 0):.3f}")
                    print(f"     Rationale: {rec.get('rationale', 'No rationale')[:100]}...")
                    
        except Exception as e:
            print(f"Error testing {detector_type} detector: {str(e)}")

def demo_api_integration():
    """Demonstrate FastAPI integration helper."""
    print(f"\n{'='*60}")
    print("FASTAPI INTEGRATION DEMONSTRATION")
    print(f"{'='*60}")
    
    datasets = create_sample_datasets()
    
    for name, data in datasets.items():
        print(f"\nAPI Response for {name} dataset:")
        print("-" * 40)
        
        try:
            api_response = get_analysis_for_api(data, analysis_type="auto")
            
            print(f"Status: {api_response['status']}")
            
            if api_response['status'] == 'success':
                overview = api_response['data_overview']
                print(f"Sample size: {overview['sample_size']}")
                print(f"Variables: {overview['variables']}")
                print(f"Quality score: {overview['quality_score']:.1f}%")
                print(f"Available analyses: {', '.join(api_response['available_analyses'])}")
                
                # Show analysis availability
                for analysis_type in ['descriptive', 'inferential', 'qualitative']:
                    analysis_key = f"{analysis_type}_analysis"
                    if analysis_key in api_response:
                        available = api_response[analysis_key]['available']
                        print(f"{analysis_type.title()} analysis: {'Available' if available else 'Not available'}")
                        if not available and 'error' in api_response[analysis_key]:
                            print(f"  Error: {api_response[analysis_key]['error']}")
            else:
                print(f"Error: {api_response['message']}")
                
        except Exception as e:
            print(f"API integration error: {str(e)}")

def demo_cross_module_intelligence():
    """Demonstrate cross-module intelligence and coordination."""
    print(f"\n{'='*60}")
    print("CROSS-MODULE INTELLIGENCE DEMONSTRATION")
    print(f"{'='*60}")
    
    datasets = create_sample_datasets()
    mixed_data = datasets['mixed']  # Use mixed dataset for best demonstration
    
    unified_detector = UnifiedAutoDetector()
    
    print(f"Analyzing mixed dataset with {len(mixed_data)} observations...")
    
    try:
        results = unified_detector.analyze_comprehensive_data(mixed_data, analysis_type="comprehensive")
        
        # Show how modules work together
        print(f"\nMODULE COORDINATION:")
        print(f"Modules used: {', '.join(results['coordination']['modules_used'])}")
        
        # Show cross-module insights
        insights = results["coordination"]["cross_module_insights"]
        print(f"\nCROSS-MODULE INSIGHTS:")
        
        # Data quality summary
        quality = insights.get("data_quality_summary", {})
        print(f"Data quality summary:")
        for key, value in quality.items():
            if key != "recommendations":
                print(f"  {key}: {value}")
        
        # Pattern convergence
        convergence = insights.get("pattern_convergence", {})
        if convergence:
            print(f"Pattern convergence:")
            for key, value in convergence.items():
                print(f"  {key}: {value}")
        
        # Unified recommendations
        unified_recs = results["coordination"]["unified_recommendations"]
        print(f"\nUNIFIED RECOMMENDATIONS:")
        
        # Reporting strategy
        reporting = unified_recs.get("reporting_strategy", {})
        if reporting:
            print(f"Primary narrative: {reporting.get('primary_narrative', 'Unknown')}")
            print(f"Supporting analyses: {', '.join(reporting.get('supporting_analyses', []))}")
            print(f"Visualization priorities: {', '.join(reporting.get('visualization_priorities', []))}")
        
        # Integration opportunities
        integration = unified_recs.get("integration_opportunities", [])
        if integration:
            print(f"Integration opportunities:")
            for opp in integration:
                print(f"  - {opp}")
                
    except Exception as e:
        print(f"Cross-module intelligence error: {str(e)}")

def run_complete_demo():
    """Run the complete demonstration."""
    print("STREAMLINED AUTO-DETECTION SYSTEM DEMONSTRATION")
    print("=" * 60)
    print("This demo shows how the improved auto-detection system provides:")
    print("- Standardized interfaces across all modules")
    print("- Intelligent cross-module coordination")
    print("- Unified recommendations")
    print("- FastAPI integration")
    print("- Comprehensive data profiling")
    
    # Run all demonstrations
    demo_unified_detector()
    demo_individual_detectors()
    demo_api_integration() 
    demo_cross_module_intelligence()
    
    print(f"\n{'='*60}")
    print("DEMONSTRATION COMPLETE")
    print("The new system provides:")
    print("✓ Consistent interfaces across modules")
    print("✓ Intelligent module selection")
    print("✓ Cross-module insights")
    print("✓ Unified recommendations")
    print("✓ Easy API integration")
    print("✓ Comprehensive error handling")
    print("=" * 60)

if __name__ == "__main__":
    run_complete_demo() 