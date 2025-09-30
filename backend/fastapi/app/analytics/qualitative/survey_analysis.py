"""
Survey analysis module for analyzing qualitative survey responses.
Specialized tools for open-ended survey questions and research data.
"""

from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
import re
from datetime import datetime
from .sentiment import analyze_sentiment_batch, analyze_sentiment_trends
from .thematic_analysis import ThematicAnalyzer
from .content_analysis import ContentAnalyzer

class SurveyAnalyzer:
    """
    Specialized analyzer for qualitative survey responses.
    """
    
    def __init__(self):
        self.thematic_analyzer = ThematicAnalyzer()
        self.content_analyzer = ContentAnalyzer()
        
        # Common survey response patterns
        self.response_patterns = {
            'non_responses': ['n/a', 'na', 'not applicable', 'no response', 'skip', 'none', ''],
            'uncertain_responses': ['maybe', 'not sure', 'uncertain', 'don\'t know', 'unsure', 'unclear'],
            'positive_indicators': ['yes', 'agree', 'good', 'satisfied', 'positive', 'excellent'],
            'negative_indicators': ['no', 'disagree', 'bad', 'unsatisfied', 'negative', 'poor']
        }
    
    def analyze_response_quality(self, responses: List[str]) -> Dict[str, Any]:
        """
        Analyze the quality and completeness of survey responses.
        
        Args:
            responses: List of survey responses
            
        Returns:
            Dictionary with response quality metrics
        """
        if not responses:
            return {"error": "No responses provided"}
        
        total_responses = len(responses)
        quality_metrics = {
            'total_responses': total_responses,
            'valid_responses': 0,
            'non_responses': 0,
            'short_responses': 0,
            'detailed_responses': 0,
            'uncertain_responses': 0,
            'response_lengths': [],
            'word_counts': []
        }
        
        response_categories = {
            'non_response': [],
            'short': [],
            'medium': [],
            'detailed': [],
            'uncertain': []
        }
        
        for i, response in enumerate(responses):
            if not response or isinstance(response, float):  # Handle NaN values
                response = ""
            
            response_text = str(response).strip().lower()
            word_count = len(response_text.split()) if response_text else 0
            char_count = len(response_text)
            
            quality_metrics['response_lengths'].append(char_count)
            quality_metrics['word_counts'].append(word_count)
            
            # Categorize response
            if any(pattern in response_text for pattern in self.response_patterns['non_responses']):
                quality_metrics['non_responses'] += 1
                response_categories['non_response'].append(i)
            elif any(pattern in response_text for pattern in self.response_patterns['uncertain_responses']):
                quality_metrics['uncertain_responses'] += 1
                response_categories['uncertain'].append(i)
            elif word_count < 3:
                quality_metrics['short_responses'] += 1
                response_categories['short'].append(i)
            elif word_count >= 20:
                quality_metrics['detailed_responses'] += 1
                response_categories['detailed'].append(i)
            else:
                response_categories['medium'].append(i)
            
            if word_count > 0 and response_text not in ['', 'n/a', 'na']:
                quality_metrics['valid_responses'] += 1
        
        # Calculate statistics
        if quality_metrics['response_lengths']:
            quality_metrics['avg_response_length'] = np.mean(quality_metrics['response_lengths'])
            quality_metrics['avg_word_count'] = np.mean(quality_metrics['word_counts'])
            quality_metrics['response_length_std'] = np.std(quality_metrics['response_lengths'])
        else:
            quality_metrics.update({
                'avg_response_length': 0,
                'avg_word_count': 0,
                'response_length_std': 0
            })
        
        # Calculate percentages
        quality_metrics.update({
            'response_rate': (quality_metrics['valid_responses'] / total_responses) * 100,
            'non_response_rate': (quality_metrics['non_responses'] / total_responses) * 100,
            'detailed_response_rate': (quality_metrics['detailed_responses'] / total_responses) * 100,
            'uncertain_response_rate': (quality_metrics['uncertain_responses'] / total_responses) * 100
        })
        
        return {
            'quality_metrics': quality_metrics,
            'response_categories': response_categories
        }
    
    def analyze_survey_by_questions(self, survey_data: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Analyze survey responses grouped by questions.
        
        Args:
            survey_data: Dictionary mapping question IDs to lists of responses
            
        Returns:
            Dictionary with per-question analysis
        """
        question_analysis = {}
        
        for question_id, responses in survey_data.items():
            if not responses:
                continue
            
            # Filter out empty responses for analysis
            valid_responses = [r for r in responses if r and str(r).strip()]
            
            if not valid_responses:
                question_analysis[question_id] = {
                    "error": "No valid responses for this question"
                }
                continue
            
            # Response quality analysis
            quality = self.analyze_response_quality(responses)
            
            # Sentiment analysis
            sentiments = analyze_sentiment_batch(valid_responses)
            sentiment_scores = [s['polarity'] for s in sentiments]
            
            # Content analysis
            content = self.content_analyzer.analyze_content_structure(valid_responses)
            
            # Extract key themes (if enough responses)
            themes = {}
            if len(valid_responses) >= 5:
                themes = self.thematic_analyzer.identify_themes_clustering(valid_responses, min(3, len(valid_responses)//2))
            
            # Find common patterns and keywords
            all_text = ' '.join(valid_responses).lower()
            words = re.findall(r'\b\w+\b', all_text)
            word_freq = Counter(words)
            
            # Remove common words and get meaningful keywords
            meaningful_words = {word: count for word, count in word_freq.items() 
                              if len(word) > 2 and count > 1}
            
            question_analysis[question_id] = {
                "response_count": len(responses),
                "valid_responses": len(valid_responses),
                "quality_metrics": quality['quality_metrics'],
                "sentiment_summary": {
                    "mean_polarity": np.mean(sentiment_scores),
                    "sentiment_distribution": Counter([s['category'] for s in sentiments])
                },
                "content_summary": {
                    "avg_words": content.get('avg_words_per_document', 0),
                    "total_words": content.get('total_words', 0)
                },
                "themes": themes.get('themes', [])[:3],  # Top 3 themes
                "common_keywords": list(meaningful_words.items())[:10],
                "representative_responses": self._get_representative_responses(valid_responses, 3)
            }
        
        return question_analysis
    
    def compare_questions(self, survey_data: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Compare responses across different survey questions.
        
        Args:
            survey_data: Dictionary mapping question IDs to lists of responses
            
        Returns:
            Dictionary with cross-question comparison
        """
        if len(survey_data) < 2:
            return {"error": "Need at least 2 questions for comparison"}
        
        question_stats = {}
        
        # Analyze each question
        for question_id, responses in survey_data.items():
            valid_responses = [r for r in responses if r and str(r).strip()]
            
            if valid_responses:
                # Basic statistics
                sentiments = analyze_sentiment_batch(valid_responses)
                sentiment_scores = [s['polarity'] for s in sentiments]
                word_counts = [len(str(r).split()) for r in valid_responses]
                
                question_stats[question_id] = {
                    'response_count': len(valid_responses),
                    'avg_sentiment': np.mean(sentiment_scores),
                    'avg_word_count': np.mean(word_counts),
                    'response_rate': len(valid_responses) / len(responses) * 100,
                    'sentiment_variance': np.var(sentiment_scores)
                }
        
        # Find patterns across questions
        comparisons = []
        question_ids = list(question_stats.keys())
        
        for i, q1 in enumerate(question_ids):
            for q2 in question_ids[i+1:]:
                stats1 = question_stats[q1]
                stats2 = question_stats[q2]
                
                comparison = {
                    'question1': q1,
                    'question2': q2,
                    'sentiment_difference': abs(stats1['avg_sentiment'] - stats2['avg_sentiment']),
                    'word_count_difference': abs(stats1['avg_word_count'] - stats2['avg_word_count']),
                    'response_rate_difference': abs(stats1['response_rate'] - stats2['response_rate'])
                }
                
                comparisons.append(comparison)
        
        # Sort by sentiment difference to find most contrasting questions
        comparisons.sort(key=lambda x: x['sentiment_difference'], reverse=True)
        
        return {
            'question_statistics': question_stats,
            'question_comparisons': comparisons,
            'summary': {
                'most_positive_question': max(question_stats.items(), key=lambda x: x[1]['avg_sentiment'])[0],
                'most_negative_question': min(question_stats.items(), key=lambda x: x[1]['avg_sentiment'])[0],
                'highest_response_rate': max(question_stats.items(), key=lambda x: x[1]['response_rate'])[0],
                'most_detailed_responses': max(question_stats.items(), key=lambda x: x[1]['avg_word_count'])[0]
            }
        }
    
    def analyze_respondent_patterns(self, survey_data: Dict[str, List[str]], 
                                   respondent_metadata: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Analyze patterns across individual respondents.
        
        Args:
            survey_data: Dictionary mapping question IDs to lists of responses
            respondent_metadata: Optional metadata about respondents
            
        Returns:
            Dictionary with respondent pattern analysis
        """
        if not survey_data:
            return {"error": "No survey data provided"}
        
        # Assume all questions have the same number of responses (same respondents)
        question_ids = list(survey_data.keys())
        num_respondents = len(survey_data[question_ids[0]]) if question_ids else 0
        
        respondent_analysis = []
        
        for i in range(num_respondents):
            respondent_responses = {}
            valid_response_count = 0
            total_words = 0
            sentiments = []
            
            # Collect responses from this respondent across all questions
            for question_id in question_ids:
                if i < len(survey_data[question_id]):
                    response = survey_data[question_id][i]
                    respondent_responses[question_id] = response
                    
                    if response and str(response).strip():
                        valid_response_count += 1
                        total_words += len(str(response).split())
                        
                        # Analyze sentiment for this response
                        sentiment = analyze_sentiment_batch([str(response)])[0]
                        sentiments.append(sentiment['polarity'])
            
            # Calculate respondent statistics
            respondent_stats = {
                'respondent_id': i,
                'responses': respondent_responses,
                'response_count': valid_response_count,
                'response_rate': valid_response_count / len(question_ids) * 100,
                'total_words': total_words,
                'avg_words_per_response': total_words / valid_response_count if valid_response_count > 0 else 0,
                'avg_sentiment': np.mean(sentiments) if sentiments else 0,
                'sentiment_consistency': 1 - np.std(sentiments) if len(sentiments) > 1 else 1,
                'engagement_level': self._calculate_engagement_level(valid_response_count, total_words, len(question_ids))
            }
            
            # Add metadata if provided
            if respondent_metadata and i < len(respondent_metadata):
                respondent_stats['metadata'] = respondent_metadata[i]
            
            respondent_analysis.append(respondent_stats)
        
        # Calculate overall patterns
        response_rates = [r['response_rate'] for r in respondent_analysis]
        engagement_levels = [r['engagement_level'] for r in respondent_analysis]
        sentiment_scores = [r['avg_sentiment'] for r in respondent_analysis if r['avg_sentiment'] != 0]
        
        summary_stats = {
            'total_respondents': num_respondents,
            'avg_response_rate': np.mean(response_rates),
            'high_engagement_respondents': sum(1 for e in engagement_levels if e == 'high'),
            'low_engagement_respondents': sum(1 for e in engagement_levels if e == 'low'),
            'avg_sentiment_across_respondents': np.mean(sentiment_scores) if sentiment_scores else 0,
            'response_rate_std': np.std(response_rates)
        }
        
        return {
            'respondent_analysis': respondent_analysis,
            'summary_statistics': summary_stats
        }
    
    def generate_survey_report(self, survey_data: Dict[str, List[str]], 
                              question_metadata: Dict[str, str] = None) -> str:
        """
        Generate a comprehensive survey analysis report.
        
        Args:
            survey_data: Dictionary mapping question IDs to lists of responses
            question_metadata: Optional question descriptions
            
        Returns:
            Human-readable survey report
        """
        if not survey_data:
            return "No survey data provided for analysis."
        
        # Perform analyses
        question_analysis = self.analyze_survey_by_questions(survey_data)
        comparison = self.compare_questions(survey_data)
        respondent_patterns = self.analyze_respondent_patterns(survey_data)
        
        report = "Survey Analysis Report\n"
        report += "=" * 25 + "\n\n"
        
        # Overview
        total_questions = len(survey_data)
        total_respondents = len(survey_data[list(survey_data.keys())[0]]) if survey_data else 0
        
        report += f"Survey Overview:\n"
        report += f"- Total questions: {total_questions}\n"
        report += f"- Total respondents: {total_respondents}\n"
        report += f"- Average response rate: {respondent_patterns['summary_statistics']['avg_response_rate']:.1f}%\n\n"
        
        # Question-by-question analysis
        report += "Question Analysis:\n"
        report += "-" * 20 + "\n"
        
        for question_id, analysis in question_analysis.items():
            if 'error' in analysis:
                continue
                
            question_desc = question_metadata.get(question_id, question_id) if question_metadata else question_id
            
            report += f"\nQuestion: {question_desc}\n"
            report += f"- Valid responses: {analysis['valid_responses']}/{analysis['response_count']}\n"
            report += f"- Average sentiment: {analysis['sentiment_summary']['mean_polarity']:.2f}\n"
            report += f"- Average words per response: {analysis['content_summary']['avg_words']:.1f}\n"
            
            if analysis['themes']:
                report += f"- Main themes: {', '.join([t.get('keywords', [''])[0] for t in analysis['themes'][:2]])}\n"
            
            if analysis['representative_responses']:
                report += f"- Sample response: \"{analysis['representative_responses'][0][:100]}...\"\n"
        
        # Cross-question comparisons
        if 'summary' in comparison:
            report += f"\nCross-Question Insights:\n"
            report += f"- Most positive question: {comparison['summary']['most_positive_question']}\n"
            report += f"- Highest response rate: {comparison['summary']['highest_response_rate']}\n"
            report += f"- Most detailed responses: {comparison['summary']['most_detailed_responses']}\n"
        
        # Respondent patterns
        summary = respondent_patterns['summary_statistics']
        report += f"\nRespondent Patterns:\n"
        report += f"- High engagement respondents: {summary['high_engagement_respondents']}\n"
        report += f"- Low engagement respondents: {summary['low_engagement_respondents']}\n"
        report += f"- Response consistency (std): {summary['response_rate_std']:.2f}\n"
        
        return report
    
    def _get_representative_responses(self, responses: List[str], n: int = 3) -> List[str]:
        """
        Get representative responses from a list.
        
        Args:
            responses: List of responses
            n: Number of representative responses to return
            
        Returns:
            List of representative responses
        """
        if not responses or n <= 0:
            return []
        
        # Sort by length and pick diverse responses
        sorted_responses = sorted(responses, key=len, reverse=True)
        
        # Try to get responses of different lengths
        representatives = []
        used_indices = set()
        
        # Get longest response
        if sorted_responses:
            representatives.append(sorted_responses[0])
            used_indices.add(0)
        
        # Get medium length response
        if len(sorted_responses) > 2 and len(representatives) < n:
            mid_idx = len(sorted_responses) // 2
            if mid_idx not in used_indices:
                representatives.append(sorted_responses[mid_idx])
                used_indices.add(mid_idx)
        
        # Get shorter response
        if len(sorted_responses) > 1 and len(representatives) < n:
            last_idx = len(sorted_responses) - 1
            if last_idx not in used_indices:
                representatives.append(sorted_responses[last_idx])
        
        return representatives[:n]
    
    def _calculate_engagement_level(self, response_count: int, total_words: int, 
                                   total_questions: int) -> str:
        """
        Calculate engagement level based on response patterns.
        
        Args:
            response_count: Number of responses given
            total_words: Total words across all responses
            total_questions: Total questions in survey
            
        Returns:
            Engagement level ('high', 'medium', 'low')
        """
        response_rate = response_count / total_questions
        avg_words = total_words / response_count if response_count > 0 else 0
        
        if response_rate >= 0.8 and avg_words >= 10:
            return 'high'
        elif response_rate >= 0.5 and avg_words >= 5:
            return 'medium'
        else:
            return 'low'

def analyze_survey_data(survey_data: Dict[str, List[str]], 
                       question_metadata: Dict[str, str] = None,
                       respondent_metadata: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Comprehensive analysis of survey data.
    
    Args:
        survey_data: Dictionary mapping question IDs to response lists
        question_metadata: Optional question descriptions
        respondent_metadata: Optional respondent information
        
    Returns:
        Dictionary with comprehensive survey analysis
    """
    analyzer = SurveyAnalyzer()
    
    results = {
        'question_analysis': analyzer.analyze_survey_by_questions(survey_data),
        'question_comparison': analyzer.compare_questions(survey_data),
        'respondent_analysis': analyzer.analyze_respondent_patterns(survey_data, respondent_metadata),
        'summary_report': analyzer.generate_survey_report(survey_data, question_metadata)
    }
    
    return results 