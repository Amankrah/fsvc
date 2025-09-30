"""
Text analysis module for qualitative analytics.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List
from collections import Counter
import re
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
import nltk

# Download required NLTK data
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')

def preprocess_text(text: str) -> List[str]:
    """
    Preprocess text for analysis.
    
    Args:
        text: Input text
        
    Returns:
        List of preprocessed tokens
    """
    # Convert to lowercase
    text = text.lower()
    
    # Remove special characters and digits
    text = re.sub(r'[^a-zA-Z\s]', '', text)
    
    # Tokenize
    tokens = word_tokenize(text)
    
    # Remove stopwords
    stop_words = set(stopwords.words('english'))
    tokens = [token for token in tokens if token not in stop_words]
    
    # Lemmatize
    lemmatizer = WordNetLemmatizer()
    tokens = [lemmatizer.lemmatize(token) for token in tokens]
    
    return tokens

def analyze_text_frequency(text: str) -> Dict[str, int]:
    """
    Analyze word frequency in text.
    
    Args:
        text: Input text
        
    Returns:
        Dictionary of word frequencies
    """
    tokens = preprocess_text(text)
    return dict(Counter(tokens))

def analyze_text_similarity(text1: str, text2: str) -> float:
    """
    Calculate similarity between two texts using Jaccard similarity.
    
    Args:
        text1: First text
        text2: Second text
        
    Returns:
        Similarity score between 0 and 1
    """
    tokens1 = set(preprocess_text(text1))
    tokens2 = set(preprocess_text(text2))
    
    intersection = len(tokens1.intersection(tokens2))
    union = len(tokens1.union(tokens2))
    
    return intersection / union if union > 0 else 0.0

def extract_key_phrases(text: str, n: int = 5) -> List[str]:
    """
    Extract key phrases from text.
    
    Args:
        text: Input text
        n: Number of key phrases to extract
        
    Returns:
        List of key phrases
    """
    tokens = preprocess_text(text)
    
    # Create bigrams
    bigrams = list(zip(tokens[:-1], tokens[1:]))
    bigram_freq = Counter(bigrams)
    
    # Get most common bigrams
    key_phrases = [' '.join(bigram) for bigram, _ in bigram_freq.most_common(n)]
    
    return key_phrases

def analyze_text_patterns(text: str) -> Dict[str, Any]:
    """
    Analyze patterns in text.
    
    Args:
        text: Input text
        
    Returns:
        Dictionary with pattern analysis results
    """
    # Calculate basic statistics
    sentences = text.split('.')
    words = text.split()
    
    # Calculate average word length
    avg_word_length = np.mean([len(word) for word in words])
    
    # Calculate average sentence length
    avg_sentence_length = np.mean([len(sentence.split()) for sentence in sentences if sentence.strip()])
    
    return {
        "num_sentences": len(sentences),
        "num_words": len(words),
        "avg_word_length": float(avg_word_length),
        "avg_sentence_length": float(avg_sentence_length),
        "key_phrases": extract_key_phrases(text)
    } 