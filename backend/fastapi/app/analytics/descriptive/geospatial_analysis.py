"""
Geospatial analysis for location-based research data.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from math import radians, cos, sin, asin, sqrt
from sklearn.cluster import DBSCAN, KMeans
from collections import Counter

def analyze_spatial_distribution(df: pd.DataFrame,
                               lat_column: str,
                               lon_column: str,
                               value_column: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyze spatial distribution of data points.
    
    Args:
        df: DataFrame with location data
        lat_column: Latitude column name
        lon_column: Longitude column name
        value_column: Optional value column for weighted analysis
        
    Returns:
        Dictionary containing spatial analysis
    """
    # Clean location data
    location_df = df[[lat_column, lon_column]].dropna()
    
    if len(location_df) < 2:
        return {"error": "Insufficient location data"}
    
    lats = location_df[lat_column].values
    lons = location_df[lon_column].values
    
    # Basic statistics
    spatial_stats = {
        "total_points": len(location_df),
        "bounding_box": {
            "min_lat": float(lats.min()),
            "max_lat": float(lats.max()),
            "min_lon": float(lons.min()),
            "max_lon": float(lons.max())
        },
        "center_point": {
            "lat": float(lats.mean()),
            "lon": float(lons.mean())
        },
        "spread": {
            "lat_std": float(lats.std()),
            "lon_std": float(lons.std())
        }
    }
    
    # Calculate distances
    distances = _calculate_distance_matrix(lats, lons)
    spatial_stats["distance_stats"] = {
        "mean_distance_km": float(distances[distances > 0].mean()),
        "max_distance_km": float(distances.max()),
        "min_distance_km": float(distances[distances > 0].min())
    }
    
    # Spatial clustering
    if len(location_df) >= 5:
        spatial_stats["clusters"] = _perform_spatial_clustering(lats, lons)
    
    # Value-based analysis if provided
    if value_column and value_column in df.columns:
        value_df = df[[lat_column, lon_column, value_column]].dropna()
        if len(value_df) > 0:
            spatial_stats["value_distribution"] = _analyze_spatial_values(
                value_df, lat_column, lon_column, value_column
            )
    
    return spatial_stats

