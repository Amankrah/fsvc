#!/usr/bin/env python3
"""
Cocoa Value Chain Survey Setup Script
=====================================

This script sets up a comprehensive cocoa value chain survey system for Ghana:
1. Registers Emmanuel Akwofie from McGill University 
2. Creates a cocoa value chain survey project
3. Builds a 26-question survey form covering all aspects of cocoa farming

Author: Emmanuel Akwofie, McGill University
Research Focus: Agricultural Economics, Cocoa Value Chain Analysis
"""

import requests
import json
import random
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Configuration
BASE_URL = "http://127.0.0.1:8000"
PROJECT_NAME = "Cocoa Value Chain Survey - Ghana 2024"

# User credentials
USER_DATA = {
    "username": "amankrah",
    "email": "manuel.kwofie@mcgill.ca",
    "password": "SecurePass354!",
    "password2": "SecurePass354!",
    "first_name": "Emmanuel",
    "last_name": "Kwofie",
    "profile": {
        "organization": "McGill University",
        "department": "Bioresource Engineering",
        "role": "Software Engineer",
        "country": "Canada",
        "research_interests": ["Cocoa Value Chain", "Agricultural Development", "Food Security"]
    }
}

# Project configuration
PROJECT_DATA = {
    "name": PROJECT_NAME,
    "description": "Comprehensive survey of cocoa value chain participants in Ghana, focusing on production practices, economic impacts, and sustainable development opportunities in the Ashanti, Western, and Central regions.",
    "category": "Agricultural Research",
    "location": "Ghana",
    "status": "active",
    "settings": {
        "target_regions": ["Ashanti", "Western", "Central"],
        "research_period": "2024-2025",
        "sample_size_target": 500,
        "data_collection_method": "Mixed (Digital + Paper)",
        "languages": ["English", "Twi", "Fante"]
    }
}

