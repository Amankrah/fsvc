# Cocoa Value Chain Survey Setup

## Overview

This collection of scripts sets up a comprehensive cocoa value chain survey system for research in Ghana. The system is designed for Emmanuel Akwofie from McGill University's Agricultural Economics department to study cocoa farming practices, economic impacts, and sustainable development opportunities.

## What It Does

The setup script performs three main tasks:

1. **User Registration**: Creates an account for Emmanuel Akwofie with McGill University credentials
2. **Project Creation**: Sets up a research project focused on cocoa value chain analysis in Ghana
3. **Survey Form Building**: Creates a comprehensive 26-question survey covering:
   - Demographics (6 questions)
   - Farm Characteristics (4 questions)
   - Production & Practices (4 questions)
   - Value Chain Participation (4 questions)
   - Economic Impacts (3 questions)
   - Challenges & Opportunities (3 questions)
   - Technology & Innovation (2 questions)

## Files

- `setup_cocoa_survey.py` - Main setup script with all functionality
- `run_cocoa_survey_setup.py` - Interactive runner for easy execution
- `COCOA_SURVEY_README.md` - This documentation file

## Prerequisites

1. **Django Server Running**: Make sure the Django development server is running on port 8000
   ```bash
   cd backend
   python manage.py runserver
   ```

2. **Python Dependencies**: Ensure you have the required packages installed
   ```bash
   pip install requests
   ```

## Usage

### Quick Start

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Run the interactive setup:
   ```bash
   python run_cocoa_survey_setup.py
   ```

3. Follow the prompts to confirm setup

### Direct Script Execution

You can also run the main script directly:

```bash
python setup_cocoa_survey.py
```

## API Endpoints Used

The script interacts with the following Django REST API endpoints:

- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User authentication (fallback)
- `GET /api/projects/projects/` - List existing projects
- `POST /api/projects/projects/` - Create new project
- `GET /api/forms/questions/` - List existing questions
- `POST /api/forms/questions/bulk_create/` - Create survey questions

## Survey Structure

The survey is organized into 7 sections:

### 1. Demographics (6 questions)
- Full name
- Age
- Gender
- Education level
- Region
- Community/village

### 2. Farm Characteristics (4 questions)
- Years of cocoa farming experience
- Farm size
- Land acquisition method
- Cocoa varieties grown

### 3. Production & Practices (4 questions)
- Production volume
- Fertilizer usage
- Pest management
- Shade management

### 4. Value Chain Participation (4 questions)
- Primary buyers
- Transportation methods
- Price satisfaction
- Cooperative membership

### 5. Economic Impacts (3 questions)
- Income dependency on cocoa
- Financial situation changes
- Alternative income sources

### 6. Challenges & Opportunities (3 questions)
- Main farming challenges
- Climate change impacts
- Support needs

### 7. Technology & Innovation (2 questions)
- Mobile phone access
- Extension services frequency

## Research Context

This survey is designed to support agricultural economics research at McGill University, focusing on:

- **Cocoa value chain analysis** in Ghana's major cocoa-producing regions
- **Economic impacts** of cocoa farming on rural communities
- **Sustainable development opportunities** in the cocoa sector
- **Technology adoption** and innovation in cocoa farming
- **Climate change adaptation** strategies

## Target Regions

The survey focuses on Ghana's primary cocoa-producing regions:
- Ashanti Region
- Western Region
- Central Region

## Troubleshooting

### Common Issues

1. **Django Server Not Running**
   ```
   Error: Django server is not running!
   ```
   **Solution**: Start the Django server with `python manage.py runserver`

2. **User Already Exists**
   ```
   Registration failed: user with this email already exists
   ```
   **Solution**: The script will automatically attempt to login with existing credentials

3. **Project Already Exists**
   ```
   Found existing project: Cocoa Value Chain Survey - Ghana 2024
   ```
   **Solution**: The script will use the existing project instead of creating a new one

4. **Questions Already Exist**
   ```
   Found X existing questions for project
   ```
   **Solution**: The script will use existing questions instead of creating new ones

### Error Handling

The script includes robust error handling for:
- Network connection issues
- Authentication failures
- Duplicate resource creation
- Invalid API responses

## Output Example

```
🌟 Starting Complete Cocoa Value Chain Survey Setup
============================================================
📡 Checking if Django server is running on http://127.0.0.1:8000...
✅ Django server is running!
📝 Registering user: Emmanuel Akwofie from McGill University...
✅ User registered successfully!
🌱 Creating project: Cocoa Value Chain Survey - Ghana 2024...
✅ Project created successfully!
   Project ID: 3e96233d-7ffe-4c7e-b773-7e93b49af6be
📋 Creating comprehensive 26-question survey form...
✅ Survey form created successfully!
   Created questions: 26
   Total questions: 26

📊 Question breakdown by section:
   • Demographics: 6 questions
   • Farm Characteristics: 4 questions
   • Production & Practices: 4 questions
   • Value Chain Participation: 4 questions
   • Economic Impacts: 3 questions
   • Challenges & Opportunities: 3 questions
   • Technology & Innovation: 2 questions

🎉 Setup completed successfully!
✅ User registered/logged in
✅ Project created
✅ 26-question survey form created
```

## Next Steps

After running the setup:

1. **Review the Project**: Access the Django admin panel to review the created project and questions

2. **Start Data Collection**: Use the Kivy GUI application to begin surveying cocoa farmers

3. **Analytics**: Use the analytics engine to process collected data:
   ```bash
   cd backend/analytics
   python start_analytics.py
   ```

4. **Access Project**: Use the returned Project ID to access the survey through the GUI

## Support

For issues or questions:
- Check the Django server logs
- Verify API endpoint accessibility
- Ensure proper database migrations are applied
- Contact the development team for technical support

## License

This project is developed for academic research purposes at McGill University. 