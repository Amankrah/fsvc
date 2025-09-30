"""
Content analysis module for systematic analysis of textual content.
Provides quantitative and qualitative content analysis capabilities.
"""

from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
import re
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.tag import pos_tag

class ContentAnalyzer:
    """
    Comprehensive content analysis tool for research data.
    """
    
    def __init__(self):
        try:
            self.stop_words = set(stopwords.words('english'))
        except:
            self.stop_words = set()
        
        # Content categories for analysis
        self.content_categories = {
            'emotional_words': ['happy', 'sad', 'angry', 'excited', 'worried', 'calm', 'frustrated'],
            'action_words': ['do', 'make', 'create', 'build', 'destroy', 'help', 'support'],
            'descriptive_words': ['good', 'bad', 'excellent', 'poor', 'amazing', 'terrible'],
            'temporal_words': ['now', 'today', 'tomorrow', 'yesterday', 'future', 'past', 'always', 'never']
        }
    
    def analyze_content_structure(self, texts: List[str]) -> Dict[str, Any]:
        """
        Analyze the structural characteristics of content.
        
        Args:
            texts: List of text documents
            
        Returns:
            Dictionary with structural analysis
        """
        if not texts:
            return {"error": "No texts provided for analysis"}
        
        structure_metrics = {
            'document_count': len(texts),
            'total_words': 0,
            'total_sentences': 0,
            'total_characters': 0,
            'avg_words_per_document': 0,
            'avg_sentences_per_document': 0,
            'avg_characters_per_document': 0,
            'avg_word_length': 0,
            'avg_sentence_length': 0
        }
        
        word_lengths = []
        sentence_lengths = []
        doc_word_counts = []
        doc_sentence_counts = []
        doc_char_counts = []
        
        for text in texts:
            # Character count
            char_count = len(text)
            doc_char_counts.append(char_count)
            structure_metrics['total_characters'] += char_count
            
            # Word analysis
            words = word_tokenize(text.lower())
            words = [w for w in words if w.isalpha() and w not in self.stop_words]
            word_count = len(words)
            doc_word_counts.append(word_count)
            structure_metrics['total_words'] += word_count
            
            # Word lengths
            word_lengths.extend([len(w) for w in words])
            
            # Sentence analysis
            sentences = sent_tokenize(text)
            sentence_count = len(sentences)
            doc_sentence_counts.append(sentence_count)
            structure_metrics['total_sentences'] += sentence_count
            
            # Sentence lengths (in words)
            for sentence in sentences:
                sentence_words = word_tokenize(sentence)
                sentence_lengths.append(len(sentence_words))
        
        # Calculate averages
        structure_metrics['avg_words_per_document'] = np.mean(doc_word_counts)
        structure_metrics['avg_sentences_per_document'] = np.mean(doc_sentence_counts)
        structure_metrics['avg_characters_per_document'] = np.mean(doc_char_counts)
        structure_metrics['avg_word_length'] = np.mean(word_lengths) if word_lengths else 0
        structure_metrics['avg_sentence_length'] = np.mean(sentence_lengths) if sentence_lengths else 0
        
        # Additional statistics
        structure_metrics['word_length_distribution'] = {
            'min': int(min(word_lengths)) if word_lengths else 0,
            'max': int(max(word_lengths)) if word_lengths else 0,
            'std': float(np.std(word_lengths)) if word_lengths else 0
        }
        
        structure_metrics['document_length_distribution'] = {
            'min_words': int(min(doc_word_counts)) if doc_word_counts else 0,
            'max_words': int(max(doc_word_counts)) if doc_word_counts else 0,
            'std_words': float(np.std(doc_word_counts)) if doc_word_counts else 0
        }
        
        return structure_metrics
    
    def analyze_content_categories(self, texts: List[str], 
                                 custom_categories: Dict[str, List[str]] = None) -> Dict[str, Any]:
        """
        Analyze content based on predefined or custom categories.
        
        Args:
            texts: List of text documents
            custom_categories: Optional custom categories to analyze
            
        Returns:
            Dictionary with category analysis
        """
        categories = custom_categories or self.content_categories
        
        category_counts = {cat: [] for cat in categories.keys()}
        category_frequencies = {cat: 0 for cat in categories.keys()}
        document_category_presence = []
        
        for text in texts:
            text_lower = text.lower()
            words = word_tokenize(text_lower)
            words = [w for w in words if w.isalpha()]
            
            doc_categories = {}
            
            for category, keywords in categories.items():
                count = sum(1 for word in words if word in keywords)
                category_counts[category].append(count)
                category_frequencies[category] += count
                doc_categories[category] = count
            
            document_category_presence.append(doc_categories)
        
        # Calculate statistics for each category
        category_stats = {}
        for category in categories.keys():
            counts = category_counts[category]
            category_stats[category] = {
                'total_occurrences': category_frequencies[category],
                'avg_per_document': np.mean(counts),
                'std_per_document': np.std(counts),
                'max_per_document': max(counts) if counts else 0,
                'documents_with_category': sum(1 for c in counts if c > 0),
                'percentage_of_documents': (sum(1 for c in counts if c > 0) / len(texts)) * 100
            }
        
        return {
            'category_statistics': category_stats,
            'document_category_presence': document_category_presence,
            'most_prominent_category': max(category_frequencies.items(), key=lambda x: x[1])[0] if category_frequencies else None
        }
    
    def analyze_linguistic_features(self, texts: List[str]) -> Dict[str, Any]:
        """
        Analyze linguistic features of the content.
        
        Args:
            texts: List of text documents
            
        Returns:
            Dictionary with linguistic analysis
        """
        if not texts:
            return {"error": "No texts provided"}
        
        pos_counts = Counter()
        question_count = 0
        exclamation_count = 0
        all_words = []
        
        for text in texts:
            # Count questions and exclamations
            question_count += text.count('?')
            exclamation_count += text.count('!')
            
            # POS tagging
            words = word_tokenize(text)
            try:
                pos_tags = pos_tag(words)
                for word, pos in pos_tags:
                    if word.isalpha():
                        pos_counts[pos] += 1
                        all_words.append(word.lower())
            except:
                # Fallback if POS tagging fails
                all_words.extend([w.lower() for w in words if w.isalpha()])
        
        # Calculate readability metrics (simplified)
        total_words = len(all_words)
        unique_words = len(set(all_words))
        lexical_diversity = unique_words / total_words if total_words > 0 else 0
        
        # Most common POS tags
        common_pos = pos_counts.most_common(10)
        
        return {
            'pos_tag_distribution': dict(pos_counts),
            'most_common_pos_tags': common_pos,
            'lexical_diversity': lexical_diversity,
            'total_unique_words': unique_words,
            'total_words': total_words,
            'question_density': question_count / len(texts),
            'exclamation_density': exclamation_count / len(texts),
            'linguistic_complexity': {
                'avg_pos_per_text': len(pos_counts) / len(texts) if len(texts) > 0 else 0,
                'noun_ratio': pos_counts.get('NN', 0) / total_words if total_words > 0 else 0,
                'verb_ratio': pos_counts.get('VB', 0) / total_words if total_words > 0 else 0,
                'adjective_ratio': pos_counts.get('JJ', 0) / total_words if total_words > 0 else 0
            }
        }
    
    def analyze_content_patterns(self, texts: List[str]) -> Dict[str, Any]:
        """
        Identify patterns in content across documents.
        
        Args:
            texts: List of text documents
            
        Returns:
            Dictionary with pattern analysis
        """
        if not texts:
            return {"error": "No texts provided"}
        
        # Extract n-grams
        bigrams = []
        trigrams = []
        
        for text in texts:
            words = word_tokenize(text.lower())
            words = [w for w in words if w.isalpha() and w not in self.stop_words]
            
            # Bigrams
            for i in range(len(words) - 1):
                bigrams.append(f"{words[i]} {words[i+1]}")
            
            # Trigrams
            for i in range(len(words) - 2):
                trigrams.append(f"{words[i]} {words[i+1]} {words[i+2]}")
        
        # Count patterns
        bigram_counts = Counter(bigrams)
        trigram_counts = Counter(trigrams)
        
        # Find repeating phrases (simple approach)
        phrase_patterns = []
        for text in texts:
            # Look for repeated phrases within each text
            sentences = sent_tokenize(text)
            for i, sentence1 in enumerate(sentences):
                for j, sentence2 in enumerate(sentences[i+1:], i+1):
                    # Simple similarity check
                    words1 = set(word_tokenize(sentence1.lower()))
                    words2 = set(word_tokenize(sentence2.lower()))
                    overlap = len(words1.intersection(words2))
                    if overlap >= 3:  # At least 3 words in common
                        phrase_patterns.append({
                            'sentence1': sentence1,
                            'sentence2': sentence2,
                            'word_overlap': overlap
                        })
        
        return {
            'common_bigrams': bigram_counts.most_common(20),
            'common_trigrams': trigram_counts.most_common(15),
            'total_bigrams': len(bigram_counts),
            'total_trigrams': len(trigram_counts),
            'phrase_patterns': phrase_patterns[:10],  # Top 10 patterns
            'pattern_diversity': {
                'unique_bigrams': len(bigram_counts),
                'unique_trigrams': len(trigram_counts),
                'bigram_repetition_rate': (len(bigrams) - len(bigram_counts)) / len(bigrams) if bigrams else 0
            }
        }
    
    def analyze_content_by_metadata(self, texts: List[str], 
                                   metadata: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze content patterns by metadata categories.
        
        Args:
            texts: List of text documents
            metadata: List of metadata dictionaries for each text
            
        Returns:
            Dictionary with metadata-based analysis
        """
        if len(texts) != len(metadata):
            return {"error": "Texts and metadata lists must have same length"}
        
        # Group texts by metadata categories
        metadata_groups = defaultdict(list)
        
        for text, meta in zip(texts, metadata):
            for key, value in meta.items():
                if isinstance(value, (str, int, float)):
                    group_key = f"{key}_{value}"
                    metadata_groups[group_key].append(text)
        
        # Analyze each group
        group_analysis = {}
        
        for group_name, group_texts in metadata_groups.items():
            if len(group_texts) >= 2:  # Need at least 2 texts for meaningful analysis
                structure = self.analyze_content_structure(group_texts)
                categories = self.analyze_content_categories(group_texts)
                linguistic = self.analyze_linguistic_features(group_texts)
                
                group_analysis[group_name] = {
                    'text_count': len(group_texts),
                    'avg_word_count': structure.get('avg_words_per_document', 0),
                    'lexical_diversity': linguistic.get('lexical_diversity', 0),
                    'most_prominent_category': categories.get('most_prominent_category'),
                    'summary_stats': {
                        'total_words': structure.get('total_words', 0),
                        'avg_sentence_length': structure.get('avg_sentence_length', 0),
                        'question_density': linguistic.get('question_density', 0)
                    }
                }
        
        return {
            'group_analysis': group_analysis,
            'total_groups': len(group_analysis),
            'largest_group': max(group_analysis.items(), key=lambda x: x[1]['text_count']) if group_analysis else None
        }
    
    def generate_content_report(self, texts: List[str], 
                               metadata: List[Dict[str, Any]] = None) -> str:
        """
        Generate a comprehensive content analysis report.
        
        Args:
            texts: List of text documents
            metadata: Optional metadata for each text
            
        Returns:
            Human-readable content analysis report
        """
        if not texts:
            return "No texts provided for analysis."
        
        # Perform analyses
        structure = self.analyze_content_structure(texts)
        categories = self.analyze_content_categories(texts)
        linguistic = self.analyze_linguistic_features(texts)
        patterns = self.analyze_content_patterns(texts)
        
        report = "Content Analysis Report\n"
        report += "=" * 30 + "\n\n"
        
        # Overview
        report += f"Document Overview:\n"
        report += f"- Total documents: {structure['document_count']}\n"
        report += f"- Total words: {structure['total_words']}\n"
        report += f"- Average words per document: {structure['avg_words_per_document']:.1f}\n"
        report += f"- Average sentences per document: {structure['avg_sentences_per_document']:.1f}\n\n"
        
        # Linguistic features
        report += f"Linguistic Features:\n"
        report += f"- Lexical diversity: {linguistic['lexical_diversity']:.3f}\n"
        report += f"- Unique words: {linguistic['total_unique_words']}\n"
        report += f"- Question density: {linguistic['question_density']:.2f} per document\n"
        report += f"- Exclamation density: {linguistic['exclamation_density']:.2f} per document\n\n"
        
        # Content categories
        if categories.get('most_prominent_category'):
            report += f"Content Categories:\n"
            report += f"- Most prominent category: {categories['most_prominent_category']}\n"
            
            cat_stats = categories['category_statistics']
            for category, stats in list(cat_stats.items())[:3]:
                report += f"- {category}: {stats['percentage_of_documents']:.1f}% of documents\n"
            report += "\n"
        
        # Patterns
        report += f"Content Patterns:\n"
        report += f"- Common bigrams found: {patterns['total_bigrams']}\n"
        report += f"- Common trigrams found: {patterns['total_trigrams']}\n"
        
        if patterns['common_bigrams']:
            report += f"- Most common phrase: '{patterns['common_bigrams'][0][0]}'\n"
        
        report += f"- Bigram repetition rate: {patterns['pattern_diversity']['bigram_repetition_rate']:.2f}\n\n"
        
        # Metadata analysis
        if metadata:
            meta_analysis = self.analyze_content_by_metadata(texts, metadata)
            report += f"Metadata Analysis:\n"
            report += f"- Total groups identified: {meta_analysis['total_groups']}\n"
            
            if meta_analysis.get('largest_group'):
                largest = meta_analysis['largest_group']
                report += f"- Largest group: {largest[0]} ({largest[1]['text_count']} documents)\n"
        
        return report

def analyze_content_comprehensively(texts: List[str], 
                                  metadata: List[Dict[str, Any]] = None,
                                  custom_categories: Dict[str, List[str]] = None) -> Dict[str, Any]:
    """
    Perform comprehensive content analysis on a collection of texts.
    
    Args:
        texts: List of text documents
        metadata: Optional metadata for each text
        custom_categories: Optional custom content categories
        
    Returns:
        Dictionary with comprehensive analysis results
    """
    analyzer = ContentAnalyzer()
    
    results = {
        'structure_analysis': analyzer.analyze_content_structure(texts),
        'category_analysis': analyzer.analyze_content_categories(texts, custom_categories),
        'linguistic_analysis': analyzer.analyze_linguistic_features(texts),
        'pattern_analysis': analyzer.analyze_content_patterns(texts)
    }
    
    if metadata:
        results['metadata_analysis'] = analyzer.analyze_content_by_metadata(texts, metadata)
    
    # Generate summary
    results['summary'] = analyzer.generate_content_report(texts, metadata)
    
    return results 