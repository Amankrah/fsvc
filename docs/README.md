# FSDA Documentation

Comprehensive technical documentation for the FSDA Research Data Collection Platform.

## 📚 Documentation Index

This folder contains detailed technical documentation for developers and researchers working with the FSDA platform.

## 🗂️ Documentation Files

### Architecture & Planning
- **[project-structure.md](./project-structure.md)** - Complete project structure and setup guide
- **[proper-architecture.md](./proper-architecture.md)** - Architectural decisions and patterns
- **[research-tool-plan.md](./research-tool-plan.md)** - Research tool planning documentation

### Implementation Guides
- **[key-implementations.md](./key-implementations.md)** - Key implementation examples and code snippets
- **[form-builder-improvements.md](./form-builder-improvements.md)** - Form builder modernization guide

## 📖 Quick Reference

### For Developers

**Getting Started**:
1. Read [project-structure.md](./project-structure.md) for project setup
2. Review [key-implementations.md](./key-implementations.md) for code examples
3. Check [proper-architecture.md](./proper-architecture.md) for design patterns

**Form Development**:
- See [form-builder-improvements.md](./form-builder-improvements.md) for form builder architecture
- Review question type implementations
- Understand validation and rendering systems

### For Researchers

**Planning Research Projects**:
- Review [research-tool-plan.md](./research-tool-plan.md) for planning guidance
- Understand data collection workflows
- Learn about analytics capabilities

## 🏗️ Architecture Overview

### System Components

```
FSDA Platform
├── Django Backend (API)
│   ├── Authentication
│   ├── Projects & Collaboration
│   ├── Forms & Questions
│   └── Responses & Export
├── FastAPI Analytics
│   ├── Auto-detection
│   ├── Descriptive Stats
│   ├── Inferential Tests
│   └── Text/Sentiment Analysis
└── React Native Frontend
    ├── Data Collection
    ├── Response Review
    └── Team Management
```

### Key Technologies

**Backend**:
- Django 5.0 + Django REST Framework
- FastAPI for analytics
- PostgreSQL/SQLite database
- Celery + Redis (task queue)

**Frontend**:
- React Native + Expo
- TypeScript
- React Navigation
- React Native Paper (Material Design)

**Analytics**:
- Pandas, NumPy, SciPy
- Scikit-learn
- NLTK (text analysis)
- Matplotlib, Seaborn (visualization)

## 📋 Key Features Documentation

### Data Collection System
- Auto-generated unique respondent IDs
- Support for 12+ question types
- Offline-first architecture with sync
- Real-time validation
- Progress tracking

### Question Types
- **Text**: Short and long text
- **Numeric**: Integer and decimal
- **Choice**: Single and multiple choice
- **Rating**: Scale ratings (1-10)
- **Date/Time**: Date and datetime pickers
- **Location**: GPS coordinates + address
- **Media**: Image capture/upload

### Team Collaboration
- Project-specific invitations
- 5 role levels:
  - Owner (full control)
  - Collaborator (edit project)
  - Analyst (run analytics)
  - Member (collect data)
  - Viewer (read-only)
- 10 granular permissions
- Invitation tokens with 7-day expiry

### Response Management
- Real-time response tracking
- Data quality scoring
- CSV export functionality
- Search and filter capabilities
- Respondent detail views

### Analytics Engine
- Auto-detection of appropriate analyses
- Descriptive statistics (mean, median, std dev)
- Inferential statistics (t-test, ANOVA, chi-square)
- Text analysis and sentiment
- Data visualization

## 🔄 Data Flow

### Collection Flow
```
1. Researcher creates project
2. Builds form with questions
3. Invites team members
4. Data collectors download app
5. Collect responses (offline capable)
6. Data syncs to backend
7. Researcher reviews responses
8. Exports data for analysis
```

### Sync Architecture
```
Mobile App → Local SQLite → Sync Queue
     ↓
Online Detection → Batch Upload
     ↓
Django Backend → PostgreSQL
     ↓
FastAPI Analytics → Results
```

## 🛠️ Development Guidelines

### Code Style
- **Python**: PEP 8, Black formatter
- **TypeScript**: ESLint + Prettier
- **Documentation**: Comprehensive comments

### Testing
- **Backend**: pytest, Django test framework
- **Frontend**: Jest, React Native Testing Library
- **Coverage**: Minimum 80% code coverage

### Version Control
- Feature branches
- Pull request reviews
- Semantic versioning

## 📊 Database Schema

### Core Models

**Project**:
- id, name, description
- created_by, created_at
- is_active

**ProjectMember**:
- project, user
- role, permissions
- invited_by, joined_at

**Question**:
- project, question_text
- response_type, options
- validation_rules
- is_required, order_index

**Respondent**:
- project, respondent_id (unique)
- name, email (optional)
- is_anonymous, consent_given

**Response**:
- project, question, respondent
- response_value
- collected_at, quality_score

## 🔐 Security

### Authentication
- Token-based authentication (Django REST Framework Token)
- Secure password hashing (bcrypt)
- Token expiry and refresh

### Authorization
- Project-level access control
- Role-based permissions
- Granular permission checks on all endpoints

### Data Protection
- Encrypted token storage on mobile
- HTTPS required in production
- No sensitive data in logs
- CORS configuration

## 📈 Performance

### Optimization Strategies
- Database query optimization (select_related, prefetch_related)
- API response caching
- Pagination for large datasets
- Background task processing (Celery)
- Image compression for uploads
- React component memoization

### Scalability
- Horizontal scaling with load balancing
- Database connection pooling
- Redis caching layer
- CDN for static files

## 🐛 Troubleshooting

### Common Issues

**Database Connection Errors**:
- Check DATABASE_URL configuration
- Verify PostgreSQL is running
- Check firewall rules

**CORS Errors**:
- Add frontend URL to CORS_ALLOWED_ORIGINS
- Check protocol (http vs https)

**Sync Failures**:
- Check network connectivity
- Verify API endpoints are accessible
- Review sync queue for errors

**Token Expiration**:
- Implement token refresh in frontend
- Check token expiry settings

## 📚 Additional Resources

### External Documentation
- **Django**: https://docs.djangoproject.com/
- **Django REST Framework**: https://www.django-rest-framework.org/
- **FastAPI**: https://fastapi.tiangolo.com/
- **React Native**: https://reactnative.dev/
- **Expo**: https://docs.expo.dev/

### Related Documentation
- **Root README**: `../README.md` - Project overview
- **Backend README**: `../backend/README.md` - API documentation
- **Frontend README**: `../FsdaFrontend/README.md` - Mobile app documentation

## 🤝 Contributing

### Documentation Standards
- Clear, concise writing
- Code examples for complex topics
- Diagrams for architecture
- Keep documentation up to date
- Version documentation changes

### Adding New Documentation
1. Create new .md file in `/docs`
2. Update this README index
3. Link from relevant sections
4. Review for clarity

## 📞 Support

For questions or clarifications:
- Review existing documentation
- Check code comments
- Consult team members
- Create detailed issue reports

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintained By**: Development Team
