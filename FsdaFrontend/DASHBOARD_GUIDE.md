# Dashboard User Guide

## 🎯 Overview

The FSDA Dashboard is your central hub for managing collaborative research data collection projects across the globe.

## 📊 Dashboard Features

### Main Dashboard
- **Welcome Section** - Personalized greeting with your name
- **Statistics Cards** - Quick overview of:
  - Total Projects
  - Total Questions
  - Total Responses
  - Total Team Members
- **Search Bar** - Find projects quickly by name or description
- **Status Filters** - Filter projects by sync status (All, Synced, Pending, Error)
- **Project Cards** - Visual cards showing:
  - Project name and description
  - Question count
  - Response count
  - Team member count
  - Sync status
  - Last updated date

### Project Actions
- **Create New Project** - FAB button (bottom right) or click empty state
- **View Project Details** - Tap any project card
- **Search Projects** - Use search bar to filter
- **Filter by Status** - Quick status filter chips
- **Pull to Refresh** - Swipe down to refresh project list

## 🗂️ Project Details Screen

When you tap a project, you'll see:

### Project Header
- Project name and avatar
- Description
- Quick stats (Questions, Responses, Members)

### Project Tools Menu
1. **Build Forms & Questionnaires** 📝
   - Create and manage data collection forms
   - Design questionnaires with multiple question types
   - Set validation rules and required fields

2. **Analytics** 📊 (Coming Soon)
   - View insights and data visualizations
   - Statistical analysis of collected data
   - Export reports

3. **Project Members** 👥
   - Manage team members and collaborators
   - Assign roles and permissions
   - Invite new members
   - View member activity

4. **Sync & Backup** ☁️
   - Sync data with cloud storage
   - Manage offline access
   - View sync status and history
   - Resolve sync conflicts

## 🎨 Question Types Supported

The form builder supports various question types:

### Text Responses
- Short Text
- Long Text (paragraphs)

### Numeric Responses
- Integer numbers
- Decimal numbers
- Rating scales

### Choice Responses
- Single choice (radio buttons)
- Multiple choice (checkboxes)

### Date & Time
- Date picker
- Date & Time picker

### Location Data
- GPS coordinates
- Geographic shapes

### Media
- Photo/Image upload
- Audio recording
- Video recording
- File upload

### Special Types
- Digital signature
- Barcode/QR code scanner

## 👥 Collaboration Features

### Team Roles
- **Owner** - Full control (creator)
- **Admin** - Manage project and members
- **Member** - Create and view data
- **Viewer** - Read-only access

### Permissions
Projects support granular permissions:
- View project
- Edit project
- Create questions
- Edit questions
- Delete questions
- View responses
- Edit responses
- Delete responses
- Manage members
- Sync data

## 🔄 Sync & Offline Features

### Sync Status
- **Synced** (Green) - All data synced with cloud
- **Pending** (Orange) - Changes waiting to sync
- **Error** (Red) - Sync errors need attention

### Offline Mode
- Create projects offline
- Collect responses offline
- Auto-sync when connection restored
- Conflict resolution for simultaneous edits

## 🎯 Workflow Example

### Creating a Research Project

1. **Tap** "New Project" FAB button
2. **Enter** project name (e.g., "Cocoa Farm Survey 2024")
3. **Add** description (optional)
4. **Tap** "Create"
5. **Open** the project
6. **Select** "Build Forms & Questionnaires"
7. **Add** questions for data collection
8. **Invite** team members
9. **Start** collecting responses
10. **View** analytics when ready

### Inviting Team Members

1. Open project
2. Tap "Project Members"
3. Tap "Invite Member"
4. Enter email or username
5. Select role and permissions
6. Send invitation
7. Member receives notification

### Collecting Data

1. Open project
2. Team members access via mobile devices
3. Fill out questionnaire forms
4. Submit responses (works offline)
5. Data syncs automatically
6. View responses in dashboard

## 📱 Mobile & Tablet Support

- **Tablet-Optimized** - Landscape mode by default
- **Responsive Design** - Adapts to different screen sizes
- **Touch-Friendly** - Large buttons and cards
- **Offline-First** - Works without internet

## 🔒 Security

- **Encrypted Storage** - All tokens encrypted
- **Secure Authentication** - Django Token Auth
- **Permission-Based** - Granular access control
- **Audit Trail** - Track all changes

## 🚀 Coming Soon

- **Advanced Analytics** - Charts, graphs, statistical analysis
- **Export Options** - CSV, Excel, PDF exports
- **Real-time Collaboration** - See team members online
- **Notifications** - Project updates and mentions
- **Templates** - Pre-built survey templates
- **Multi-language** - Support for multiple languages

## 💡 Tips & Tricks

### Organize Projects
- Use descriptive names
- Add detailed descriptions
- Tag projects with metadata
- Archive completed projects

### Optimize Data Collection
- Test forms before deployment
- Use required fields wisely
- Add validation rules
- Provide clear instructions

### Team Collaboration
- Assign clear roles
- Set proper permissions
- Communicate via project notes
- Review changes regularly

### Performance
- Sync regularly
- Clean up old data
- Monitor storage usage
- Optimize offline data

## 🆘 Troubleshooting

### Projects Not Loading
1. Check internet connection
2. Refresh (pull down)
3. Check Django backend is running
4. Verify API URL in config

### Can't Create Project
1. Check login status
2. Verify permissions
3. Check backend logs
4. Try refresh

### Sync Errors
1. Check internet connection
2. Check sync status
3. Resolve conflicts manually
4. Contact admin if persists

---

**Need help?** Contact your system administrator or check the full documentation in README.md

**Happy Researching!** 🔬📊🌍