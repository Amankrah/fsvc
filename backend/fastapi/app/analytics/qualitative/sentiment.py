"""
Enhanced sentiment analysis module for qualitative analytics.
Supports multiple sentiment analysis approaches and emotion detection.
"""

from typing import Dict, Any, List, Tuple
from textblob import TextBlob
import pandas as pd
import numpy as np
import re
from collections import Counter

# Emotion lexicon (simplified version for offline use)
EMOTION_LEXICON = {
    'joy': ['happy', 'joy', 'pleased', 'excited', 'delighted', 'cheerful', 'glad', 'content'],
    'anger': ['angry', 'mad', 'furious', 'annoyed', 'irritated', 'rage', 'frustrated'],
    'sadness': ['sad', 'depressed', 'unhappy', 'miserable', 'disappointed', 'gloomy'],
    'fear': ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'nervous', 'frightened'],
    'surprise': ['surprised', 'amazed', 'astonished', 'shocked', 'stunned'],
    'disgust': ['disgusted', 'revolted', 'sickened', 'appalled']
}

# Intensity modifiers
INTENSIFIERS = ['very', 'extremely', 'highly', 'completely', 'absolutely', 'totally']
DIMINISHERS = ['slightly', 'somewhat', 'rather', 'fairly', 'quite', 'a bit']

def analyze_sentiment(text: str) -> Dict[str, float]:
    """
    Analyze sentiment of text using TextBlob with enhanced features.
    
    Args:
        text: Input text
        
    Returns:
        Dictionary with comprehensive sentiment scores
    """
    blob = TextBlob(text)
    
    # Basic sentiment
    polarity = float(blob.sentiment.polarity)
    subjectivity = float(blob.sentiment.subjectivity)
    
    # Calculate confidence based on text length and word count
    words = text.split()
    confidence = min(1.0, len(words) / 10.0)  # More words = higher confidence up to a point
    
    return {
        "polarity": polarity,
        "subjectivity": subjectivity,
        "confidence": confidence,
        "magnitude": abs(polarity),
        "category": get_sentiment_category(polarity),
        "intensity": get_sentiment_intensity(polarity)
    }

def analyze_sentiment_batch(texts: List[str]) -> List[Dict[str, float]]:
    """
    Analyze sentiment for a batch of texts with progress tracking.
    
    Args:
        texts: List of input texts
        
    Returns:
        List of sentiment analysis results
    """
    results = []
    for i, text in enumerate(texts):
        result = analyze_sentiment(text)
        result['index'] = i
        results.append(result)
    
    return results

def get_sentiment_category(polarity: float) -> str:
    """
    Get detailed sentiment category based on polarity score.
    
    Args:
        polarity: Polarity score (-1 to 1)
        
    Returns:
        Detailed sentiment category
    """
    if polarity > 0.5:
        return "very_positive"
    elif polarity > 0.1:
        return "positive"
    elif polarity > -0.1:
        return "neutral"
    elif polarity > -0.5:
        return "negative"
    else:
        return "very_negative"

def get_sentiment_intensity(polarity: float) -> str:
    """
    Get sentiment intensity level.
    
    Args:
        polarity: Polarity score (-1 to 1)
        
    Returns:
        Intensity level
    """
    magnitude = abs(polarity)
    if magnitude > 0.7:
        return "high"
    elif magnitude > 0.3:
        return "medium"
    else:
        return "low"

def analyze_emotions(text: str) -> Dict[str, int]:
    """
    Analyze emotions in text using keyword matching.
    
    Args:
        text: Input text
        
    Returns:
        Dictionary with emotion counts
    """
    text_lower = text.lower()
    words = re.findall(r'\b\w+\b', text_lower)
    
    emotion_scores = {}
    for emotion, keywords in EMOTION_LEXICON.items():
        count = sum(1 for word in words if word in keywords)
        emotion_scores[emotion] = count
    
    return emotion_scores

def analyze_sentiment_trends(
    texts: List[str],
    timestamps: List[str] = None,
    categories: List[str] = None
) -> Dict[str, Any]:
    """
    Analyze sentiment trends over time and by category.
    
    Args:
        texts: List of input texts
        timestamps: Optional list of timestamps
        categories: Optional list of categories
        
    Returns:
        Dictionary with comprehensive trend analysis
    """
    # Analyze sentiment for each text
    sentiments = analyze_sentiment_batch(texts)
    
    df = pd.DataFrame({
        'text': texts,
        'polarity': [s['polarity'] for s in sentiments],
        'subjectivity': [s['subjectivity'] for s in sentiments],
        'category': [s['category'] for s in sentiments],
        'intensity': [s['intensity'] for s in sentiments],
        'confidence': [s['confidence'] for s in sentiments]
    })
    
    # Add timestamps if provided
    if timestamps:
        df['timestamp'] = pd.to_datetime(timestamps)
        
        # Calculate daily averages
        daily_avg = df.groupby(df['timestamp'].dt.date).agg({
            'polarity': ['mean', 'std', 'count'],
            'subjectivity': ['mean', 'std'],
            'confidence': 'mean'
        }).reset_index()
        
        daily_trends = daily_avg.to_dict('records')
    else:
        daily_trends = None
    
    # Add categories if provided
    if categories:
        df['user_category'] = categories
        category_analysis = df.groupby('user_category').agg({
            'polarity': ['mean', 'std', 'count'],
            'subjectivity': ['mean', 'std'],
            'confidence': 'mean'
        }).to_dict()
    else:
        category_analysis = None
    
    # Calculate overall statistics
    overall_stats = {
        "mean_polarity": float(df['polarity'].mean()),
        "std_polarity": float(df['polarity'].std()),
        "mean_subjectivity": float(df['subjectivity'].mean()),
        "std_subjectivity": float(df['subjectivity'].std()),
        "mean_confidence": float(df['confidence'].mean()),
        "total_responses": len(texts)
    }
    
    # Category distribution
    category_dist = df['category'].value_counts().to_dict()
    intensity_dist = df['intensity'].value_counts().to_dict()
    
    return {
        "overall_statistics": overall_stats,
        "category_distribution": category_dist,
        "intensity_distribution": intensity_dist,
        "daily_trends": daily_trends,
        "category_analysis": category_analysis,
        "sentiment_timeline": df[['polarity', 'category']].to_dict('records') if len(texts) <= 1000 else None
    }