# Complete survey questions for cocoa value chain analysis
SURVEY_QUESTIONS = [
    # Demographics Section
    {
        "text": "What is your full name?",
        "question_type": "text_short",
        "section": "Demographics",
        "is_required": True,
        "order": 1,
        "help_text": "Please provide your full name as it appears on official documents"
    },
    {
        "text": "What is your age?",
        "question_type": "numeric_integer",
        "section": "Demographics", 
        "is_required": True,
        "order": 2,
        "help_text": "Age in years"
    },
    {
        "text": "What is your gender?",
        "question_type": "choice_single",
        "section": "Demographics",
        "is_required": True,
        "order": 3,
        "options": ["Male", "Female", "Prefer not to say"]
    },
    {
        "text": "What is your highest level of education?",
        "question_type": "choice_single",
        "section": "Demographics",
        "is_required": True,
        "order": 4,
        "options": ["No formal education", "Primary education", "Junior High School", "Senior High School", "Technical/Vocational", "University", "Other"]
    },
    {
        "text": "Which region do you primarily farm in?",
        "question_type": "choice_single",
        "section": "Demographics",
        "is_required": True,
        "order": 5,
        "options": ["Ashanti", "Western", "Central", "Eastern", "Brong-Ahafo", "Other"]
    },
    {
        "text": "What is your community/village name?",
        "question_type": "text_short",
        "section": "Demographics",
        "is_required": True,
        "order": 6,
        "help_text": "Name of your farming community or village"
    },

    # Farm Characteristics Section
    {
        "text": "How many years have you been farming cocoa?",
        "question_type": "numeric_integer",
        "section": "Farm Characteristics",
        "is_required": True,
        "order": 7,
        "help_text": "Total years of cocoa farming experience"
    },
    {
        "text": "What is the size of your cocoa farm?",
        "question_type": "choice_single",
        "section": "Farm Characteristics",
        "is_required": True,
        "order": 8,
        "options": ["Less than 1 hectare", "1-2 hectares", "2-5 hectares", "5-10 hectares", "More than 10 hectares"]
    },
    {
        "text": "How did you acquire your farmland?",
        "question_type": "choice_single",
        "section": "Farm Characteristics",
        "is_required": True,
        "order": 9,
        "options": ["Inherited", "Purchased", "Rented", "Sharecropping", "Government allocation", "Other"]
    },
    {
        "text": "What cocoa varieties do you grow?",
        "question_type": "choice_multiple",
        "section": "Farm Characteristics",
        "is_required": True,
        "order": 10,
        "options": ["Amelonado", "Trinitario", "Forastero", "Hybrid varieties", "Don't know specific variety"]
    },

    # Production & Practices Section
    {
        "text": "What was your average cocoa production last season (in bags)?",
        "question_type": "numeric_integer",
        "section": "Production & Practices",
        "is_required": True,
        "order": 11,
        "help_text": "Number of 64kg bags produced"
    },
    {
        "text": "Do you use fertilizers on your cocoa farm?",
        "question_type": "choice_single",
        "section": "Production & Practices",
        "is_required": True,
        "order": 12,
        "options": ["Yes, regularly", "Yes, occasionally", "No, never", "Don't know"]
    },
    {
        "text": "How do you manage pests and diseases?",
        "question_type": "choice_multiple",
        "section": "Production & Practices",
        "is_required": True,
        "order": 13,
        "options": ["Chemical pesticides", "Organic methods", "Integrated pest management", "No specific management", "Traditional methods"]
    },
    {
        "text": "Do you practice shade management on your farm?",
        "question_type": "choice_single",
        "section": "Production & Practices",
        "is_required": True,
        "order": 14,
        "options": ["Yes, with forest trees", "Yes, with planted shade trees", "Minimal shade", "No shade management"]
    },

    # Value Chain Participation Section
    {
        "text": "Who do you primarily sell your cocoa to?",
        "question_type": "choice_single",
        "section": "Value Chain Participation",
        "is_required": True,
        "order": 15,
        "options": ["Licensed Buying Company (LBC)", "Cocoa Marketing Company (CMC)", "Local traders", "Cooperatives", "Direct to processors", "Other"]
    },
    {
        "text": "How do you transport your cocoa to market?",
        "question_type": "choice_single",
        "section": "Value Chain Participation",
        "is_required": True,
        "order": 16,
        "options": ["Own transport", "Buyer provides transport", "Hire transport", "Community transport", "Other"]
    },
    {
        "text": "How satisfied are you with the prices you receive for cocoa?",
        "question_type": "scale_rating",
        "section": "Value Chain Participation",
        "is_required": True,
        "order": 17,
        "scale_min": 1,
        "scale_max": 5,
        "scale_labels": ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"]
    },
    {
        "text": "Are you a member of any farmers' cooperative or association?",
        "question_type": "choice_single",
        "section": "Value Chain Participation",
        "is_required": True,
        "order": 18,
        "options": ["Yes, actively participate", "Yes, but not very active", "No, but interested", "No, not interested"]
    },

    # Economic Impacts Section
    {
        "text": "What percentage of your household income comes from cocoa?",
        "question_type": "choice_single",
        "section": "Economic Impacts",
        "is_required": True,
        "order": 19,
        "options": ["Less than 25%", "25-50%", "50-75%", "75-100%"]
    },
    {
        "text": "How has your financial situation changed in the last 3 years?",
        "question_type": "choice_single",
        "section": "Economic Impacts",
        "is_required": True,
        "order": 20,
        "options": ["Significantly improved", "Slightly improved", "No change", "Slightly worse", "Significantly worse"]
    },
    {
        "text": "What other income sources do you have besides cocoa?",
        "question_type": "choice_multiple",
        "section": "Economic Impacts",
        "is_required": False,
        "order": 21,
        "options": ["Other crops", "Livestock", "Trading", "Artisan work", "Remittances", "None"]
    },

    # Challenges & Opportunities Section
    {
        "text": "What are the main challenges you face in cocoa farming?",
        "question_type": "choice_multiple",
        "section": "Challenges & Opportunities",
        "is_required": True,
        "order": 22,
        "options": ["Pest and diseases", "Low prices", "Climate change", "Lack of inputs", "Poor roads", "Limited access to credit", "Aging trees", "Labor shortage"]
    },
    {
        "text": "How has climate change affected your cocoa production?",
        "question_type": "choice_single",
        "section": "Challenges & Opportunities",
        "is_required": True,
        "order": 23,
        "options": ["Significantly affected", "Moderately affected", "Slightly affected", "Not affected", "Don't know"]
    },
    {
        "text": "What support do you need most to improve your cocoa farming?",
        "question_type": "choice_multiple",
        "section": "Challenges & Opportunities",
        "is_required": True,
        "order": 24,
        "options": ["Technical training", "Access to credit", "Better prices", "Quality inputs", "Market information", "Infrastructure", "Youth involvement"]
    },

    # Technology & Innovation Section
    {
        "text": "Do you have access to mobile phone technology?",
        "question_type": "choice_single",
        "section": "Technology & Innovation",
        "is_required": True,
        "order": 25,
        "options": ["Yes, smartphone", "Yes, basic phone", "No, but have access", "No access"]
    },
    {
        "text": "How often do you receive agricultural extension services?",
        "question_type": "choice_single",
        "section": "Technology & Innovation",
        "is_required": True,
        "order": 26,
        "options": ["Monthly", "Quarterly", "Annually", "Rarely", "Never"]
    }
]

