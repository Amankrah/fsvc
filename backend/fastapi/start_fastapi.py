#!/usr/bin/env python3
"""
Startup script for the streamlined analytics engine.
"""

import os
import sys
import subprocess
from pathlib import Path

def main():
    """Start the analytics engine."""
    
    # Get the current directory
    current_dir = Path(__file__).parent
    
    print("🚀 Starting Research Analytics Engine...")
    print(f"📁 Working directory: {current_dir}")
    
    # Check if virtual environment exists
    venv_path = current_dir.parent.parent / "venv"
    if venv_path.exists():
        print("🐍 Virtual environment found")
        
        # Activate virtual environment on Windows
        if os.name == 'nt':
            python_cmd = str(venv_path / "Scripts" / "python.exe")
        else:
            python_cmd = str(venv_path / "bin" / "python")
    else:
        print("⚠️  Virtual environment not found, using system Python")
        python_cmd = sys.executable
    
    # Start the server
    try:
        print("🔄 Starting FastAPI server...")
        subprocess.run([
            python_cmd, "-m", "uvicorn", 
            "main:app", 
            "--host", "0.0.0.0", 
            "--port", "8001", 
            "--reload"
        ], cwd=current_dir)
    except KeyboardInterrupt:
        print("\n🛑 Analytics engine stopped by user")
    except Exception as e:
        print(f"❌ Error starting analytics engine: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 