def _haversine_distance(lat1: float, lon1: float, 
                       lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points.
    
    Returns:
        Distance in kilometers
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of Earth in kilometers
    
    return c * r

def _calculate_distance_matrix(lats: np.ndarray, 
                             lons: np.ndarray) -> np.ndarray:
    """Calculate pairwise distances between all points."""
    n = len(lats)
    distances = np.zeros((n, n))
    
    for i in range(n):
        for j in range(i+1, n):
            dist = _haversine_distance(lats[i], lons[i], lats[j], lons[j])
            distances[i, j] = dist
            distances[j, i] = dist
    
    return distances

def _perform_spatial_clustering(lats: np.ndarray, 
                              lons: np.ndarray) -> Dict[str, Any]:
    """Perform spatial clustering using DBSCAN."""
    # Prepare data
    coords = np.column_stack((lats, lons))
    
    # DBSCAN clustering
    # eps is in degrees, roughly 1km ≈ 0.009 degrees
    clustering = DBSCAN(eps=0.01, min_samples=3, metric='haversine').fit(np.radians(coords))
    
    # Analyze clusters
    cluster_labels = clustering.labels_
    n_clusters = len(set(cluster_labels)) - (1 if -1 in cluster_labels else 0)
    
    cluster_info = {
        "n_clusters": n_clusters,
        "n_noise_points": int((cluster_labels == -1).sum()),
        "cluster_sizes": dict(Counter(cluster_labels))
    }
    
    # Get cluster centers
    if n_clusters > 0:
        cluster_centers = []
        for label in set(cluster_labels):
            if label != -1:
                mask = cluster_labels == label
                center_lat = lats[mask].mean()
                center_lon = lons[mask].mean()
                cluster_centers.append({
                    "cluster_id": int(label),
                    "center_lat": float(center_lat),
                    "center_lon": float(center_lon),
                    "size": int(mask.sum())
                })
        cluster_info["cluster_centers"] = cluster_centers
    
    return cluster_info

def _analyze_spatial_values(df: pd.DataFrame,
                          lat_col: str,
                          lon_col: str,
                          value_col: str) -> Dict[str, Any]:
    """Analyze how values are distributed spatially."""
    # Divide space into grid cells
    n_bins = 5
    lat_bins = pd.cut(df[lat_col], bins=n_bins)
    lon_bins = pd.cut(df[lon_col], bins=n_bins)
    
    # Group by grid cells
    grouped = df.groupby([lat_bins, lon_bins])[value_col].agg(['mean', 'count', 'std'])
    
    # Find hotspots (cells with high values)
    hotspots = []
    for (lat_bin, lon_bin), stats in grouped.iterrows():
        if stats['count'] > 0:
            hotspots.append({
                "lat_range": f"{lat_bin.left:.4f} to {lat_bin.right:.4f}",
                "lon_range": f"{lon_bin.left:.4f} to {lon_bin.right:.4f}",
                "mean_value": float(stats['mean']),
                "count": int(stats['count']),
                "std": float(stats['std']) if not pd.isna(stats['std']) else 0
            })
    
    # Sort by mean value
    hotspots.sort(key=lambda x: x['mean_value'], reverse=True)
    
    return {
        "top_hotspots": hotspots[:5],
        "spatial_variance": float(grouped['mean'].var()),
        "cells_with_data": len(grouped[grouped['count'] > 0])
    }

def calculate_spatial_autocorrelation(df: pd.DataFrame,
                                    lat_column: str,
                                    lon_column: str,
                                    value_column: str,
                                    max_distance_km: float = 10) -> Dict[str, Any]:
    """
    Calculate Moran's I for spatial autocorrelation.
    
    Args:
        df: DataFrame with spatial data
        lat_column: Latitude column
        lon_column: Longitude column  
        value_column: Value column to test
        max_distance_km: Maximum distance for neighbors
        
    Returns:
        Dictionary with spatial autocorrelation results
    """
    # Prepare data
    clean_df = df[[lat_column, lon_column, value_column]].dropna()
    
    if len(clean_df) < 10:
        return {"error": "Insufficient data for spatial autocorrelation"}
    
    lats = clean_df[lat_column].values
    lons = clean_df[lon_column].values
    values = clean_df[value_column].values
    
    # Create spatial weights matrix
    n = len(values)
    weights = np.zeros((n, n))
    
    for i in range(n):
        for j in range(n):
            if i != j:
                dist = _haversine_distance(lats[i], lons[i], lats[j], lons[j])
                if dist <= max_distance_km and dist > 0:
                    weights[i, j] = 1 / dist  # Inverse distance weighting
    
    # Row-standardize weights
    row_sums = weights.sum(axis=1)
    row_sums[row_sums == 0] = 1  # Avoid division by zero
    weights = weights / row_sums[:, np.newaxis]
    weights[np.isnan(weights)] = 0
    
    # Calculate Moran's I
    mean_value = values.mean()
    numerator = 0
    denominator = 0
    
    for i in range(n):
        for j in range(n):
            numerator += weights[i, j] * (values[i] - mean_value) * (values[j] - mean_value)
        denominator += (values[i] - mean_value) ** 2
    
    morans_i = (n / weights.sum()) * (numerator / denominator) if denominator > 0 else 0
    
    # Expected value and variance under null hypothesis
    expected_i = -1 / (n - 1)
    
    return {
        "morans_i": float(morans_i),
        "expected_i": float(expected_i),
        "interpretation": _interpret_morans_i(morans_i),
        "max_distance_km": max_distance_km,
        "n_observations": n
    }

def _interpret_morans_i(morans_i: float) -> str:
    """Interpret Moran's I value."""
    if morans_i > 0.3:
        return "Strong positive spatial autocorrelation (clustering)"
    elif morans_i > 0.1:
        return "Moderate positive spatial autocorrelation"
    elif morans_i > -0.1:
        return "No significant spatial pattern (random)"
    elif morans_i > -0.3:
        return "Moderate negative spatial autocorrelation"
    else:
        return "Strong negative spatial autocorrelation (dispersion)"

def create_location_clusters(df: pd.DataFrame,
                           lat_column: str,
                           lon_column: str,
                           n_clusters: int = 5) -> pd.DataFrame:
    """
    Create location-based clusters using K-means.
    
    Args:
        df: DataFrame with location data
        lat_column: Latitude column
        lon_column: Longitude column
        n_clusters: Number of clusters to create
        
    Returns:
        DataFrame with cluster assignments
    """
    # Prepare data
    location_df = df[[lat_column, lon_column]].dropna()
    
    if len(location_df) < n_clusters:
        df['location_cluster'] = 0
        return df
    
    # Perform K-means clustering
    coords = location_df[[lat_column, lon_column]].values
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    
    # Create cluster column
    df['location_cluster'] = -1  # Default for missing locations
    df.loc[location_df.index, 'location_cluster'] = kmeans.fit_predict(coords)
    
    return df