def analyze_sentiment_by_question(
    responses: Dict[str, List[str]]
) -> Dict[str, Dict[str, Any]]:
    """
    Analyze sentiment for responses grouped by question.
    
    Args:
        responses: Dictionary mapping question IDs to lists of response texts
        
    Returns:
        Dictionary with sentiment analysis by question
    """
    question_analysis = {}
    
    for question_id, texts in responses.items():
        if not texts:
            continue
            
        sentiments = analyze_sentiment_batch(texts)
        
        # Calculate statistics
        polarities = [s['polarity'] for s in sentiments]
        subjectivities = [s['subjectivity'] for s in sentiments]
        categories = [s['category'] for s in sentiments]
        
        question_analysis[question_id] = {
            "response_count": len(texts),
            "mean_polarity": float(np.mean(polarities)),
            "std_polarity": float(np.std(polarities)),
            "mean_subjectivity": float(np.mean(subjectivities)),
            "std_subjectivity": float(np.std(subjectivities)),
            "category_distribution": dict(Counter(categories)),
            "most_positive": texts[np.argmax(polarities)] if polarities else None,
            "most_negative": texts[np.argmin(polarities)] if polarities else None,
            "representative_responses": {
                category: [text for text, cat in zip(texts, categories) if cat == category][:3]
                for category in set(categories)
            }
        }
    
    return question_analysis

def detect_sentiment_patterns(texts: List[str]) -> Dict[str, Any]:
    """
    Detect patterns in sentiment across texts.
    
    Args:
        texts: List of input texts
        
    Returns:
        Dictionary with pattern analysis
    """
    sentiments = analyze_sentiment_batch(texts)
    polarities = [s['polarity'] for s in sentiments]
    
    # Detect volatility (how much sentiment varies)
    volatility = float(np.std(polarities))
    
    # Detect sentiment shifts
    shifts = 0
    for i in range(1, len(polarities)):
        if (polarities[i] > 0 and polarities[i-1] < 0) or (polarities[i] < 0 and polarities[i-1] > 0):
            shifts += 1
    
    shift_rate = shifts / len(polarities) if len(polarities) > 1 else 0
    
    # Detect consistency
    consistency = 1 - volatility  # Higher volatility = lower consistency
    
    return {
        "volatility": volatility,
        "sentiment_shifts": shifts,
        "shift_rate": shift_rate,
        "consistency": max(0, consistency),
        "predominant_sentiment": get_sentiment_category(np.mean(polarities)),
        "sentiment_range": float(max(polarities) - min(polarities)) if polarities else 0
    }

def generate_sentiment_summary(analysis_results: Dict[str, Any]) -> str:
    """
    Generate a human-readable summary of sentiment analysis.
    
    Args:
        analysis_results: Results from sentiment analysis
        
    Returns:
        Human-readable summary string
    """
    if 'overall_statistics' not in analysis_results:
        return "No sentiment data available for summary."
    
    stats = analysis_results['overall_statistics']
    category_dist = analysis_results.get('category_distribution', {})
    
    # Determine overall sentiment
    mean_polarity = stats['mean_polarity']
    total_responses = stats['total_responses']
    
    if mean_polarity > 0.1:
        overall_sentiment = "generally positive"
    elif mean_polarity < -0.1:
        overall_sentiment = "generally negative"
    else:
        overall_sentiment = "neutral"
    
    # Find dominant category
    if category_dist:
        dominant_category = max(category_dist.items(), key=lambda x: x[1])
        dominant_pct = (dominant_category[1] / total_responses) * 100
    else:
        dominant_category = None
        dominant_pct = 0
    
    summary = f"Analysis of {total_responses} responses shows {overall_sentiment} sentiment "
    summary += f"(average polarity: {mean_polarity:.2f}). "
    
    if dominant_category:
        summary += f"The most common sentiment category is '{dominant_category[0]}' "
        summary += f"({dominant_pct:.1f}% of responses). "
    
    summary += f"Subjectivity average is {stats['mean_subjectivity']:.2f}, indicating "
    if stats['mean_subjectivity'] > 0.5:
        summary += "highly subjective responses."
    else:
        summary += "relatively objective responses."
    
    return summary 