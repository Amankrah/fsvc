"""
Data compression utilities.
"""

import gzip
import json
from typing import Any, Dict, Union
import base64

def compress_data(data: Union[Dict[str, Any], str]) -> str:
    """
    Compress data using gzip and encode as base64.
    
    Args:
        data: Data to compress (dictionary or string)
        
    Returns:
        Base64 encoded compressed data
    """
    if isinstance(data, dict):
        data = json.dumps(data)
    
    compressed = gzip.compress(data.encode('utf-8'))
    return base64.b64encode(compressed).decode('utf-8')

def decompress_data(compressed_data: str) -> Union[Dict[str, Any], str]:
    """
    Decompress base64 encoded gzipped data.
    
    Args:
        compressed_data: Base64 encoded compressed data
        
    Returns:
        Decompressed data (dictionary or string)
    """
    decoded = base64.b64decode(compressed_data)
    decompressed = gzip.decompress(decoded).decode('utf-8')
    
    try:
        return json.loads(decompressed)
    except json.JSONDecodeError:
        return decompressed

def compress_file(file_path: str) -> str:
    """
    Compress a file using gzip and encode as base64.
    
    Args:
        file_path: Path to the file to compress
        
    Returns:
        Base64 encoded compressed file
    """
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    compressed = gzip.compress(file_data)
    return base64.b64encode(compressed).decode('utf-8')

def decompress_file(compressed_data: str, output_path: str):
    """
    Decompress base64 encoded gzipped file data and save to file.
    
    Args:
        compressed_data: Base64 encoded compressed file data
        output_path: Path to save the decompressed file
    """
    decoded = base64.b64decode(compressed_data)
    decompressed = gzip.decompress(decoded)
    
    with open(output_path, 'wb') as f:
        f.write(decompressed) 