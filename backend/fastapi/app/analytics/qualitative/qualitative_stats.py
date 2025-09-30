"""
Comprehensive qualitative statistics module.
Provides overall statistics, summaries, and insights for qualitative research data.
"""

from typing import Dict, Any, List, Tuple, Optional, Union
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
import re
from datetime import datetime
import json

class QualitativeStatistics:
    """
    Comprehensive statistics calculator for qualitative research data.
    """
    
    def __init__(self):
        self.data_cache = {}
        self.analysis_history = []
    
    def calculate_basic_statistics(self, texts: List[str]) -> Dict[str, Any]:
        """
        Calculate basic descriptive statistics for qualitative data.
        
        Args:
            texts: List of text documents
            
        Returns:
            Dictionary with basic statistics
        """
        if not texts:
            return {"error": "No texts provided"}
        
        # Text-level statistics
        text_lengths = [len(text) for text in texts]
        word_counts = [len(text.split()) for text in texts]
        sentence_counts = [len(re.split(r'[.!?]+', text)) for text in texts]
        
        # Word-level statistics
        all_words = []
        for text in texts:
            words = re.findall(r'\b\w+\b', text.lower())
            all_words.extend(words)
        
        unique_words = set(all_words)
        word_frequencies = Counter(all_words)
        
        # Calculate statistics
        stats = {
            'document_statistics': {
                'total_documents': len(texts),
                'total_characters': sum(text_lengths),
                'total_words': len(all_words),
                'total_sentences': sum(sentence_counts),
                'unique_words': len(unique_words),
                'avg_characters_per_document': np.mean(text_lengths),
                'avg_words_per_document': np.mean(word_counts),
                'avg_sentences_per_document': np.mean(sentence_counts),
                'std_characters_per_document': np.std(text_lengths),
                'std_words_per_document': np.std(word_counts),
                'median_words_per_document': np.median(word_counts),
                'min_words_per_document': min(word_counts) if word_counts else 0,
                'max_words_per_document': max(word_counts) if word_counts else 0
            },
            'vocabulary_statistics': {
                'vocabulary_size': len(unique_words),
                'lexical_diversity': len(unique_words) / len(all_words) if all_words else 0,
                'most_frequent_words': word_frequencies.most_common(20),
                'hapax_legomena': sum(1 for count in word_frequencies.values() if count == 1),
                'avg_word_frequency': np.mean(list(word_frequencies.values())),
                'word_frequency_distribution': {
                    'singleton_words': sum(1 for c in word_frequencies.values() if c == 1),
                    'doubleton_words': sum(1 for c in word_frequencies.values() if c == 2),
                    'high_frequency_words': sum(1 for c in word_frequencies.values() if c >= 10)
                }
            },
            'distribution_statistics': {
                'document_length_quartiles': {
                    'q1': np.percentile(word_counts, 25),
                    'q2': np.percentile(word_counts, 50),
                    'q3': np.percentile(word_counts, 75)
                },
                'skewness': float(pd.Series(word_counts).skew()) if len(word_counts) > 1 else 0,
                'kurtosis': float(pd.Series(word_counts).kurtosis()) if len(word_counts) > 1 else 0
            }
        }
        
        return stats
    
    def calculate_data_quality_metrics(self, texts: List[str]) -> Dict[str, Any]:
        """
        Calculate comprehensive data quality metrics.
        
        Args:
            texts: List of text documents
            
        Returns:
            Dictionary with quality metrics
        """
        if not texts:
            return {"error": "No texts provided"}
        
        total_texts = len(texts)
        
        # Completeness metrics
        empty_texts = sum(1 for text in texts if not text or not text.strip())
        very_short_texts = sum(1 for text in texts if len(text.split()) < 3)
        
        # Content quality indicators
        repetitive_texts = 0
        low_information_texts = 0
        
        for text in texts:
            words = text.split()
            if len(words) > 5:
                # Check for repetitive content
                unique_words = len(set(words))
                if unique_words / len(words) < 0.5:  # Less than 50% unique words
                    repetitive_texts += 1
                
                # Check for low information content
                common_filler = {'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
                content_words = [w for w in words if w.lower() not in common_filler]
                if len(content_words) / len(words) < 0.3:  # Less than 30% content words
                    low_information_texts += 1
        
        quality_metrics = {
            'completeness': {
                'total_responses': total_texts,
                'empty_responses': empty_texts,
                'very_short_responses': very_short_texts,
                'usable_responses': total_texts - empty_texts - very_short_texts,
                'completion_rate': ((total_texts - empty_texts) / total_texts) * 100 if total_texts > 0 else 0,
                'usability_rate': ((total_texts - empty_texts - very_short_texts) / total_texts) * 100 if total_texts > 0 else 0
            },
            'content_quality': {
                'repetitive_responses': repetitive_texts,
                'low_information_responses': low_information_texts,
                'high_quality_responses': total_texts - repetitive_texts - low_information_texts,
                'content_richness_score': ((total_texts - repetitive_texts - low_information_texts) / total_texts) * 100 if total_texts > 0 else 0
            },
            'overall_quality_score': 0  # Will be calculated below
        }
        
        # Calculate overall quality score
        completion_weight = 0.6
        content_weight = 0.4
        
        overall_score = (
            quality_metrics['completeness']['usability_rate'] * completion_weight +
            quality_metrics['content_quality']['content_richness_score'] * content_weight
        )
        
        quality_metrics['overall_quality_score'] = overall_score
        
        return quality_metrics
    
    def generate_comprehensive_summary(self, texts: List[str], 
                                     metadata: List[Dict[str, Any]] = None,
                                     analysis_type: str = "general") -> Dict[str, Any]:
        """
        Generate a comprehensive summary of qualitative data.
        
        Args:
            texts: List of text documents
            metadata: Optional metadata for each text
            analysis_type: Type of analysis ("survey", "interview", "general")
            
        Returns:
            Dictionary with comprehensive summary
        """
        if not texts:
            return {"error": "No texts provided"}
        
        # Perform all analyses
        basic_stats = self.calculate_basic_statistics(texts)
        quality_metrics = self.calculate_data_quality_metrics(texts)
        
        # Create comprehensive summary
        summary = {
            'dataset_overview': {
                'total_documents': len(texts),
                'analysis_type': analysis_type,
                'analysis_timestamp': datetime.now().isoformat(),
                'data_quality_score': quality_metrics.get('overall_quality_score', 0)
            },
            'content_summary': {
                'total_words': basic_stats['document_statistics']['total_words'],
                'vocabulary_size': basic_stats['vocabulary_statistics']['vocabulary_size'],
                'lexical_diversity': basic_stats['vocabulary_statistics']['lexical_diversity'],
                'avg_document_length': basic_stats['document_statistics']['avg_words_per_document']
            },
            'response_characteristics': {
                'completion_rate': quality_metrics['completeness']['completion_rate'],
                'content_richness': quality_metrics['content_quality']['content_richness_score']
            },
            'key_insights': self._generate_key_insights(basic_stats, quality_metrics),
            'recommendations': self._generate_recommendations(quality_metrics, analysis_type),
            'detailed_statistics': {
                'basic_statistics': basic_stats,
                'quality_metrics': quality_metrics
            }
        }
        
        return summary
    
    def _generate_key_insights(self, basic_stats: Dict[str, Any], 
                              quality_metrics: Dict[str, Any]) -> List[str]:
        """
        Generate key insights from the analysis.
        """
        insights = []
        
        # Document length insights
        avg_words = basic_stats['document_statistics']['avg_words_per_document']
        if avg_words < 10:
            insights.append(f"Responses are quite brief (avg: {avg_words:.1f} words). Consider encouraging more detailed responses.")
        elif avg_words > 100:
            insights.append(f"Responses are very detailed (avg: {avg_words:.1f} words), indicating high engagement.")
        
        # Quality insights
        quality_score = quality_metrics.get('overall_quality_score', 0)
        if quality_score > 80:
            insights.append("Data quality is excellent with high completion and content richness.")
        elif quality_score < 50:
            insights.append("Data quality concerns detected. Consider reviewing data collection methods.")
        
        # Vocabulary insights
        lexical_diversity = basic_stats['vocabulary_statistics']['lexical_diversity']
        if lexical_diversity > 0.7:
            insights.append("High lexical diversity indicates rich and varied language use.")
        elif lexical_diversity < 0.3:
            insights.append("Low lexical diversity suggests repetitive language or constrained responses.")
        
        return insights
    
    def _generate_recommendations(self, quality_metrics: Dict[str, Any], 
                                 analysis_type: str) -> List[str]:
        """
        Generate recommendations based on the analysis.
        """
        recommendations = []
        
        # Completion rate recommendations
        completion_rate = quality_metrics['completeness']['completion_rate']
        if completion_rate < 70:
            recommendations.append("Consider simplifying questions or providing better instructions to improve response rates.")
        
        # Content quality recommendations
        content_richness = quality_metrics['content_quality']['content_richness_score']
        if content_richness < 60:
            recommendations.append("Implement strategies to encourage more detailed and varied responses.")
        
        # Analysis type specific recommendations
        if analysis_type == "survey":
            recommendations.append("For survey data, consider implementing response validation and optional follow-up questions.")
        elif analysis_type == "interview":
            recommendations.append("For interview data, ensure consistent probing techniques across interviews.")
        
        return recommendations

def generate_qualitative_report(texts: List[str], 
                               metadata: List[Dict[str, Any]] = None,
                               analysis_type: str = "general") -> str:
    """
    Generate a comprehensive qualitative data report.
    
    Args:
        texts: List of text documents
        metadata: Optional metadata
        analysis_type: Type of analysis
        
    Returns:
        Human-readable comprehensive report
    """
    stats = QualitativeStatistics()
    summary = stats.generate_comprehensive_summary(texts, metadata, analysis_type)
    
    if "error" in summary:
        return f"Error generating report: {summary['error']}"
    
    report = "Comprehensive Qualitative Data Analysis Report\n"
    report += "=" * 50 + "\n\n"
    
    # Overview
    overview = summary['dataset_overview']
    report += f"Dataset Overview:\n"
    report += f"- Total documents: {overview['total_documents']}\n"
    report += f"- Analysis type: {overview['analysis_type']}\n"
    report += f"- Overall data quality score: {overview['data_quality_score']:.1f}/100\n\n"
    
    # Content summary
    content = summary['content_summary']
    report += f"Content Summary:\n"
    report += f"- Total words: {content['total_words']:,}\n"
    report += f"- Vocabulary size: {content['vocabulary_size']:,}\n"
    report += f"- Lexical diversity: {content['lexical_diversity']:.3f}\n"
    report += f"- Average document length: {content['avg_document_length']:.1f} words\n\n"
    
    # Response characteristics
    characteristics = summary['response_characteristics']
    report += f"Response Characteristics:\n"
    report += f"- Completion rate: {characteristics['completion_rate']:.1f}%\n"
    report += f"- Content richness score: {characteristics['content_richness']:.1f}%\n\n"
    
    # Key insights
    insights = summary['key_insights']
    if insights:
        report += "Key Insights:\n"
        for i, insight in enumerate(insights, 1):
            report += f"{i}. {insight}\n"
        report += "\n"
    
    # Recommendations
    recommendations = summary['recommendations']
    if recommendations:
        report += "Recommendations:\n"
        for i, recommendation in enumerate(recommendations, 1):
            report += f"{i}. {recommendation}\n"
    
    return report 