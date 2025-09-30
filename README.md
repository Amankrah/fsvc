# Food System Value Analytics (FSVC) Platform

A comprehensive, production-ready data collection and analytics platform for food system research, value chain analysis, and agricultural surveys.

## 🎯 Overview

The Food System Value Analytics Platform is a full-stack application designed for researchers, data collectors, and analysts to efficiently collect, manage, and analyze food system data. It features offline-first mobile data collection, real-time synchronization, advanced analytics capabilities, and specialized tools for agricultural and food system value chain analysis.

## ✨ Key Features

### Data Collection
- **Auto-generated Respondent IDs** - Unique identifier system with manual override
- **Multi-question Type Support** - Text, numeric, choice, date, location, image, and more
- **Offline Data Collection** - Works without internet connection
- **Real-time Validation** - Immediate feedback on data quality
- **Progress Tracking** - Visual progress indicators for respondents

### Response Management
- **Real-time Response Review** - View and search collected responses
- **CSV Export** - Download data for analysis in Excel/SPSS/R
- **Data Quality Scoring** - Automatic quality assessment
- **Respondent Tracking** - Track individual respondent progress

### Project Collaboration
- **Team Invitations** - Invite members to specific projects
- **Role-based Permissions** - Owner, Collaborator, Analyst, Member, Viewer
- **Project-specific Access** - Granular access control per project

### Analytics (Backend)
- **Auto-detection Analytics** - Automatically suggest appropriate analyses
- **Descriptive Statistics** - Mean, median, mode, standard deviation
- **Inferential Statistics** - T-tests, ANOVA, chi-square tests
- **Text Analysis** - Sentiment analysis, word clouds, topic modeling
- **Data Visualization** - Charts and graphs

## 🏗️ Architecture

```
fsvc/data_collect/
├── backend/               # Django REST API
│   ├── authentication/    # User authentication
│   ├── projects/         # Project management
│   ├── forms/            # Form builder
│   ├── responses/        # Response management
│   └── fastapi/          # FastAPI analytics engine
├── FsdaFrontend/         # React Native mobile app
│   ├── src/
│   │   ├── screens/      # UI screens
│   │   ├── services/     # API services
│   │   ├── navigation/   # App navigation
│   │   └── utils/        # Utility functions
└── docs/                 # Documentation
```

## 🚀 Quick Start

### Prerequisites
- **Backend**: Python 3.10+, Django 5.0+
- **Frontend**: Node.js 18+, React Native, Expo
- **Database**: PostgreSQL (production) or SQLite (development)

### Installation

#### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start server
python manage.py runserver
```

#### 2. Frontend Setup
```bash
# Navigate to frontend
cd FsdaFrontend

# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run ios      # iOS simulator
npm run android  # Android emulator
npm run web      # Web browser
```

### First Steps

1. **Create a Project**
   - Login to the app
   - Navigate to Projects
   - Click "Create Project"
   - Add project details

2. **Build a Form**
   - Open your project
   - Go to "Form Builder"
   - Add questions
   - Configure question types and validation

3. **Collect Data**
   - Navigate to "Data Collection"
   - Auto-generated respondent ID appears
   - Fill out survey
   - Submit responses

4. **Review Responses**
   - Go to "Responses"
   - View summary statistics
   - Search and filter data
   - Export to CSV

5. **Invite Team Members**
   - Open "Members" screen
   - Click "Invite"
   - Enter email and assign role
   - Team member receives invitation code

## 📱 Supported Question Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Text (Short)** | Single-line text | Names, short answers |
| **Text (Long)** | Multi-line text | Comments, descriptions |
| **Numeric (Integer)** | Whole numbers | Age, count |
| **Numeric (Decimal)** | Decimal numbers | Measurements, prices |
| **Single Choice** | Radio buttons | Gender, yes/no |
| **Multiple Choice** | Checkboxes | Multiple selections |
| **Rating Scale** | 1-10 scale | Satisfaction ratings |
| **Date** | Date picker | Birth date, event date |
| **DateTime** | Date and time | Event timestamp |
| **Location (GPS)** | Coordinates + address | Farm location |
| **Image** | Photo capture/upload | Harvest photos, documents |

## 🔐 User Roles & Permissions

### Owner
- Full project control
- Invite/remove members
- Manage roles and permissions
- Delete project

### Collaborator
- Edit project settings
- Manage questions/forms
- View, edit, delete responses
- Run analytics
- Export data

### Analyst
- View project
- View responses
- Run analytics
- Export data

### Member
- View project
- View and edit responses
- View analytics

### Viewer
- View project
- View responses (read-only)

## 📊 Data Flow

```
Mobile App (React Native)
    ↓
  Collect Data
    ↓
