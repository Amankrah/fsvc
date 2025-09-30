#!/usr/bin/env python3
"""
Cocoa Value Chain Survey Setup Runner
=====================================

Interactive script to run the cocoa value chain survey setup.
Sets up user registration, project creation, and survey form building.
"""

import sys
import os
from setup_cocoa_survey import CocoaSurveySetup

def main():
    """Main function to run the interactive setup"""
    print("🌟 Cocoa Value Chain Survey Setup")
    print("=" * 50)
    print("This script will:")
    print("1. Register Emmanuel Kwofie from McGill University")
    print("2. Create a cocoa value chain survey project in Ghana")
    print("3. Build a comprehensive 26-question survey form")
    print("=" * 50)
    
    # Get user confirmation
    proceed = input("\nDo you want to proceed? (y/n): ").lower().strip()
    if proceed != 'y':
        print("Setup cancelled.")
        return
    
    print("\n🚀 Starting setup...")
    print("-" * 50)
    
    # Run the setup
    setup = CocoaSurveySetup()
    setup.run_setup()
    
    print("\n✨ Setup process completed!")
    print("Check the output above for results.")

if __name__ == "__main__":
    main() 