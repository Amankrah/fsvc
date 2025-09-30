"""
Qualitative coding module for systematic categorization and analysis.
Supports open coding, axial coding, and selective coding approaches.
"""

from typing import Dict, Any, List, Tuple, Optional, Set
import pandas as pd
import numpy as np
from collections import Counter, defaultdict
import re
import json
from datetime import datetime
import uuid

class QualitativeCoder:
    """
    A comprehensive tool for qualitative coding and categorization.
    """
    
    def __init__(self):
        self.codebook = {}
        self.coded_segments = []
        self.coding_scheme = {
            "codes": {},
            "categories": {},
            "themes": {},
            "relationships": []
        }
        self.inter_coder_reliability = {}
    
    def create_code(self, code_name: str, definition: str, category: str = None, 
                   examples: List[str] = None) -> Dict[str, Any]:
        """
        Create a new code in the codebook.
        
        Args:
            code_name: Name of the code
            definition: Definition/description of the code
            category: Category this code belongs to
            examples: Example text segments
            
        Returns:
            Dictionary with code information
        """
        code_id = str(uuid.uuid4())
        
        code = {
            "id": code_id,
            "name": code_name,
            "definition": definition,
            "category": category,
            "examples": examples or [],
            "created_at": datetime.now().isoformat(),
            "usage_count": 0,
            "child_codes": [],
            "parent_code": None
        }
        
        self.codebook[code_id] = code
        self.coding_scheme["codes"][code_name] = code_id
        
        return code
    
    def create_category(self, category_name: str, description: str, 
                       codes: List[str] = None) -> Dict[str, Any]:
        """
        Create a category to group related codes.
        
        Args:
            category_name: Name of the category
            description: Description of the category
            codes: List of code names to include in this category
            
        Returns:
            Dictionary with category information
        """
        category_id = str(uuid.uuid4())
        
        category = {
            "id": category_id,
            "name": category_name,
            "description": description,
            "codes": codes or [],
            "created_at": datetime.now().isoformat()
        }
        
        self.coding_scheme["categories"][category_name] = category_id
        
        # Update codes to reference this category
        if codes:
            for code_name in codes:
                if code_name in self.coding_scheme["codes"]:
                    code_id = self.coding_scheme["codes"][code_name]
                    self.codebook[code_id]["category"] = category_name
        
        return category
    
    def code_segment(self, text: str, codes: List[str], coder_id: str = "default",
                    start_pos: int = 0, end_pos: int = None, 
                    metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Code a text segment with one or more codes.
        
        Args:
            text: Text segment to code
            codes: List of code names to apply
            coder_id: ID of the person doing the coding
            start_pos: Start position in original text
            end_pos: End position in original text
            metadata: Additional metadata about the segment
            
        Returns:
            Dictionary with coded segment information
        """
        segment_id = str(uuid.uuid4())
        
        if end_pos is None:
            end_pos = len(text)
        
        coded_segment = {
            "id": segment_id,
            "text": text,
            "codes": codes,
            "coder_id": coder_id,
            "start_pos": start_pos,
            "end_pos": end_pos,
            "coded_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        self.coded_segments.append(coded_segment)
        
        # Update usage count for codes
        for code_name in codes:
            if code_name in self.coding_scheme["codes"]:
                code_id = self.coding_scheme["codes"][code_name]
                self.codebook[code_id]["usage_count"] += 1
        
        return coded_segment
    
    def auto_code_keywords(self, texts: List[str], keyword_codes: Dict[str, List[str]],
                          coder_id: str = "auto") -> List[Dict[str, Any]]:
        """
        Automatically code texts based on keyword matching.
        
        Args:
            texts: List of texts to code
            keyword_codes: Dictionary mapping code names to lists of keywords
            coder_id: ID to use for auto-coding
            
        Returns:
            List of coded segments
        """
        auto_coded = []
        
        for i, text in enumerate(texts):
            text_lower = text.lower()
            applied_codes = []
            
            for code_name, keywords in keyword_codes.items():
                for keyword in keywords:
                    if keyword.lower() in text_lower:
                        applied_codes.append(code_name)
                        break
            
            if applied_codes:
                segment = self.code_segment(
                    text=text,
                    codes=list(set(applied_codes)),  # Remove duplicates
                    coder_id=coder_id,
                    metadata={"text_index": i, "auto_coded": True}
                )
                auto_coded.append(segment)
        
        return auto_coded
    
    def calculate_code_frequencies(self) -> Dict[str, Any]:
        """
        Calculate frequency statistics for all codes.
        
        Returns:
            Dictionary with frequency statistics
        """
        code_counts = Counter()
        code_cooccurrence = defaultdict(Counter)
        
        for segment in self.coded_segments:
            codes = segment["codes"]
            
            # Count individual codes
            for code in codes:
                code_counts[code] += 1
            
            # Count co-occurrence
            for i, code1 in enumerate(codes):
                for code2 in codes[i+1:]:
                    code_cooccurrence[code1][code2] += 1
                    code_cooccurrence[code2][code1] += 1
        
        # Calculate percentages
        total_segments = len(self.coded_segments)
        code_percentages = {
            code: (count / total_segments) * 100 
            for code, count in code_counts.items()
        }
        
        return {
            "code_frequencies": dict(code_counts),
            "code_percentages": code_percentages,
            "code_cooccurrence": dict(code_cooccurrence),
            "total_coded_segments": total_segments,
            "unique_codes": len(code_counts)
        }
    
    def analyze_code_patterns(self) -> Dict[str, Any]:
        """
        Analyze patterns in coding across segments.
        
        Returns:
            Dictionary with pattern analysis
        """
        if not self.coded_segments:
            return {"error": "No coded segments available for analysis"}
        
        # Analyze coding density
        codes_per_segment = [len(segment["codes"]) for segment in self.coded_segments]
        avg_codes_per_segment = np.mean(codes_per_segment)
        
        # Analyze segment lengths
        segment_lengths = [len(segment["text"]) for segment in self.coded_segments]
        avg_segment_length = np.mean(segment_lengths)
        
        # Find most commonly co-occurring codes
        cooccurrence_pairs = []
        code_cooccurrence = defaultdict(Counter)
        
        for segment in self.coded_segments:
            codes = segment["codes"]
            for i, code1 in enumerate(codes):
                for code2 in codes[i+1:]:
                    pair = tuple(sorted([code1, code2]))
                    code_cooccurrence[pair[0]][pair[1]] += 1
        
        # Get top co-occurring pairs
        for code1, code2_counts in code_cooccurrence.items():
            for code2, count in code2_counts.items():
                cooccurrence_pairs.append((code1, code2, count))
        
        cooccurrence_pairs.sort(key=lambda x: x[2], reverse=True)
        
        return {
            "coding_density": {
                "avg_codes_per_segment": avg_codes_per_segment,
                "max_codes_per_segment": max(codes_per_segment),
                "min_codes_per_segment": min(codes_per_segment)
            },
            "segment_characteristics": {
                "avg_segment_length": avg_segment_length,
                "total_segments": len(self.coded_segments)
            },
            "top_cooccurring_codes": cooccurrence_pairs[:10]
        }
    
    def export_codebook(self) -> Dict[str, Any]:
        """
        Export the complete codebook.
        
        Returns:
            Dictionary with complete codebook
        """
        return {
            "codebook": self.codebook,
            "coding_scheme": self.coding_scheme,
            "export_timestamp": datetime.now().isoformat(),
            "statistics": self.calculate_code_frequencies()
        }
    
    def import_codebook(self, codebook_data: Dict[str, Any]):
        """
        Import a codebook from exported data.
        
        Args:
            codebook_data: Previously exported codebook data
        """
        if "codebook" in codebook_data:
            self.codebook = codebook_data["codebook"]
        
        if "coding_scheme" in codebook_data:
            self.coding_scheme = codebook_data["coding_scheme"]
    
    def generate_coding_report(self) -> str:
        """
        Generate a comprehensive coding report.
        
        Returns:
            Human-readable coding report
        """
        frequencies = self.calculate_code_frequencies()
        patterns = self.analyze_code_patterns()
        
        report = "Qualitative Coding Analysis Report\n"
        report += "=" * 40 + "\n\n"
        
        # Overview
        report += f"Total coded segments: {frequencies['total_coded_segments']}\n"
        report += f"Unique codes used: {frequencies['unique_codes']}\n"
        report += f"Average codes per segment: {patterns['coding_density']['avg_codes_per_segment']:.2f}\n\n"
        
        # Top codes
        report += "Most Frequently Used Codes:\n"
        report += "-" * 30 + "\n"
        
        sorted_codes = sorted(
            frequencies['code_frequencies'].items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        for code, count in sorted_codes[:10]:
            percentage = frequencies['code_percentages'][code]
            report += f"{code}: {count} times ({percentage:.1f}%)\n"
        
        report += "\n"
        
        # Co-occurring codes
        if patterns['top_cooccurring_codes']:
            report += "Most Common Code Co-occurrences:\n"
            report += "-" * 35 + "\n"
            
            for code1, code2, count in patterns['top_cooccurring_codes'][:5]:
                report += f"{code1} + {code2}: {count} times\n"
        
        return report
    
    def calculate_inter_coder_reliability(self, coder1_segments: List[Dict[str, Any]],
                                        coder2_segments: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Calculate inter-coder reliability between two coders.
        
        Args:
            coder1_segments: Coded segments from first coder
            coder2_segments: Coded segments from second coder
            
        Returns:
            Dictionary with reliability metrics
        """
        # Simple agreement calculation (can be enhanced with Cohen's Kappa)
        agreements = 0
        total_comparisons = 0
        
        # Match segments by text content (simple approach)
        coder1_texts = {seg["text"]: set(seg["codes"]) for seg in coder1_segments}
        coder2_texts = {seg["text"]: set(seg["codes"]) for seg in coder2_segments}
        
        common_texts = set(coder1_texts.keys()) & set(coder2_texts.keys())
        
        for text in common_texts:
            codes1 = coder1_texts[text]
            codes2 = coder2_texts[text]
            
            # Calculate Jaccard similarity
            intersection = len(codes1 & codes2)
            union = len(codes1 | codes2)
            
            if union > 0:
                agreement = intersection / union
                agreements += agreement
                total_comparisons += 1
        
        avg_agreement = agreements / total_comparisons if total_comparisons > 0 else 0
        
        return {
            "average_agreement": avg_agreement,
            "total_comparisons": total_comparisons,
            "common_segments": len(common_texts)
        }

def create_coding_scheme_from_themes(themes: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """
    Create a coding scheme from identified themes.
    
    Args:
        themes: List of theme dictionaries from thematic analysis
        
    Returns:
        Dictionary mapping theme names to keywords for auto-coding
    """
    coding_scheme = {}
    
    for theme in themes:
        theme_name = f"theme_{theme.get('theme_id', 'unknown')}"
        keywords = theme.get('keywords', [])
        
        # Use top keywords as coding keywords
        coding_scheme[theme_name] = keywords[:5]
    
    return coding_scheme

def analyze_coded_data(coded_segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze patterns in coded qualitative data.
    
    Args:
        coded_segments: List of coded segments
        
    Returns:
        Dictionary with analysis results
    """
    if not coded_segments:
        return {"error": "No coded segments provided"}
    
    # Extract all codes
    all_codes = []
    for segment in coded_segments:
        all_codes.extend(segment.get("codes", []))
    
    # Calculate statistics
    code_frequencies = Counter(all_codes)
    unique_codes = len(code_frequencies)
    total_applications = len(all_codes)
    
    # Analyze segment characteristics
    segment_lengths = [len(segment.get("text", "")) for segment in coded_segments]
    codes_per_segment = [len(segment.get("codes", [])) for segment in coded_segments]
    
    return {
        "code_statistics": {
            "unique_codes": unique_codes,
            "total_code_applications": total_applications,
            "most_common_codes": code_frequencies.most_common(10),
            "code_frequencies": dict(code_frequencies)
        },
        "segment_statistics": {
            "total_segments": len(coded_segments),
            "avg_segment_length": np.mean(segment_lengths),
            "avg_codes_per_segment": np.mean(codes_per_segment),
            "max_codes_per_segment": max(codes_per_segment) if codes_per_segment else 0
        }
    } 