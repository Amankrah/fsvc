"""
Thematic analysis module for qualitative research data.
Provides tools for identifying themes, patterns, and concepts in text data.
"""

from typing import Dict, Any, List, Tuple, Set
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from sklearn.decomposition import LatentDirichletAllocation
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tag import pos_tag
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('wordnet', quiet=True)
    nltk.download('averaged_perceptron_tagger', quiet=True)
except:
    logger.warning("Could not download NLTK data. Some features may not work properly.")

class ThematicAnalyzer:
    """
    A comprehensive thematic analysis tool for qualitative research.
    """
    
    def __init__(self):
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        self.themes = {}
        self.coded_data = {}
    
    def preprocess_text(self, text: str) -> List[str]:
        """
        Preprocess text for thematic analysis.
        
        Args:
            text: Input text
            
        Returns:
            List of preprocessed tokens
        """
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep some punctuation for context
        text = re.sub(r'[^\w\s\.\!\?]', '', text)
        
        # Tokenize
        tokens = word_tokenize(text)
        
        # Remove stopwords and short tokens
        tokens = [token for token in tokens if token not in self.stop_words and len(token) > 2]
        
        # Lemmatize
        tokens = [self.lemmatizer.lemmatize(token) for token in tokens]
        
        return tokens
    
    def extract_key_concepts(self, texts: List[str], top_n: int = 20) -> List[Tuple[str, float]]:
        """
        Extract key concepts using TF-IDF.
        
        Args:
            texts: List of text documents
            top_n: Number of top concepts to return
            
        Returns:
            List of (concept, score) tuples
        """
        if not texts:
            return []
        
        # Preprocess texts
        processed_texts = [' '.join(self.preprocess_text(text)) for text in texts]
        
        # Use TF-IDF to extract key terms
        vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 3),
            min_df=2,
            max_df=0.8
        )
        
        try:
            tfidf_matrix = vectorizer.fit_transform(processed_texts)
            feature_names = vectorizer.get_feature_names_out()
            
            # Calculate mean TF-IDF scores
            mean_scores = np.array(tfidf_matrix.mean(axis=0)).flatten()
            
            # Get top concepts
            top_indices = mean_scores.argsort()[-top_n:][::-1]
            key_concepts = [(feature_names[i], mean_scores[i]) for i in top_indices]
            
            return key_concepts
        except Exception as e:
            logger.error(f"Error in key concept extraction: {e}")
            return []
    
    def identify_themes_clustering(self, texts: List[str], n_themes: int = 5) -> Dict[str, Any]:
        """
        Identify themes using clustering approach.
        
        Args:
            texts: List of text documents
            n_themes: Number of themes to identify
            
        Returns:
            Dictionary with theme information
        """
        if not texts or len(texts) < n_themes:
            return {"themes": [], "assignments": [], "coherence": 0}
        
        # Preprocess and vectorize texts
        processed_texts = [' '.join(self.preprocess_text(text)) for text in texts]
        
        vectorizer = TfidfVectorizer(
            max_features=500,
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.8
        )
        
        try:
            tfidf_matrix = vectorizer.fit_transform(processed_texts)
            feature_names = vectorizer.get_feature_names_out()
            
            # Perform clustering
            kmeans = KMeans(n_clusters=n_themes, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(tfidf_matrix)
            
            # Extract theme keywords
            themes = []
            for i in range(n_themes):
                # Get centroid
                centroid = kmeans.cluster_centers_[i]
                
                # Get top keywords for this theme
                top_indices = centroid.argsort()[-10:][::-1]
                keywords = [feature_names[idx] for idx in top_indices]
                
                # Get representative texts
                theme_texts = [texts[j] for j, label in enumerate(cluster_labels) if label == i]
                
                themes.append({
                    "theme_id": i,
                    "keywords": keywords,
                    "representative_texts": theme_texts[:3],
                    "text_count": len(theme_texts),
                    "percentage": (len(theme_texts) / len(texts)) * 100
                })
            
            # Calculate coherence (simplified measure)
            coherence = self._calculate_theme_coherence(themes)
            
            return {
                "themes": themes,
                "assignments": cluster_labels.tolist(),
                "coherence": coherence,
                "method": "clustering"
            }
        
        except Exception as e:
            logger.error(f"Error in theme identification: {e}")
            return {"themes": [], "assignments": [], "coherence": 0}
    
    def identify_themes_lda(self, texts: List[str], n_themes: int = 5) -> Dict[str, Any]:
        """
        Identify themes using Latent Dirichlet Allocation.
        
        Args:
            texts: List of text documents
            n_themes: Number of themes to identify
            
        Returns:
            Dictionary with theme information
        """
        if not texts or len(texts) < n_themes:
            return {"themes": [], "coherence": 0}
        
        # Preprocess texts
        processed_texts = [' '.join(self.preprocess_text(text)) for text in texts]
        
        # Vectorize using count vectorizer (LDA works better with counts)
        vectorizer = TfidfVectorizer(
            max_features=500,
            ngram_range=(1, 2),
            min_df=2,
            max_df=0.8,
            use_idf=False,  # Use term frequency only
            norm=None
        )
        
        try:
            doc_term_matrix = vectorizer.fit_transform(processed_texts)
            feature_names = vectorizer.get_feature_names_out()
            
            # Perform LDA
            lda = LatentDirichletAllocation(
                n_components=n_themes,
                random_state=42,
                max_iter=10,
                learning_method='online'
            )
            lda.fit(doc_term_matrix)
            
            # Extract themes
            themes = []
            for i, topic in enumerate(lda.components_):
                top_indices = topic.argsort()[-10:][::-1]
                keywords = [feature_names[idx] for idx in top_indices]
                keyword_weights = [topic[idx] for idx in top_indices]
                
                themes.append({
                    "theme_id": i,
                    "keywords": keywords,
                    "keyword_weights": keyword_weights,
                    "topic_distribution": topic.tolist()
                })
            
            # Get document-topic probabilities
            doc_topic_probs = lda.transform(doc_term_matrix)
            
            return {
                "themes": themes,
                "document_topic_probabilities": doc_topic_probs.tolist(),
                "perplexity": lda.perplexity(doc_term_matrix),
                "method": "lda"
            }
        
        except Exception as e:
            logger.error(f"Error in LDA theme identification: {e}")
            return {"themes": [], "coherence": 0}
    
    def analyze_theme_evolution(self, texts: List[str], timestamps: List[str], n_themes: int = 5) -> Dict[str, Any]:
        """
        Analyze how themes evolve over time.
        
        Args:
            texts: List of text documents
            timestamps: List of timestamps
            n_themes: Number of themes to track
            
        Returns:
            Dictionary with theme evolution analysis
        """
        if not texts or not timestamps or len(texts) != len(timestamps):
            return {"error": "Invalid input data"}
        
        # Create DataFrame
        df = pd.DataFrame({
            'text': texts,
            'timestamp': pd.to_datetime(timestamps)
        })
        
        # Sort by timestamp
        df = df.sort_values('timestamp')
        
        # Group by time periods (daily, weekly, monthly based on data span)
        time_span = (df['timestamp'].max() - df['timestamp'].min()).days
        
        if time_span <= 7:
            freq = 'D'  # Daily
        elif time_span <= 30:
            freq = 'W'  # Weekly
        else:
            freq = 'M'  # Monthly
        
        df['period'] = df['timestamp'].dt.to_period(freq)
        
        # Analyze themes for each period
        theme_evolution = {}
        for period in df['period'].unique():
            period_texts = df[df['period'] == period]['text'].tolist()
            if len(period_texts) >= 2:  # Need minimum texts for analysis
                themes = self.identify_themes_clustering(period_texts, n_themes)
                theme_evolution[str(period)] = themes
        
        return {
            "theme_evolution": theme_evolution,
            "time_periods": [str(p) for p in df['period'].unique()],
            "frequency": freq
        }
    
    def extract_quotes_by_theme(self, texts: List[str], theme_keywords: List[str], max_quotes: int = 5) -> List[str]:
        """
        Extract representative quotes for a given theme.
        
        Args:
            texts: List of text documents
            theme_keywords: Keywords representing the theme
            max_quotes: Maximum number of quotes to return
            
        Returns:
            List of representative quotes
        """
        scored_texts = []
        
        for text in texts:
            # Calculate relevance score based on keyword presence
            text_lower = text.lower()
            score = sum(1 for keyword in theme_keywords if keyword.lower() in text_lower)
            
            if score > 0:
                scored_texts.append((text, score))
        
        # Sort by score and return top quotes
        scored_texts.sort(key=lambda x: x[1], reverse=True)
        quotes = [text for text, score in scored_texts[:max_quotes]]
        
        return quotes
    
    def analyze_theme_relationships(self, themes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze relationships between themes.
        
        Args:
            themes: List of theme dictionaries
            
        Returns:
            Dictionary with relationship analysis
        """
        if len(themes) < 2:
            return {"relationships": [], "similarity_matrix": []}
        
        # Calculate keyword overlap between themes
        relationships = []
        similarity_matrix = []
        
        for i, theme1 in enumerate(themes):
            row = []
            for j, theme2 in enumerate(themes):
                if i != j:
                    # Calculate Jaccard similarity
                    keywords1 = set(theme1.get('keywords', []))
                    keywords2 = set(theme2.get('keywords', []))
                    
                    intersection = len(keywords1.intersection(keywords2))
                    union = len(keywords1.union(keywords2))
                    
                    similarity = intersection / union if union > 0 else 0
                    
                    if similarity > 0.1:  # Threshold for meaningful relationship
                        relationships.append({
                            "theme1_id": theme1.get('theme_id', i),
                            "theme2_id": theme2.get('theme_id', j),
                            "similarity": similarity,
                            "shared_keywords": list(keywords1.intersection(keywords2))
                        })
                    
                    row.append(similarity)
                else:
                    row.append(1.0)
            
            similarity_matrix.append(row)
        
        return {
            "relationships": relationships,
            "similarity_matrix": similarity_matrix
        }
    
    def _calculate_theme_coherence(self, themes: List[Dict[str, Any]]) -> float:
        """
        Calculate a simple coherence measure for themes.
        
        Args:
            themes: List of theme dictionaries
            
        Returns:
            Coherence score (0-1, higher is better)
        """
        if not themes:
            return 0.0
        
        # Simple coherence based on keyword uniqueness across themes
        all_keywords = []
        for theme in themes:
            all_keywords.extend(theme.get('keywords', []))
        
        if not all_keywords:
            return 0.0
        
        # Calculate uniqueness ratio
        unique_keywords = len(set(all_keywords))
        total_keywords = len(all_keywords)
        
        coherence = unique_keywords / total_keywords if total_keywords > 0 else 0
        
        return coherence
    
    def generate_theme_report(self, analysis_results: Dict[str, Any]) -> str:
        """
        Generate a comprehensive report of thematic analysis.
        
        Args:
            analysis_results: Results from thematic analysis
            
        Returns:
            Human-readable report
        """
        if not analysis_results.get('themes'):
            return "No themes identified in the analysis."
        
        themes = analysis_results['themes']
        method = analysis_results.get('method', 'unknown')
        
        report = f"Thematic Analysis Report (Method: {method})\n"
        report += "=" * 50 + "\n\n"
        
        report += f"Total themes identified: {len(themes)}\n"
        
        if 'coherence' in analysis_results:
            report += f"Theme coherence score: {analysis_results['coherence']:.2f}\n"
        
        report += "\n"
        
        for i, theme in enumerate(themes, 1):
            report += f"Theme {i}: {theme.get('theme_id', i)}\n"
            report += "-" * 30 + "\n"
            
            if 'keywords' in theme:
                report += f"Key terms: {', '.join(theme['keywords'][:5])}\n"
            
            if 'text_count' in theme:
                report += f"Associated responses: {theme['text_count']}\n"
            
            if 'percentage' in theme:
                report += f"Percentage of data: {theme['percentage']:.1f}%\n"
            
            if 'representative_texts' in theme:
                report += "Representative quotes:\n"
                for quote in theme['representative_texts'][:2]:
                    report += f"  - \"{quote[:100]}...\"\n"
            
            report += "\n"
        
        return report

# Factory function for easy usage
def analyze_themes(
    texts: List[str],
    method: str = "clustering",
    n_themes: int = 5,
    **kwargs
) -> Dict[str, Any]:
    """
    Convenient function to perform thematic analysis.
    
    Args:
        texts: List of text documents
        method: Analysis method ('clustering' or 'lda')
        n_themes: Number of themes to identify
        **kwargs: Additional parameters
        
    Returns:
        Dictionary with analysis results
    """
    analyzer = ThematicAnalyzer()
    
    if method == "lda":
        return analyzer.identify_themes_lda(texts, n_themes)
    else:
        return analyzer.identify_themes_clustering(texts, n_themes) 