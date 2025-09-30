"""
Auto-detection module for qualitative analytics.
Automatically suggests appropriate analysis methods based on data characteristics.
"""

from typing import Dict, Any, List, Tuple, Optional
import re
import numpy as np
from collections import Counter
from textblob import TextBlob

# Import base classes
from ..auto_detect.base_detector import (
    BaseAutoDetector, DataCharacteristics, AnalysisRecommendation, 
    DataType, AnalysisConfidence
)

class QualitativeAutoDetector(BaseAutoDetector):
    """
    Automatic detection of appropriate qualitative analysis methods.
    """
    
    def __init__(self):
        super().__init__("Qualitative Analytics")
        
    def get_method_requirements(self) -> Dict[str, Dict[str, Any]]:
        """Return method requirements for qualitative analyses."""
        return {
            'sentiment_analysis': {
                'min_texts': 5,
                'emotional_words_threshold': 0.1,
                'opinion_indicators': ['think', 'feel', 'believe', 'opinion', 'good', 'bad', 'like', 'dislike']
            },
            'thematic_analysis': {
                'min_texts': 10,
                'min_avg_words': 15,
                'diversity_threshold': 0.4
            },
            'content_analysis': {
                'min_texts': 5,
                'structured_content_indicators': ['category', 'type', 'section', 'item']
            },
            'coding': {
                'min_texts': 8,
                'pattern_indicators': ['because', 'reason', 'cause', 'due to', 'result']
            },
            'survey_analysis': {
                'response_indicators': ['question', 'answer', 'response', 'survey', 'questionnaire'],
                'rating_indicators': ['rate', 'scale', 'score', 'rating']
            }
        }
    
    def detect_data_type(self, texts: List[str], metadata: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Detect the type and characteristics of qualitative data.
        
        Args:
            texts: List of text documents
            metadata: Optional metadata for context
            
        Returns:
            Dictionary with data type detection results
        """
        if not texts:
            return {"error": "No texts provided"}
        
        # Basic characteristics
        word_counts = [len(text.split()) for text in texts]
        avg_words = np.mean(word_counts)
        total_words = sum(word_counts)
        
        # Content analysis
        all_text = ' '.join(texts).lower()
        words = re.findall(r'\b\w+\b', all_text)
        word_freq = Counter(words)
        
        # Detect patterns
        patterns = {
            'interview_patterns': self._detect_interview_patterns(texts),
            'survey_patterns': self._detect_survey_patterns(texts),
            'open_ended_patterns': self._detect_open_ended_patterns(texts),
            'structured_patterns': self._detect_structured_patterns(texts),
            'narrative_patterns': self._detect_narrative_patterns(texts)
        }
        
        # Calculate diversity
        unique_words = len(set(words))
        lexical_diversity = unique_words / total_words if total_words > 0 else 0
        
        # Determine primary data type
        data_type_scores = {
            'interview': patterns['interview_patterns']['score'],
            'survey': patterns['survey_patterns']['score'],
            'open_ended': patterns['open_ended_patterns']['score'],
            'structured': patterns['structured_patterns']['score'],
            'narrative': patterns['narrative_patterns']['score']
        }
        
        primary_type = max(data_type_scores.items(), key=lambda x: x[1])[0]
        
        return {
            'primary_data_type': primary_type,
            'confidence': data_type_scores[primary_type],
            'data_characteristics': {
                'num_texts': len(texts),
                'avg_words_per_text': avg_words,
                'lexical_diversity': lexical_diversity,
                'total_words': total_words
            },
            'detected_patterns': patterns,
            'data_type_scores': data_type_scores
        }
    
    def suggest_analysis_methods(self, texts: List[str], 
                               metadata: List[Dict[str, Any]] = None,
                               research_goals: List[str] = None) -> Dict[str, Any]:
        """
        Legacy method - use suggest_analyses instead.
        Suggest appropriate analysis methods based on data characteristics.
        
        Args:
            texts: List of text documents
            metadata: Optional metadata
            research_goals: Optional list of research objectives
            
        Returns:
            Dictionary with analysis method suggestions (legacy format)
        """
        if not texts:
            return {"error": "No texts provided"}
        
        # Use the standardized method and convert back to legacy format for backward compatibility
        from ..auto_detect.base_detector import AnalysisSuggestions
        
        # Create a simple DataFrame-like structure for the standardized method
        import pandas as pd
        df = pd.DataFrame({'text_data': texts})
        
        standardized_suggestions = self.suggest_analyses(df, texts=texts, research_goals=research_goals)
        
        # Convert back to legacy format
        suggestions = {
            'primary_recommendations': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale,
                    'parameters': rec.parameters
                }
                for rec in standardized_suggestions.primary_recommendations
            ],
            'secondary_recommendations': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'rationale': rec.rationale,
                    'parameters': rec.parameters
                }
                for rec in standardized_suggestions.secondary_recommendations
            ],
            'not_recommended': [
                {
                    'method': rec.method,
                    'score': rec.score,
                    'reason': rec.rationale
                }
                for rec in standardized_suggestions.optional_analyses
            ],
            'analysis_rationale': {},
            'parameter_suggestions': {}
        }
        
        return suggestions
    
    def suggest_analyses(self, data, analysis_goals=None, **kwargs):
        """
        Suggest appropriate qualitative analyses using the standardized interface.
        
        Args:
            data: Input data (DataFrame, list of texts, or other format)
            analysis_goals: Optional list of analysis goals
            **kwargs: Additional parameters including 'texts' for direct text input
            
        Returns:
            AnalysisSuggestions object with standardized recommendations
        """
        from ..auto_detect.base_detector import AnalysisSuggestions
        
        # Extract texts from various input formats
        texts = kwargs.get('texts', [])
        if not texts:
            if isinstance(data, list):
                texts = [str(item) for item in data if str(item).strip()]
            elif hasattr(data, 'select_dtypes'):
                # DataFrame - extract text columns
                text_cols = data.select_dtypes(include=['object']).columns
                for col in text_cols:
                    if hasattr(data[col], 'str') and data[col].str.len().mean() > 20:
                        texts.extend(data[col].dropna().tolist())
            elif hasattr(data, 'dtype') and data.dtype == 'object':
                # Series with text
                texts = data.dropna().tolist()
        
        if not texts:
            # Return empty suggestions if no text data found
            return AnalysisSuggestions(
                primary_recommendations=[],
                secondary_recommendations=[],
                optional_analyses=[],
                data_quality_warnings=["No text data found for qualitative analysis"],
                analysis_order=[]
            )
        
        # Detect data characteristics for the standardized format
        characteristics = self.detect_data_characteristics(data, texts=texts)
        
        # Check each analysis method using the standardized assess_method_suitability
        methods_to_check = [
            'sentiment_analysis',
            'thematic_analysis', 
            'content_analysis',
            'coding',
            'survey_analysis'
        ]
        
        primary_recs = []
        secondary_recs = []
        optional_recs = []
        
        for method in methods_to_check:
            # Filter out 'texts' from kwargs to avoid duplicate parameter
            filtered_kwargs = {k: v for k, v in kwargs.items() if k != 'texts'}
            recommendation = self.assess_method_suitability(
                method, 
                characteristics, 
                texts=texts,
                analysis_goals=analysis_goals,
                **filtered_kwargs
            )
            
            if recommendation.score >= 0.7:
                primary_recs.append(recommendation)
            elif recommendation.score >= 0.4:
                secondary_recs.append(recommendation)
            else:
                optional_recs.append(recommendation)
        
        # Sort recommendations by score
        primary_recs.sort(key=lambda x: x.score, reverse=True)
        secondary_recs.sort(key=lambda x: x.score, reverse=True)
        optional_recs.sort(key=lambda x: x.score, reverse=True)
        
        # Create standardized AnalysisSuggestions object
        suggestions = AnalysisSuggestions(
            primary_recommendations=primary_recs,
            secondary_recommendations=secondary_recs,
            optional_analyses=optional_recs,
            data_quality_warnings=self._generate_text_quality_warnings(texts),
            analysis_order=[rec.method for rec in primary_recs + secondary_recs]
        )
        
        return suggestions
    
    def _generate_text_quality_warnings(self, texts: List[str]) -> List[str]:
        """Generate data quality warnings specific to text data."""
        warnings = []
        
        if not texts:
            warnings.append("No text data available for analysis")
            return warnings
        
        word_counts = [len(text.split()) for text in texts]
        avg_words = np.mean(word_counts) if word_counts else 0
        
        if len(texts) < 5:
            warnings.append("Very small text sample - results may not be reliable")
        
        if avg_words < 5:
            warnings.append("Texts are very short - may limit analysis depth")
        
        if len(set(texts)) < len(texts) * 0.8:
            warnings.append("High text duplication detected - may affect analysis")
        
        return warnings
    
    def auto_configure_analysis(self, texts: List[str], 
                              method: str,
                              metadata: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Automatically configure parameters for a specific analysis method.
        
        Args:
            texts: List of text documents
            method: Analysis method to configure
            metadata: Optional metadata
            
        Returns:
            Dictionary with optimized parameters
        """
        if not texts:
            return {"error": "No texts provided"}
        
        data_detection = self.detect_data_type(texts, metadata)
        num_texts = len(texts)
        avg_words = data_detection['data_characteristics']['avg_words_per_text']
        
        configurations = {
            'sentiment_analysis': {
                'batch_size': min(100, num_texts),
                'include_emotions': avg_words > 20,
                'confidence_threshold': 0.6 if num_texts < 50 else 0.7,
                'category_detail': 'detailed' if avg_words > 30 else 'basic'
            },
            'thematic_analysis': {
                'n_themes': min(max(3, num_texts // 5), 8),
                'method': 'clustering' if num_texts < 100 else 'lda',
                'min_theme_size': max(2, num_texts // 20),
                'keywords_per_theme': min(10, max(5, avg_words // 5))
            },
            'content_analysis': {
                'analyze_structure': True,
                'analyze_patterns': num_texts > 10,
                'include_linguistic_features': avg_words > 15,
                'custom_categories': self._suggest_content_categories(texts)
            },
            'coding': {
                'auto_code_keywords': True,
                'hierarchical_coding': num_texts > 20,
                'inter_coder_reliability': num_texts > 50,
                'code_complexity': 'simple' if avg_words < 20 else 'detailed'
            },
            'survey_analysis': {
                'analyze_response_quality': True,
                'compare_questions': True,
                'analyze_respondent_patterns': num_texts > 30,
                'engagement_metrics': True
            }
        }
        
        if method in configurations:
            config = configurations[method]
            config['data_type'] = data_detection['primary_data_type']
            config['confidence'] = data_detection['confidence']
            return config
        else:
            return {"error": f"Unknown method: {method}"}
    
    def _detect_interview_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """Detect patterns typical of interview data."""
        interview_indicators = 0
        total_indicators = 0
        
        patterns = ['interviewer:', 'respondent:', 'q:', 'a:', 'tell me about', 'how do you', 'what is your']
        
        for text in texts:
            text_lower = text.lower()
            for pattern in patterns:
                if pattern in text_lower:
                    interview_indicators += 1
                total_indicators += 1
        
        score = interview_indicators / len(texts) if texts else 0
        
        return {
            'score': min(score, 1.0),
            'indicators_found': interview_indicators,
            'evidence': ['Dialog patterns', 'Question-answer format'] if score > 0.3 else []
        }
    
    def _detect_survey_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """Detect patterns typical of survey responses."""
        survey_indicators = 0
        
        # Look for survey-specific language
        survey_patterns = ['strongly agree', 'disagree', 'satisfied', 'rating', 'scale', 'questionnaire']
        rating_patterns = ['1-5', '1-10', 'excellent', 'good', 'fair', 'poor']
        
        for text in texts:
            text_lower = text.lower()
            if any(pattern in text_lower for pattern in survey_patterns + rating_patterns):
                survey_indicators += 1
        
        # Check for short, structured responses
        short_responses = sum(1 for text in texts if len(text.split()) < 10)
        structured_score = short_responses / len(texts) if texts else 0
        
        score = (survey_indicators / len(texts) + structured_score) / 2 if texts else 0
        
        return {
            'score': min(score, 1.0),
            'indicators_found': survey_indicators,
            'evidence': ['Rating language', 'Short responses'] if score > 0.3 else []
        }
    
    def _detect_open_ended_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """Detect open-ended response patterns."""
        if not texts:
            return {'score': 0, 'indicators_found': 0, 'evidence': []}
        
        word_counts = [len(text.split()) for text in texts]
        avg_words = np.mean(word_counts)
        word_variety = np.std(word_counts) / avg_words if avg_words > 0 else 0
        
        # Open-ended responses typically have varied lengths and personal language
        personal_indicators = sum(1 for text in texts if any(word in text.lower() 
                                for word in ['i think', 'i feel', 'in my opinion', 'personally']))
        
        variety_score = min(word_variety, 1.0)
        personal_score = personal_indicators / len(texts)
        length_score = 1.0 if 10 <= avg_words <= 100 else 0.5
        
        score = (variety_score + personal_score + length_score) / 3
        
        return {
            'score': score,
            'indicators_found': personal_indicators,
            'evidence': ['Personal language', 'Varied response lengths'] if score > 0.4 else []
        }
    
    def _detect_structured_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """Detect structured content patterns."""
        structure_indicators = 0
        
        # Look for formatting indicators
        structure_patterns = [':', '-', '•', '1.', '2.', 'first', 'second', 'finally']
        
        for text in texts:
            if any(pattern in text for pattern in structure_patterns):
                structure_indicators += 1
        
        # Check for consistent formatting
        lengths = [len(text) for text in texts]
        length_consistency = 1 - (np.std(lengths) / np.mean(lengths)) if np.mean(lengths) > 0 else 0
        
        score = (structure_indicators / len(texts) + length_consistency) / 2 if texts else 0
        
        return {
            'score': min(score, 1.0),
            'indicators_found': structure_indicators,
            'evidence': ['Formatting patterns', 'Consistent structure'] if score > 0.3 else []
        }
    
    def _detect_narrative_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """Detect narrative/story patterns."""
        narrative_indicators = 0
        
        # Look for narrative indicators
        narrative_patterns = ['story', 'happened', 'then', 'after', 'before', 'while', 'during', 'experience']
        temporal_patterns = ['first', 'next', 'then', 'finally', 'eventually', 'suddenly']
        
        for text in texts:
            text_lower = text.lower()
            if (any(pattern in text_lower for pattern in narrative_patterns) or
                any(pattern in text_lower for pattern in temporal_patterns)):
                narrative_indicators += 1
        
        # Check for longer texts (narratives tend to be longer)
        word_counts = [len(text.split()) for text in texts]
        avg_words = np.mean(word_counts) if word_counts else 0
        length_score = min(avg_words / 50, 1.0)  # Normalize around 50 words
        
        indicator_score = narrative_indicators / len(texts) if texts else 0
        score = (indicator_score + length_score) / 2
        
        return {
            'score': min(score, 1.0),
            'indicators_found': narrative_indicators,
            'evidence': ['Narrative language', 'Longer texts'] if score > 0.3 else []
        }
    
    def _assess_method_suitability(self, method: str, texts: List[str], 
                                  data_detection: Dict[str, Any],
                                  research_goals: List[str] = None) -> Dict[str, Any]:
        """Assess how suitable a method is for the given data."""
        
        thresholds = self.get_method_requirements()[method]
        num_texts = len(texts)
        characteristics = data_detection['data_characteristics']
        
        if method == 'sentiment_analysis':
            # Check for emotional content
            emotional_score = self._calculate_emotional_content(texts)
            opinion_score = self._calculate_opinion_content(texts)
            
            score = (emotional_score + opinion_score) / 2
            rationale = f"Emotional content: {emotional_score:.2f}, Opinion indicators: {opinion_score:.2f}"
            
            params = {
                'include_emotions': True,
                'batch_analysis': num_texts > 20,
                'trend_analysis': num_texts > 50
            }
        
        elif method == 'thematic_analysis':
            # Check data volume and diversity
            volume_score = min(num_texts / thresholds['min_texts'], 1.0)
            length_score = min(characteristics['avg_words_per_text'] / thresholds['min_avg_words'], 1.0)
            diversity_score = min(characteristics['lexical_diversity'] / thresholds['diversity_threshold'], 1.0)
            
            score = (volume_score + length_score + diversity_score) / 3
            rationale = f"Volume: {volume_score:.2f}, Length: {length_score:.2f}, Diversity: {diversity_score:.2f}"
            
            params = {
                'n_themes': min(max(3, num_texts // 5), 8),
                'method': 'clustering' if num_texts < 100 else 'lda'
            }
        
        elif method == 'content_analysis':
            # Suitable for most text data
            volume_score = min(num_texts / thresholds['min_texts'], 1.0)
            structure_score = data_detection['detected_patterns']['structured_patterns']['score']
            
            score = (volume_score + structure_score) / 2
            rationale = f"Data volume adequate, structure level: {structure_score:.2f}"
            
            params = {
                'analyze_structure': True,
                'analyze_patterns': num_texts > 10,
                'include_linguistic_features': characteristics['avg_words_per_text'] > 15,
                'custom_categories': self._suggest_content_categories(texts)
            }
        
        elif method == 'coding':
            # Check for patterns and complexity
            volume_score = min(num_texts / thresholds['min_texts'], 1.0)
            complexity_score = min(characteristics['avg_words_per_text'] / 20, 1.0)
            
            score = (volume_score + complexity_score) / 2
            rationale = f"Volume: {volume_score:.2f}, Complexity: {complexity_score:.2f}"
            
            params = {
                'auto_coding': True,
                'hierarchical_coding': num_texts > 20,
                'inter_coder_reliability': num_texts > 50,
                'code_complexity': 'simple' if complexity_score < 0.5 else 'detailed'
            }
        
        elif method == 'survey_analysis':
            # Check for survey patterns
            survey_score = data_detection['detected_patterns']['survey_patterns']['score']
            structure_score = data_detection['detected_patterns']['structured_patterns']['score']
            
            score = (survey_score + structure_score) / 2
            rationale = f"Survey patterns: {survey_score:.2f}, Structure: {structure_score:.2f}"
            
            params = {
                'analyze_response_quality': True,
                'compare_questions': True,
                'analyze_respondent_patterns': num_texts > 30,
                'engagement_metrics': True
            }
        
        else:
            score = 0
            rationale = "Unknown method"
            params = {}
        
        return {
            'score': score,
            'rationale': rationale,
            'suggested_parameters': params
        }
    
    def _calculate_emotional_content(self, texts: List[str]) -> float:
        """Calculate the emotional content score of texts."""
        emotional_words = {'happy', 'sad', 'angry', 'excited', 'worried', 'disappointed', 
                          'satisfied', 'frustrated', 'pleased', 'concerned'}
        
        total_emotional = 0
        total_words = 0
        
        for text in texts:
            words = re.findall(r'\b\w+\b', text.lower())
            total_words += len(words)
            total_emotional += sum(1 for word in words if word in emotional_words)
        
        return total_emotional / total_words if total_words > 0 else 0
    
    def _calculate_opinion_content(self, texts: List[str]) -> float:
        """Calculate the opinion content score of texts."""
        opinion_indicators = self.get_method_requirements()['sentiment_analysis']['opinion_indicators']
        
        texts_with_opinions = 0
        for text in texts:
            text_lower = text.lower()
            if any(indicator in text_lower for indicator in opinion_indicators):
                texts_with_opinions += 1
        
        return texts_with_opinions / len(texts) if texts else 0
    
    def _suggest_content_categories(self, texts: List[str]) -> Dict[str, List[str]]:
        """Suggest content categories based on the texts."""
        # Simple category suggestion based on common words
        all_words = []
        for text in texts:
            words = re.findall(r'\b\w+\b', text.lower())
            all_words.extend(words)
        
        word_freq = Counter(all_words)
        common_words = [word for word, count in word_freq.most_common(20) 
                       if len(word) > 3 and count > 1]
        
        # Group into potential categories
        categories = {
            'descriptive_words': [w for w in common_words if w in ['good', 'bad', 'great', 'poor', 'excellent']],
            'action_words': [w for w in common_words if w in ['work', 'help', 'make', 'create', 'build']],
            'emotional_words': [w for w in common_words if w in ['happy', 'sad', 'excited', 'worried']]
        }
        
        return {k: v for k, v in categories.items() if v}  # Only return non-empty categories

    def assess_method_suitability(self, method_name: str, 
                                characteristics: DataCharacteristics,
                                **kwargs) -> AnalysisRecommendation:
        """
        Assess how suitable a method is for qualitative data using standardized structures.
        """
        # Extract texts from kwargs since qualitative analysis works with text data
        texts = kwargs.get('texts', [])
        if not texts:
            # Create a low-confidence recommendation
            return AnalysisRecommendation(
                method=method_name,
                score=0.1,
                confidence=AnalysisConfidence.VERY_LOW,
                rationale="No text data provided for qualitative analysis",
                estimated_time="< 5 seconds",
                parameters={'error': 'No text data available'}
            )
        
        # Get method requirements
        requirements = self.get_method_requirements().get(method_name, {})
        
        score = 0.0
        rationale_parts = []
        
        num_texts = len(texts)
        min_texts = requirements.get('min_texts', 5)
        
        # Check minimum text count
        if num_texts >= min_texts:
            score += 0.4
            rationale_parts.append(f"adequate text count (n={num_texts})")
        else:
            score -= 0.2
            rationale_parts.append(f"insufficient texts ({num_texts} < {min_texts})")
        
        # Calculate text characteristics for assessment
        word_counts = [len(text.split()) for text in texts]
        avg_words = np.mean(word_counts) if word_counts else 0
        
        # Method-specific assessments
        if method_name == 'sentiment_analysis':
            emotional_score = self._calculate_emotional_content(texts)
            opinion_score = self._calculate_opinion_content(texts)
            method_score = (emotional_score + opinion_score) / 2
            score += method_score * 0.6
            rationale_parts.append(f"emotional/opinion content: {method_score:.2f}")
            
        elif method_name == 'thematic_analysis':
            diversity_score = self._calculate_lexical_diversity(texts)
            length_score = min(avg_words / 15, 1.0)
            method_score = (diversity_score + length_score) / 2
            score += method_score * 0.6
            rationale_parts.append(f"diversity and length suitable: {method_score:.2f}")
            
        elif method_name == 'content_analysis':
            structure_score = self._assess_structure_level(texts)
            score += structure_score * 0.6
            rationale_parts.append(f"content structure: {structure_score:.2f}")
            
        elif method_name == 'coding':
            complexity_score = min(avg_words / 20, 1.0)
            pattern_score = self._assess_pattern_richness(texts)
            method_score = (complexity_score + pattern_score) / 2
            score += method_score * 0.6
            rationale_parts.append(f"complexity and patterns: {method_score:.2f}")
            
        elif method_name == 'survey_analysis':
            survey_score = self._assess_survey_characteristics(texts)
            score += survey_score * 0.6
            rationale_parts.append(f"survey-like characteristics: {survey_score:.2f}")
        
        # Normalize score
        score = max(0, min(1, score))
        
        # Create recommendation
        recommendation = AnalysisRecommendation(
            method=method_name,
            score=score,
            confidence=AnalysisConfidence.HIGH,  # Will be set by __post_init__
            rationale='; '.join(rationale_parts),
            estimated_time=self._estimate_execution_time(method_name, num_texts),
            function_call=self._generate_function_call(method_name),
            parameters=self._get_suggested_parameters(method_name, num_texts, avg_words)
        )
        
        return recommendation
    
    def detect_data_characteristics(self, data, **kwargs) -> DataCharacteristics:
        """
        Override to handle text data specifically for qualitative analysis.
        Uses standardized base class method when possible, with text-specific enhancements.
        """
        # Extract text data from various input formats
        texts = kwargs.get('texts', [])
        if not texts:
            if isinstance(data, list):
                texts = [str(item) for item in data if str(item).strip()]
            elif hasattr(data, 'select_dtypes'):
                # DataFrame - extract text columns
                text_cols = data.select_dtypes(include=['object']).columns
                for col in text_cols:
                    if hasattr(data[col], 'str') and data[col].str.len().mean() > 10:
                        texts.extend(data[col].dropna().tolist())
            elif hasattr(data, 'dtype') and data.dtype == 'object':
                # Series with text
                texts = data.dropna().tolist()
        
        # Use the base class method for core characteristics if we have DataFrame-like data
        if hasattr(data, 'select_dtypes') and len(data.columns) > 0:
            characteristics = super().detect_data_characteristics(data, **kwargs)
            # Add text-specific enhancements
            characteristics.has_text = len(texts) > 0
        else:
            # Create characteristics based on text data only
            characteristics = DataCharacteristics()
            
            if texts:
                characteristics.n_observations = len(texts)
                characteristics.n_variables = 1  # Text is treated as one variable
                characteristics.data_shape = (len(texts), 1)
                characteristics.variable_types = {'text_data': DataType.TEXT}
                characteristics.type_counts = {DataType.TEXT: 1}
                characteristics.has_text = True
                characteristics.missing_percentage = 0  # Assuming we filtered out empty texts
                characteristics.completeness_score = 100
                characteristics.sample_size_category = self._categorize_text_sample_size(len(texts))
                
                # Text-specific characteristics
                word_counts = [len(text.split()) for text in texts]
                characteristics.numeric_summaries = {
                    'text_data': {
                        'avg_words': float(np.mean(word_counts)),
                        'median_words': float(np.median(word_counts)),
                        'std_words': float(np.std(word_counts)),
                        'min_words': float(np.min(word_counts)),
                        'max_words': float(np.max(word_counts))
                    }
                }
            
            from datetime import datetime
            characteristics.detection_timestamp = datetime.now().isoformat()
        
        return characteristics
    
    def _categorize_text_sample_size(self, n: int) -> str:
        """Categorize text sample size for qualitative analysis."""
        if n < 5:
            return 'very_small'
        elif n < 20:
            return 'small'
        elif n < 50:
            return 'medium'
        elif n < 200:
            return 'large'
        else:
            return 'very_large'
    
    def _calculate_lexical_diversity(self, texts: List[str]) -> float:
        """Calculate lexical diversity of the text corpus."""
        all_words = []
        for text in texts:
            words = re.findall(r'\b\w+\b', text.lower())
            all_words.extend(words)
        
        if not all_words:
            return 0
        
        unique_words = len(set(all_words))
        total_words = len(all_words)
        return unique_words / total_words
    
    def _assess_structure_level(self, texts: List[str]) -> float:
        """Assess the structural level of the texts."""
        structure_indicators = 0
        structure_patterns = [':', '-', '•', '1.', '2.', 'first', 'second', 'finally']
        
        for text in texts:
            if any(pattern in text for pattern in structure_patterns):
                structure_indicators += 1
        
        return structure_indicators / len(texts) if texts else 0
    
    def _assess_pattern_richness(self, texts: List[str]) -> float:
        """Assess the richness of patterns in texts for coding analysis."""
        pattern_indicators = ['because', 'reason', 'cause', 'due to', 'result', 'therefore', 'since']
        texts_with_patterns = 0
        
        for text in texts:
            text_lower = text.lower()
            if any(pattern in text_lower for pattern in pattern_indicators):
                texts_with_patterns += 1
        
        return texts_with_patterns / len(texts) if texts else 0
    
    def _assess_survey_characteristics(self, texts: List[str]) -> float:
        """Assess survey-like characteristics in texts."""
        survey_patterns = ['strongly agree', 'disagree', 'satisfied', 'rating', 'scale']
        rating_patterns = ['1-5', '1-10', 'excellent', 'good', 'fair', 'poor']
        
        survey_texts = 0
        for text in texts:
            text_lower = text.lower()
            if any(pattern in text_lower for pattern in survey_patterns + rating_patterns):
                survey_texts += 1
        
        return survey_texts / len(texts) if texts else 0
    
    def _estimate_execution_time(self, method_name: str, num_texts: int) -> str:
        """Estimate execution time for qualitative analysis methods."""
        base_times = {
            'sentiment_analysis': 2,
            'thematic_analysis': 15,
            'content_analysis': 10,
            'coding': 20,
            'survey_analysis': 5
        }
        
        base_time = base_times.get(method_name, 10)
        
        # Adjust for text count
        if num_texts > 100:
            base_time *= 3
        elif num_texts > 50:
            base_time *= 2
        
        if base_time < 10:
            return "< 10 seconds"
        elif base_time < 60:
            return "< 1 minute"
        elif base_time < 300:
            return "< 5 minutes"
        else:
            return "5-15 minutes"
    
    def _generate_function_call(self, method_name: str) -> str:
        """Generate appropriate function call for the method."""
        function_map = {
            'sentiment_analysis': 'analyze_sentiment_trends(texts)',
            'thematic_analysis': 'analyze_themes(texts, n_themes=auto)',
            'content_analysis': 'analyze_content_comprehensively(texts)',
            'coding': 'analyze_coded_data(texts, auto_code=True)',
            'survey_analysis': 'analyze_survey_data(texts)'
        }
        
        return function_map.get(method_name, f'{method_name}(texts)')
    
    def _get_suggested_parameters(self, method_name: str, num_texts: int, avg_words: float) -> Dict[str, Any]:
        """Get suggested parameters for a specific qualitative method."""
        if method_name == 'sentiment_analysis':
            return {
                'batch_size': min(100, num_texts),
                'include_emotions': avg_words > 20,
                'confidence_threshold': 0.6 if num_texts < 50 else 0.7
            }
        elif method_name == 'thematic_analysis':
            return {
                'n_themes': min(max(3, num_texts // 5), 8),
                'method': 'clustering' if num_texts < 100 else 'lda',
                'min_theme_size': max(2, num_texts // 20)
            }
        elif method_name == 'content_analysis':
            return {
                'analyze_structure': True,
                'analyze_patterns': num_texts > 10,
                'include_linguistic_features': avg_words > 15
            }
        elif method_name == 'coding':
            return {
                'auto_code_keywords': True,
                'hierarchical_coding': num_texts > 20,
                'code_complexity': 'simple' if avg_words < 20 else 'detailed'
            }
        elif method_name == 'survey_analysis':
            return {
                'analyze_response_quality': True,
                'compare_questions': True,
                'analyze_respondent_patterns': num_texts > 30
            }
        
        return {}

def auto_analyze(texts: List[str], 
                metadata: List[Dict[str, Any]] = None,
                research_goals: List[str] = None) -> Dict[str, Any]:
    """
    Automatically analyze texts and suggest optimal analysis approach.
    
    Args:
        texts: List of text documents
        metadata: Optional metadata
        research_goals: Optional research objectives
        
    Returns:
        Dictionary with complete auto-analysis results
    """
    detector = QualitativeAutoDetector()
    
    # Detect data characteristics
    data_detection = detector.detect_data_type(texts, metadata)
    
    # Get method suggestions
    method_suggestions = detector.suggest_analysis_methods(texts, metadata, research_goals)
    
    # Auto-configure top method
    top_method = None
    top_config = {}
    
    if method_suggestions['primary_recommendations']:
        top_method = method_suggestions['primary_recommendations'][0]['method']
        top_config = detector.auto_configure_analysis(texts, top_method, metadata)
    
    return {
        'data_detection': data_detection,
        'method_suggestions': method_suggestions,
        'recommended_workflow': {
            'primary_method': top_method,
            'configuration': top_config,
            'secondary_methods': [r['method'] for r in method_suggestions['secondary_recommendations'][:2]]
        },
        'analysis_summary': {
            'data_type': data_detection['primary_data_type'],
            'confidence': data_detection['confidence'],
            'best_method': top_method,
            'readiness_score': _calculate_readiness_score(data_detection, method_suggestions)
        }
    }

def _calculate_readiness_score(data_detection: Dict[str, Any], 
                              method_suggestions: Dict[str, Any]) -> float:
    """Calculate how ready the data is for analysis."""
    characteristics = data_detection['data_characteristics']
    
    # Factors contributing to readiness
    volume_score = min(characteristics['num_texts'] / 10, 1.0)  # Normalize around 10 texts
    length_score = min(characteristics['avg_words_per_text'] / 20, 1.0)  # Normalize around 20 words
    diversity_score = characteristics['lexical_diversity']
    method_score = len(method_suggestions['primary_recommendations']) / 5  # Normalize around 5 methods
    
    readiness = (volume_score + length_score + diversity_score + method_score) / 4
    return min(readiness, 1.0) 