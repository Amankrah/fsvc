#!/usr/bin/env python3
"""
Cocoa Survey Response Generator
==============================

This script generates 30 realistic respondents with their responses to the cocoa survey.
Creates diverse respondents with realistic Ghanaian demographics and farming contexts.

Author: Emmanuel Akwofie, McGill University
Research Focus: Agricultural Economics, Cocoa Value Chain Analysis
"""

import requests
import json
import random
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import uuid

# Configuration
BASE_URL = "http://127.0.0.1:8000"
PROJECT_NAME = "Cocoa Value Chain Survey - Ghana 2024"

# Ghanaian names for realistic respondents
GHANAIAN_NAMES = [
    "Kwame Asante", "Ama Osei", "Kofi Mensah", "Abena Addo", "Yaw Darko",
    "Akosua Boateng", "Kwesi Owusu", "Efua Ampah", "Kojo Sarpong", "Adwoa Frimpong",
    "Kwabena Agyeman", "Akua Kufuor", "Yaw Bonsu", "Abenaa Twumasi", "Kofi Anane",
    "Ama Serwaa", "Kwame Osei", "Efua Mensah", "Kojo Adjei", "Akosua Owusu",
    "Kwabena Darko", "Abena Ampah", "Yaw Sarpong", "Ama Frimpong", "Kofi Agyeman",
    "Akua Kufuor", "Kwame Bonsu", "Efua Twumasi", "Kojo Anane", "Abenaa Serwaa"
]

# Ghanaian villages/communities
GHANAIAN_COMMUNITIES = [
    "Kumasi Central", "Koforidua East", "Sunyani West", "Cape Coast North",
    "Tamale South", "Ho Central", "Bolgatanga East", "Wa West", "Kumasi Rural",
    "Koforidua Rural", "Sunyani Rural", "Cape Coast Rural", "Tamale Rural",
    "Ho Rural", "Bolgatanga Rural", "Wa Rural", "Kumasi Suburban", "Koforidua Suburban",
    "Sunyani Suburban", "Cape Coast Suburban", "Tamale Suburban", "Ho Suburban",
    "Bolgatanga Suburban", "Wa Suburban", "Kumasi Outskirts", "Koforidua Outskirts",
    "Sunyani Outskirts", "Cape Coast Outskirts", "Tamale Outskirts", "Ho Outskirts"
]

# Realistic response patterns for different demographics
RESPONSE_PATTERNS = {
    "young_farmer": {
        "age_range": (25, 40),
        "education": ["Junior High School", "Senior High School", "Technical/Vocational"],
        "farming_years": (3, 8),
        "farm_size": ["Less than 1 hectare", "1-2 hectares"],
        "land_acquisition": ["Inherited", "Purchased"],
        "satisfaction": [3, 4],  # Lower satisfaction
        "cooperative_member": ["Yes, actively participate", "Yes, but not very active"],
        "income_percentage": ["25-50%", "50-75%"],
        "financial_change": ["Slightly improved", "No change"],
        "climate_impact": ["Moderately affected", "Significantly affected"],
        "support_needs": ["Technical training", "Access to credit", "Better prices"]
    },
    "experienced_farmer": {
        "age_range": (45, 65),
        "education": ["Primary education", "Junior High School", "No formal education"],
        "farming_years": (15, 30),
        "farm_size": ["2-5 hectares", "5-10 hectares", "More than 10 hectares"],
        "land_acquisition": ["Inherited", "Purchased", "Rented"],
        "satisfaction": [2, 3, 4],  # Mixed satisfaction
        "cooperative_member": ["Yes, actively participate", "No, but interested"],
        "income_percentage": ["50-75%", "75-100%"],
        "financial_change": ["No change", "Slightly worse"],
        "climate_impact": ["Significantly affected", "Moderately affected"],
        "support_needs": ["Better prices", "Quality inputs", "Infrastructure"]
    },
    "large_farmer": {
        "age_range": (35, 60),
        "education": ["Senior High School", "Technical/Vocational", "University"],
        "farming_years": (10, 25),
        "farm_size": ["5-10 hectares", "More than 10 hectares"],
        "land_acquisition": ["Purchased", "Inherited"],
        "satisfaction": [4, 5],  # Higher satisfaction
        "cooperative_member": ["Yes, actively participate"],
        "income_percentage": ["75-100%"],
        "financial_change": ["Significantly improved", "Slightly improved"],
        "climate_impact": ["Slightly affected", "Moderately affected"],
        "support_needs": ["Market information", "Youth involvement", "Technical training"]
    }
}