Local Storage (Offline Support)
    ↓
  Sync to Backend (When Online)
    ↓
Django REST API
    ↓
PostgreSQL Database
    ↓
FastAPI Analytics Engine
    ↓
Analysis Results
```

## 🔄 Sync Architecture

- **Offline-First**: All data stored locally first
- **Background Sync**: Automatic sync when online
- **Conflict Resolution**: Timestamp-based conflict handling
- **Queue Management**: Failed syncs automatically retried

## 📚 Documentation

- **[Backend README](./backend/README.md)** - Django API documentation
- **[Frontend README](./FsdaFrontend/README.md)** - React Native app documentation
- **[Docs Folder](./docs/README.md)** - Detailed technical documentation

### Key Documentation Files
- **Project Invitation System**: Team collaboration guide
- **Respondent ID System**: Auto-generated ID documentation
- **Data Collection Flow**: Complete submission process
- **Form Builder**: Question setup and management
- **Analytics**: Auto-detection and analytics guide

## 🛠️ Technology Stack

### Backend
- **Django 5.0** - Web framework
- **Django REST Framework** - API framework
- **FastAPI** - Analytics engine
- **PostgreSQL** - Production database
- **SQLite** - Development database
- **Celery** - Task queue
- **Redis** - Caching

### Frontend
- **React Native** - Mobile framework
- **Expo** - Development platform
- **React Navigation** - Navigation
- **React Native Paper** - UI components
- **Axios** - HTTP client
- **AsyncStorage** - Local storage

### Analytics
- **Pandas** - Data manipulation
- **NumPy** - Numerical computing
- **SciPy** - Scientific computing
- **Scikit-learn** - Machine learning
- **NLTK** - Natural language processing
- **Matplotlib/Seaborn** - Visualization

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd FsdaFrontend
npm test
```

## 📦 Deployment

### Backend (Django)
```bash
# Collect static files
python manage.py collectstatic

# Run with Gunicorn
gunicorn core.wsgi:application --bind 0.0.0.0:8000
```

### Frontend (React Native)
```bash
# Build for Android
npm run build:android

# Build for iOS
npm run build:ios

# Build for Web
npm run build:web
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 👥 Team

- **Project Owner**: Research Team
- **Lead Developer**: Development Team
- **Contributors**: See CONTRIBUTORS.md

## 📞 Support

For issues, questions, or support:
- **Email**: support@fsdaresearch.org
- **Documentation**: See `/docs` folder
- **Issues**: GitHub Issues (if applicable)

## 🗺️ Roadmap

### Current Version (1.0)
- ✅ Complete data collection system
- ✅ Auto-generated respondent IDs
- ✅ Multi-question type support
- ✅ Team collaboration features
- ✅ CSV export functionality
- ✅ Offline data collection

### Planned Features (2.0)
- [ ] Real-time collaboration
- [ ] Advanced analytics dashboard
- [ ] Conditional question logic
- [ ] Multi-language support
- [ ] Voice recording questions
- [ ] Video capture questions
- [ ] Barcode scanning
- [ ] Digital signatures
- [ ] Automated reports
- [ ] Data visualization widgets

## 📈 Project Stats

- **Lines of Code**: 50,000+
- **Supported Question Types**: 12+
- **Team Roles**: 5
- **Granular Permissions**: 10
- **Platforms**: iOS, Android, Web
- **Languages**: Python, JavaScript/TypeScript

## 🎓 Citation

If you use this platform in your research, please cite:

```
Food System Value Analytics (FSVC) Platform (2025)
Version 1.0
https://github.com/Amankrah/fsvc
```

## 🔗 Repository

**GitHub**: https://github.com/Amankrah/fsvc

---

**Built with ❤️ for food system researchers and agricultural development**

Last Updated: January 2025
Version: 1.0.0
Status: ✅ Production Ready
