#!/usr/bin/env python3
"""
Cocoa Survey Response Generation Runner
======================================

Interactive script to run the cocoa survey response generation.
Creates 30 realistic respondents with responses to all 26 questions.

Author: Emmanuel Akwofie, McGill University
"""

import sys
import os
from generate_cocoa_responses import CocoaResponseGenerator

def main():
    """Main function to run the interactive response generation"""
    print("🌟 Cocoa Survey Response Generation")
    print("=" * 50)
    print("This script will:")
    print("1. Login as Emmanuel Kwofie (amankrah)")
    print("2. Find the Cocoa Value Chain Survey project")
    print("3. Generate 30 realistic Ghanaian farmers")
    print("4. Create responses to all 26 survey questions")
    print("5. Add realistic demographics and farming data")
    print("=" * 50)
    
    print("\n📊 Expected Output:")
    print("- 30 respondents with Ghanaian names")
    print("- ~780 total responses (30 × 26 questions)")
    print("- Realistic farming demographics")
    print("- Diverse response patterns by farmer type")
    print("- GPS coordinates in Ghana")
    print("- Device and location metadata")
    
    # Get user confirmation
    proceed = input("\nDo you want to proceed? (y/n): ").lower().strip()
    if proceed != 'y':
        print("Generation cancelled.")
        return
    
    print("\n🚀 Starting response generation...")
    print("-" * 50)
    
    # Run the generation
    generator = CocoaResponseGenerator()
    generator.run_generation()
    
    print("\n✨ Response generation completed!")
    print("Check the output above for results.")

if __name__ == "__main__":
    main() 