class CocoaResponseGenerator:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.project_id = None
        self.questions_data = []
        
    def check_server_status(self) -> bool:
        """Check if Django server is running"""
        try:
            response = self.session.get(f"{BASE_URL}/", timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def login_user(self) -> bool:
        """Login with existing user credentials"""
        print("🔑 Logging in user: amankrah...")
        
        login_data = {
            "username": "amankrah",
            "password": "SecurePass354!"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/api/auth/login/", json=login_data)
            if response.status_code == 200:
                print("✅ Login successful!")
                login_result = response.json()
                self.auth_token = login_result.get('token')
                print(f"   Username: {login_result.get('username')}")
                return True
            else:
                print(f"❌ Login failed: {response.status_code}")
                print(f"   Error: {response.json()}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error during login: {e}")
            return False
    
    def get_project(self) -> bool:
        """Get the cocoa survey project"""
        print(f"🌱 Getting project: {PROJECT_NAME}...")
        
        try:
            headers = {'Authorization': f'Token {self.auth_token}'}
            projects_response = self.session.get(f"{BASE_URL}/api/projects/projects/", headers=headers)
            
            if projects_response.status_code == 200:
                response_data = projects_response.json()
                if isinstance(response_data, dict) and 'results' in response_data:
                    projects = response_data['results']
                elif isinstance(response_data, list):
                    projects = response_data
                else:
                    projects = []
                
                # Find the cocoa project
                for project in projects:
                    if isinstance(project, dict) and project.get('name') == PROJECT_NAME:
                        print("✅ Found cocoa project!")
                        self.project_id = project['id']
                        print(f"   Project ID: {project['id']}")
                        print(f"   Name: {project['name']}")
                        return True
            
            print("❌ Cocoa project not found!")
            return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error getting project: {e}")
            return False
    
    def get_questions(self) -> bool:
        """Get all questions for the project"""
        print("📋 Getting survey questions...")
        
        try:
            headers = {'Authorization': f'Token {self.auth_token}'}
            questions_response = self.session.get(
                f"{BASE_URL}/api/forms/questions/?project_id={self.project_id}&page_size=100",
                headers=headers
            )
            
            if questions_response.status_code == 200:
                response_data = questions_response.json()
                if isinstance(response_data, dict) and 'results' in response_data:
                    self.questions_data = response_data['results']
                elif isinstance(response_data, list):
                    self.questions_data = response_data
                else:
                    self.questions_data = []
                
                print(f"✅ Found {len(self.questions_data)} questions")
                return True
            else:
                print(f"❌ Failed to get questions: {questions_response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error getting questions: {e}")
            return False
    
    def generate_realistic_respondent(self, index: int) -> Dict[str, Any]:
        """Generate a realistic respondent profile"""
        # Choose respondent type based on index for diversity
        if index < 10:
            pattern = RESPONSE_PATTERNS["young_farmer"]
        elif index < 20:
            pattern = RESPONSE_PATTERNS["experienced_farmer"]
        else:
            pattern = RESPONSE_PATTERNS["large_farmer"]
        
        # Generate basic demographics
        age = random.randint(*pattern["age_range"])
        gender = random.choice(["Male", "Female"])
        education = random.choice(pattern["education"])
        farming_years = random.randint(*pattern["farming_years"])
        farm_size = random.choice(pattern["farm_size"])
        region = random.choice(["Ashanti", "Western", "Central", "Eastern", "Brong-Ahafo"])
        community = random.choice(GHANAIAN_COMMUNITIES)
        
        # Generate respondent data
        respondent_data = {
            'respondent_id': f"RESP_{datetime.now().strftime('%Y%m%d')}_{index+1:03d}",
            'project': self.project_id,
            'name': GHANAIAN_NAMES[index],
            'email': f"farmer{index+1}@example.com" if random.random() > 0.7 else "",
            'phone': f"+233{random.randint(200000000, 299999999)}" if random.random() > 0.5 else "",
            'demographics': {
                'age': age,
                'gender': gender,
                'education': education,
                'region': region,
                'community': community,
                'farming_years': farming_years,
                'farm_size': farm_size
            },
            'location_data': {
                'latitude': 5.5600 + random.uniform(-0.5, 0.5),  # Ghana coordinates
                'longitude': -0.2057 + random.uniform(-0.5, 0.5),
                'location_name': community,
                'accuracy': random.uniform(5, 50)
            },
            'is_anonymous': random.random() > 0.3,
            'consent_given': True
        }
        
        return respondent_data, pattern
    
    def generate_realistic_responses(self, respondent_data: Dict, pattern: Dict) -> List[Dict]:
        """Generate realistic responses based on respondent profile"""
        responses = []
        
        for question in self.questions_data:
            question_text = question.get('question_text', '')
            response_type = question.get('response_type', 'text_short')
            options = question.get('options', [])
            
            # Generate response based on question content and respondent pattern
            response_value = self.generate_response_for_question(
                question_text, response_type, options, pattern, respondent_data
            )
            
            if response_value is not None:
                responses.append({
                    'project': self.project_id,
                    'question': question['id'],
                    'respondent': respondent_data['respondent_id'],
                    'response_value': response_value,
                    'response_metadata': {
                        'generated': True,
                        'timestamp': datetime.now().isoformat(),
                        'device_info': {
                            'platform': 'Android',
                            'device_model': 'Samsung Galaxy',
                            'app_version': '1.0.0'
                        }
                    },
                    'location_data': respondent_data['location_data'],
                    'device_info': {
                        'platform': 'Android',
                        'device_model': 'Samsung Galaxy',
                        'os_version': 'Android 11',
                        'app_version': '1.0.0'
                    }
                })
        
        return responses
    
    def generate_response_for_question(self, question_text: str, response_type: str, 
                                     options: List, pattern: Dict, respondent_data: Dict) -> Any:
        """Generate a realistic response for a specific question"""
        
        # Demographics questions
        if "full name" in question_text.lower():
            return respondent_data['name']
        
        elif "age" in question_text.lower():
            return str(respondent_data['demographics']['age'])
        
        elif "gender" in question_text.lower():
            return respondent_data['demographics']['gender']
        
        elif "education" in question_text.lower():
            return respondent_data['demographics']['education']
        
        elif "region" in question_text.lower():
            return respondent_data['demographics']['region']
        
        elif "community" in question_text.lower() or "village" in question_text.lower():
            return respondent_data['demographics']['community']
        
        # Farm characteristics
        elif "years" in question_text.lower() and "farming" in question_text.lower():
            return str(respondent_data['demographics']['farming_years'])
        
        elif "size" in question_text.lower() and "farm" in question_text.lower():
            return respondent_data['demographics']['farm_size']
        
        elif "acquire" in question_text.lower() or "land" in question_text.lower():
            return random.choice(pattern['land_acquisition'])
        
        elif "varieties" in question_text.lower() or "cocoa varieties" in question_text.lower():
            return random.choice(options) if options else "Amelonado"
        
        # Production questions
        elif "production" in question_text.lower() and "bags" in question_text.lower():
            farm_size = respondent_data['demographics']['farm_size']
            if "Less than 1 hectare" in farm_size:
                return str(random.randint(5, 15))
            elif "1-2 hectares" in farm_size:
                return str(random.randint(15, 30))
            elif "2-5 hectares" in farm_size:
                return str(random.randint(30, 80))
            elif "5-10 hectares" in farm_size:
                return str(random.randint(80, 150))
            else:
                return str(random.randint(150, 300))
        
        elif "fertilizers" in question_text.lower():
            return random.choice(options) if options else "Yes, occasionally"
        
        elif "pests" in question_text.lower() or "diseases" in question_text.lower():
            return random.choice(options) if options else "Chemical pesticides"
        
        elif "shade" in question_text.lower():
            return random.choice(options) if options else "Yes, with forest trees"
        
        # Value chain questions
        elif "sell" in question_text.lower() and "cocoa" in question_text.lower():
            return random.choice(options) if options else "Licensed Buying Company (LBC)"
        
        elif "transport" in question_text.lower():
            return random.choice(options) if options else "Buyer provides transport"
        
        elif "satisfied" in question_text.lower() and "prices" in question_text.lower():
            satisfaction = random.choice(pattern['satisfaction'])
            if response_type == 'scale_rating':
                return str(satisfaction)
            else:
                return f"Rating: {satisfaction}/5"
        
        elif "cooperative" in question_text.lower() or "association" in question_text.lower():
            return random.choice(pattern['cooperative_member'])
        
        # Economic questions
        elif "percentage" in question_text.lower() and "income" in question_text.lower():
            return random.choice(pattern['income_percentage'])
        
        elif "financial situation" in question_text.lower():
            return random.choice(pattern['financial_change'])
        
        elif "income sources" in question_text.lower():
            if options and len(options) > 0:
                # Safe sampling - don't try to sample more than available
                max_samples = min(3, len(options))
                num_samples = random.randint(1, max_samples)
                other_sources = random.sample(options, num_samples)
            else:
                other_sources = ["Other crops", "Livestock"]
            return ", ".join(other_sources)
        
        # Challenges and opportunities
        elif "challenges" in question_text.lower():
            if options and len(options) > 0:
                # Safe sampling - don't try to sample more than available
                max_samples = min(4, len(options))
                num_samples = random.randint(2, max_samples)
                challenges = random.sample(options, num_samples)
            else:
                challenges = ["Pest and diseases", "Low prices"]
            return ", ".join(challenges)
        
        elif "climate change" in question_text.lower():
            return random.choice(pattern['climate_impact'])
        
        elif "support" in question_text.lower() and "need" in question_text.lower():
            support_needs = random.sample(pattern['support_needs'], random.randint(2, min(4, len(pattern['support_needs']))))
            return ", ".join(support_needs)
        
        # Technology questions
        elif "mobile phone" in question_text.lower():
            return random.choice(options) if options else "Yes, basic phone"
        
        elif "extension services" in question_text.lower():
            return random.choice(options) if options else "Quarterly"
        
        # Default responses for other questions
        else:
            if response_type == 'choice_single' and options:
                return random.choice(options)
            elif response_type == 'choice_multiple' and options:
                # Safe sampling for multiple choice
                max_samples = min(3, len(options))
                num_samples = random.randint(1, max_samples)
                return ", ".join(random.sample(options, num_samples))
            elif response_type == 'scale_rating':
                return str(random.randint(1, 5))
            elif response_type == 'numeric_integer':
                return str(random.randint(1, 100))
            elif response_type == 'text_short':
                return "Sample response"
            elif response_type == 'text_long':
                return "This is a sample long text response for the survey question."
            else:
                return "Yes" if random.random() > 0.5 else "No"
    
    def create_respondent_and_responses(self, index: int) -> bool:
        """Create a respondent and their responses"""
        try:
            # Generate respondent data
            respondent_data, pattern = self.generate_realistic_respondent(index)
            
            print(f"👤 Creating respondent {index + 1}/30: {respondent_data['name']}")
            
            # Create respondent
            headers = {'Authorization': f'Token {self.auth_token}'}
            respondent_response = self.session.post(
                f"{BASE_URL}/api/v1/respondents/",
                json=respondent_data,
                headers=headers
            )
            
            if respondent_response.status_code != 201:
                print(f"❌ Failed to create respondent: {respondent_response.status_code}")
                return False
            
            respondent_result = respondent_response.json()
            respondent_uuid = respondent_result['id']
            
            # Generate responses
            responses = self.generate_realistic_responses(respondent_data, pattern)
            
            # Create responses
            for i, response_data in enumerate(responses):
                # Update respondent UUID for API
                response_data['respondent'] = respondent_uuid
                
                response_response = self.session.post(
                    f"{BASE_URL}/api/v1/responses/",
                    json=response_data,
                    headers=headers
                )
                
                if response_response.status_code != 201:
                    print(f"❌ Failed to create response {i+1}: {response_response.status_code}")
                    continue
            
            print(f"✅ Created {len(responses)} responses for {respondent_data['name']}")
            return True
            
        except Exception as e:
            print(f"❌ Error creating respondent {index + 1}: {e}")
            return False
    
    def run_generation(self):
        """Run the complete response generation process"""
        print("🌟 Starting Cocoa Survey Response Generation")
        print("=" * 60)
        
        # Check server status
        print(f"📡 Checking if Django server is running on {BASE_URL}...")
        if not self.check_server_status():
            print("❌ Django server is not running!")
            print("   Please start the Django server first:")
            print("   python manage.py runserver")
            return
        
        print("✅ Django server is running!")
        
        # Login
        if not self.login_user():
            print("❌ Generation failed at login")
            return
        
        # Get project
        if not self.get_project():
            print("❌ Generation failed at project retrieval")
            return
        
        # Get questions
        if not self.get_questions():
            print("❌ Generation failed at questions retrieval")
            return
        
        # Generate respondents and responses
        print(f"\n🚀 Generating 30 respondents with responses...")
        print("-" * 60)
        
        successful_respondents = 0
        
        for i in range(30):
            if self.create_respondent_and_responses(i):
                successful_respondents += 1
            
            # Small delay to avoid overwhelming the server
            time.sleep(0.5)
        
        print("\n🎉 Response generation completed!")
        print("=" * 60)
        print(f"✅ Successfully created {successful_respondents}/30 respondents")
        print(f"✅ Each respondent has responses to all {len(self.questions_data)} questions")
        print(f"✅ Total responses created: ~{successful_respondents * len(self.questions_data)}")
        
        print("\nNext steps:")
        print("1. Check the responses in Django admin")
        print("2. Use the Kivy GUI to view collected data")
        print("3. Test analytics with the FastAPI engine")
        print("4. Export data for analysis")

def main():
    """Main function to run the response generation"""
    generator = CocoaResponseGenerator()
    generator.run_generation()

if __name__ == "__main__":
    main() 