class CocoaSurveySetup:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.project_id = None
        
    def check_server_status(self) -> bool:
        """Check if Django server is running"""
        try:
            # Use the root API endpoint instead of /health/
            response = self.session.get(f"{BASE_URL}/", timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def register_user(self) -> bool:
        """Register the user or login if already exists"""
        print(f"📝 Registering user: {USER_DATA['first_name']} {USER_DATA['last_name']} from {USER_DATA['profile']['organization']}...")
        
        # Try registration first
        try:
            response = self.session.post(f"{BASE_URL}/api/auth/register/", json=USER_DATA)
            if response.status_code == 201:
                print("✅ User registered successfully!")
                self.auth_token = response.json().get('token')
                return True
            elif response.status_code == 400:
                print(f"⚠️  Registration failed: {response.status_code}")
                print(f"   Error: {response.json()}")
                print("   Trying to login with existing credentials...")
                
                # Try login as fallback
                login_data = {
                    "username": USER_DATA['username'],
                    "password": USER_DATA['password']
                }
                
                login_response = self.session.post(f"{BASE_URL}/api/auth/login/", json=login_data)
                if login_response.status_code == 200:
                    print(f"🔑 Logging in user: {USER_DATA['username']}...")
                    print("✅ Login successful!")
                    login_result = login_response.json()
                    self.auth_token = login_result.get('token')
                    print(f"   Username: {login_result.get('username')}")
                    return True
                else:
                    print(f"❌ Login failed: {login_response.status_code}")
                    print(f"   Error: {login_response.json()}")
                    return False
            else:
                print(f"❌ Registration failed: {response.status_code}")
                print(f"   Error: {response.json()}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error during registration: {e}")
            return False
    
    def create_project(self) -> bool:
        """Create the cocoa value chain survey project"""
        print(f"🌱 Creating project: {PROJECT_NAME}...")
        
        # Check if project already exists
        try:
            headers = {'Authorization': f'Token {self.auth_token}'}
            projects_response = self.session.get(f"{BASE_URL}/api/projects/projects/", headers=headers)
            
            if projects_response.status_code == 200:
                response_data = projects_response.json()
                # Handle paginated response
                if isinstance(response_data, dict) and 'results' in response_data:
                    projects = response_data['results']
                elif isinstance(response_data, list):
                    projects = response_data
                else:
                    print(f"⚠️  Unexpected API response format: {type(response_data)}")
                    projects = []
                
                # Look for existing project
                for project in projects:
                    if isinstance(project, dict) and project.get('name') == PROJECT_NAME:
                        print("🔍 Found existing project: {}".format(project['name']))
                        print("✅ Using existing project!")
                        self.project_id = project['id']
                        print(f"   Project ID: {project['id']}")
                        print(f"   Name: {project['name']}")
                        print(f"   Created: {project.get('created_at', 'N/A')}")
                        return True
            
            # Create new project if not found
            response = self.session.post(
                f"{BASE_URL}/api/projects/projects/",
                json=PROJECT_DATA,
                headers=headers
            )
            
            if response.status_code == 201:
                project_result = response.json()
                self.project_id = project_result['id']
                print("✅ Project created successfully!")
                print(f"   Project ID: {self.project_id}")
                print(f"   Name: {project_result['name']}")
                return True
            else:
                print(f"❌ Project creation failed: {response.status_code}")
                print(f"   Error: {response.json()}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error during project creation: {e}")
            return False
    
    def create_survey_form(self) -> bool:
        """Create the comprehensive survey form"""
        print("📋 Creating comprehensive 26-question survey form...")
        
        try:
            headers = {'Authorization': f'Token {self.auth_token}'}
            
            # Check if questions already exist
            questions_response = self.session.get(
                f"{BASE_URL}/api/forms/questions/",
                headers=headers,
                params={'project': self.project_id}
            )
            
            if questions_response.status_code == 200:
                response_data = questions_response.json()
                # Handle paginated response
                if isinstance(response_data, dict) and 'results' in response_data:
                    existing_questions = response_data['results']
                elif isinstance(response_data, list):
                    existing_questions = response_data
                else:
                    existing_questions = []
                
                if existing_questions:
                    print(f"🔍 Found {len(existing_questions)} existing questions for project")
                    print("✅ Using existing survey form!")
                    print(f"   Total questions: {len(existing_questions)}")
                    return True
            
            # Create new questions
            questions_data = []
            for question in SURVEY_QUESTIONS:
                question_data = {
                    'project': self.project_id,
                    'question_text': question['text'],
                    'response_type': question['question_type'],
                    'is_required': question.get('is_required', True),
                    'options': question.get('options', None),
                    'order_index': question.get('order', 0),
                }
                questions_data.append(question_data)
            
            # Send bulk create request
            response = self.session.post(
                f"{BASE_URL}/api/forms/questions/bulk_create/",
                json=questions_data,
                headers=headers
            )
            
            if response.status_code == 201:
                result = response.json()
                print("✅ Survey form created successfully!")
                
                # Handle both list and dict response formats
                if isinstance(result, list):
                    created_count = len(result)
                elif isinstance(result, dict):
                    created_count = len(result.get('created', []))
                else:
                    created_count = 0
                
                print(f"   Created questions: {created_count}")
                print(f"   Total questions: {len(SURVEY_QUESTIONS)}")
                
                # Display question breakdown by section
                sections = {}
                for question in SURVEY_QUESTIONS:
                    section = question['section']
                    if section not in sections:
                        sections[section] = 0
                    sections[section] += 1
                
                print("\n📊 Question breakdown by section:")
                for section, count in sections.items():
                    print(f"   • {section}: {count} questions")
                    
                return True
            else:
                print(f"❌ Survey creation failed: {response.status_code}")
                print(f"   Error: {response.json()}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error during survey creation: {e}")
            return False
    
    def run_setup(self):
        """Run the complete setup process"""
        print("🌟 Starting Complete Cocoa Value Chain Survey Setup")
        print("=" * 60)
        
        # Check server status
        print(f"📡 Checking if Django server is running on {BASE_URL}...")
        if not self.check_server_status():
            print("❌ Django server is not running!")
            print("   Please start the Django server first:")
            print("   python manage.py runserver")
            return
        
        print("✅ Django server is running!")
        
        # Step 1: Register user
        if not self.register_user():
            print("❌ Setup failed at user registration")
            return
        
        # Step 2: Create project
        if not self.create_project():
            print("❌ Setup failed at project creation")
            return
        
        # Step 3: Create survey form
        if not self.create_survey_form():
            print("❌ Setup failed at survey form creation")
            return
        
        print("\n🎉 Setup completed successfully!")
        print("=" * 60)
        print("✅ User registered/logged in")
        print("✅ Project created")
        print("✅ 26-question survey form created")
        print("\nNext steps:")
        print("1. Access the Django admin panel to review the project")
        print("2. Use the Kivy GUI to start data collection")
        print("3. Begin surveying cocoa farmers in Ghana")
        print(f"4. Project ID: {self.project_id}")

def main():
    """Main function to run the setup"""
    setup = CocoaSurveySetup()
    setup.run_setup()

if __name__ == "__main__":
    main() 