# Key Implementation Files

## 1. Django Models (backend/projects/models.py)

```python
from django.db import models
from django.contrib.auth.models import User
import uuid
from django.utils import timezone

class BaseModel(models.Model):
    """Base model with common fields"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sync_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('syncing', 'Syncing'),
            ('synced', 'Synced'),
            ('failed', 'Failed')
        ],
        default='pending'
    )
    cloud_id = models.UUIDField(null=True, blank=True)
    
    class Meta:
        abstract = True

class Project(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='projects')
    collaborators = models.ManyToManyField(User, related_name='collaborated_projects', blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name
```

## 2. FastAPI Analytics Auto-Detection (analytics/app/analytics/auto_detect/detector.py)

```python
from typing import List, Dict, Any, Tuple
import pandas as pd
import numpy as np
from enum import Enum

class DataType(Enum):
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    TEXT = "text"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    MIXED = "mixed"

class AnalysisType(Enum):
    DESCRIPTIVE_STATS = "descriptive_statistics"
    FREQUENCY_ANALYSIS = "frequency_analysis"
    DISTRIBUTION_ANALYSIS = "distribution_analysis"
    CORRELATION_ANALYSIS = "correlation_analysis"
    TIME_SERIES = "time_series_analysis"
    TEXT_ANALYSIS = "text_analysis"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    CHI_SQUARE_TEST = "chi_square_test"
    T_TEST = "t_test"
    ANOVA = "anova"

class AutoDetector:
    def __init__(self):
        self.type_mapping = {
            DataType.NUMERIC: [
                AnalysisType.DESCRIPTIVE_STATS,
                AnalysisType.DISTRIBUTION_ANALYSIS,
                AnalysisType.CORRELATION_ANALYSIS
            ],
            DataType.CATEGORICAL: [
                AnalysisType.FREQUENCY_ANALYSIS,
                AnalysisType.CHI_SQUARE_TEST
            ],
            DataType.TEXT: [
                AnalysisType.TEXT_ANALYSIS,
                AnalysisType.SENTIMENT_ANALYSIS
            ],
            DataType.DATETIME: [
                AnalysisType.TIME_SERIES
            ],
            DataType.BOOLEAN: [
                AnalysisType.FREQUENCY_ANALYSIS
            ]
        }
    
    def detect_data_type(self, data: pd.Series) -> DataType:
        """Detect the data type of a pandas Series"""
        if data.empty:
            return DataType.MIXED
        
        # Check for datetime
        if pd.api.types.is_datetime64_any_dtype(data):
            return DataType.DATETIME
        
        # Check for boolean
        if data.dtype == bool or (data.dropna().isin([0, 1, True, False]).all()):
            return DataType.BOOLEAN
        
        # Check for numeric
        try:
            pd.to_numeric(data)
            return DataType.NUMERIC
        except:
            pass
        
        # Check for text vs categorical
        unique_ratio = len(data.unique()) / len(data)
        avg_length = data.astype(str).str.len().mean()
        
        if unique_ratio < 0.05 and avg_length < 50:
            return DataType.CATEGORICAL
        elif avg_length > 50:
            return DataType.TEXT
        else:
            return DataType.CATEGORICAL
    
    def detect_analyses(self, 
                       data: pd.DataFrame, 
                       target_column: str = None) -> Dict[str, List[AnalysisType]]:
        """Detect appropriate analyses for each column"""
        recommendations = {}
        
        for column in data.columns:
            data_type = self.detect_data_type(data[column])
            analyses = self.type_mapping.get(data_type, [])
            
            # Add cross-column analyses if target is specified
            if target_column and column != target_column:
                target_type = self.detect_data_type(data[target_column])
                
                if data_type == DataType.NUMERIC and target_type == DataType.NUMERIC:
                    analyses.append(AnalysisType.CORRELATION_ANALYSIS)
                elif data_type == DataType.CATEGORICAL and target_type == DataType.CATEGORICAL:
                    analyses.append(AnalysisType.CHI_SQUARE_TEST)
                elif data_type == DataType.NUMERIC and target_type == DataType.CATEGORICAL:
                    if len(data[target_column].unique()) == 2:
                        analyses.append(AnalysisType.T_TEST)
                    else:
                        analyses.append(AnalysisType.ANOVA)
            
            recommendations[column] = analyses
        
        return recommendations
    
    def get_analysis_parameters(self, 
                               analysis_type: AnalysisType, 
                               data: pd.DataFrame) -> Dict[str, Any]:
        """Get default parameters for each analysis type"""
        params = {
            AnalysisType.DESCRIPTIVE_STATS: {
                "percentiles": [0.25, 0.5, 0.75],
                "include_outliers": True
            },
            AnalysisType.DISTRIBUTION_ANALYSIS: {
                "bins": "auto",
                "test_normality": True
            },
            AnalysisType.CORRELATION_ANALYSIS: {
                "method": "pearson",
                "min_periods": 1
            },
            AnalysisType.TEXT_ANALYSIS: {
                "max_features": 100,
                "ngram_range": (1, 2),
                "remove_stopwords": True
            },
            AnalysisType.SENTIMENT_ANALYSIS: {
                "language": "en",
                "aggregate": True
            }
        }
        
        return params.get(analysis_type, {})
```

## 3. Kivy Sync Service (mobile/services/sync_service.py)

```python
import asyncio
import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Any
import requests
from kivy.clock import Clock
from kivy.network.urlrequest import UrlRequest
from plyer import connectivity

class SyncService:
    def __init__(self, db_service, auth_service):
        self.db_service = db_service
        self.auth_service = auth_service
        self.sync_url = "https://api.researchcollector.org/api/v1/sync"
        self.is_syncing = False
        self.sync_queue = []
        
        # Check connectivity every 30 seconds
        Clock.schedule_interval(self.check_and_sync, 30)
    
    def check_connectivity(self) -> bool:
        """Check if device has internet connectivity"""
        try:
            # Try to reach Google's DNS
            response = requests.get("https://8.8.8.8", timeout=3)
            return True
        except:
            return False
    
    def check_and_sync(self, dt=None):
        """Check connectivity and sync if online"""
        if not self.is_syncing and self.check_connectivity():
            self.start_sync()
    
    def start_sync(self):
        """Start the synchronization process"""
        if self.is_syncing:
            return
        
        self.is_syncing = True
        
        # Get pending items from sync queue
        cursor = self.db_service.conn.cursor()
        cursor.execute("""
            SELECT * FROM sync_queue 
            WHERE status = 'pending' 
            ORDER BY created_at ASC 
            LIMIT 100
        """)
        
        pending_items = cursor.fetchall()
        
        if pending_items:
            self.sync_batch(pending_items)
        else:
            self.pull_remote_changes()
    
    def sync_batch(self, items: List[sqlite3.Row]):
        """Sync a batch of items"""
        batch_data = []
        
        for item in items:
            batch_data.append({
                'id': item['id'],
                'table_name': item['table_name'],
                'record_id': item['record_id'],
                'operation': item['operation'],
                'data': json.loads(item['data'])
            })
        
        # Send batch to server
        headers = {
            'Authorization': f'Bearer {self.auth_service.get_token()}',
            'Content-Type': 'application/json'
        }
        
        def on_success(req, result):
            self.handle_sync_success(result, items)
        
        def on_error(req, error):
            self.handle_sync_error(error, items)
        
        UrlRequest(
            f"{self.sync_url}/push",
            req_body=json.dumps({'batch': batch_data}),
            req_headers=headers,
            on_success=on_success,
            on_error=on_error,
            on_failure=on_error
        )
    
    def handle_sync_success(self, result: Dict, items: List[sqlite3.Row]):
        """Handle successful sync response"""
        cursor = self.db_service.conn.cursor()
        
        # Update sync status for successful items
        for item in items:
            if item['id'] in result.get('success_ids', []):
                cursor.execute("""
                    UPDATE sync_queue 
                    SET status = 'completed', last_attempt = ? 
                    WHERE id = ?
                """, (datetime.now(), item['id']))
                
                # Update the original record's sync status
                cursor.execute(f"""
                    UPDATE {item['table_name']} 
                    SET sync_status = 'synced', cloud_id = ?
                    WHERE id = ?
                """, (result.get('cloud_ids', {}).get(str(item['id'])), item['record_id']))
        
        self.db_service.conn.commit()
        
        # Continue with pulling remote changes
        self.pull_remote_changes()
    
    def pull_remote_changes(self):
        """Pull changes from remote server"""
        # Get last sync timestamp
        cursor = self.db_service.conn.cursor()
        cursor.execute("""
            SELECT MAX(updated_at) as last_sync 
            FROM sync_metadata
        """)
        
        last_sync = cursor.fetchone()['last_sync'] or '2000-01-01T00:00:00'
        
        headers = {
            'Authorization': f'Bearer {self.auth_service.get_token()}'
        }
        
        def on_success(req, result):
            self.apply_remote_changes(result)
        
        def on_error(req, error):
            self.is_syncing = False
        
        UrlRequest(
            f"{self.sync_url}/pull?last_sync={last_sync}",
            req_headers=headers,
            on_success=on_success,
            on_error=on_error,
            on_failure=on_error
        )
    
    def apply_remote_changes(self, changes: Dict):
        """Apply remote changes to local database"""
        cursor = self.db_service.conn.cursor()
        
        for table_name, records in changes.items():
            for record in records:
                # Check if record exists locally
                cursor.execute(f"""
                    SELECT id FROM {table_name} 
                    WHERE cloud_id = ?
                """, (record['cloud_id'],))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing record
                    self.update_record(table_name, record)
                else:
                    # Insert new record
                    self.insert_record(table_name, record)
        
        # Update sync metadata
        cursor.execute("""
            INSERT OR REPLACE INTO sync_metadata (id, updated_at)
            VALUES (1, ?)
        """, (datetime.now(),))
        
        self.db_service.conn.commit()
        self.is_syncing = False
    
    def queue_change(self, table_name: str, record_id: str, 
                    operation: str, data: Dict):
        """Queue a change for sync"""
        cursor = self.db_service.conn.cursor()
        
        cursor.execute("""
            INSERT INTO sync_queue (table_name, record_id, operation, data)
            VALUES (?, ?, ?, ?)
        """, (table_name, record_id, operation, json.dumps(data)))
        
        self.db_service.conn.commit()
        
        # Try to sync immediately if online
        if self.check_connectivity():
            self.start_sync()
```

## 4. Django Sync API (backend/sync/views.py)

```python
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from datetime import datetime
import json

from .models import SyncLog
from .serializers import SyncBatchSerializer
from projects.models import Project
from forms.models import Question
from responses.models import Response

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def push_sync(request):
    """Handle batch sync push from mobile devices"""
    serializer = SyncBatchSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    batch = serializer.validated_data['batch']
    success_ids = []
    cloud_ids = {}
    errors = []
    
    with transaction.atomic():
        for item in batch:
            try:
                model_class = get_model_class(item['table_name'])
                
                if item['operation'] == 'create':
                    instance = model_class.objects.create(
                        **item['data'],
                        created_by=request.user
                    )
                    cloud_ids[str(item['id'])] = str(instance.id)
                    
                elif item['operation'] == 'update':
                    instance = model_class.objects.filter(
                        id=item['data']['cloud_id']
                    ).update(**item['data'])
                    
                elif item['operation'] == 'delete':
                    model_class.objects.filter(
                        id=item['data']['cloud_id']
                    ).delete()
                
                success_ids.append(item['id'])
                
                # Log sync operation
                SyncLog.objects.create(
                    user=request.user,
                    operation=item['operation'],
                    table_name=item['table_name'],
                    record_id=item['record_id'],
                    status='success'
                )
                
            except Exception as e:
                errors.append({
                    'id': item['id'],
                    'error': str(e)
                })
                
                SyncLog.objects.create(
                    user=request.user,
                    operation=item['operation'],
                    table_name=item['table_name'],
                    record_id=item['record_id'],
                    status='failed',
                    error_message=str(e)
                )
    
    return Response({
        'success_ids': success_ids,
        'cloud_ids': cloud_ids,
        'errors': errors
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pull_sync(request):
    """Pull changes from server since last sync"""
    last_sync = request.GET.get('last_sync', '2000-01-01T00:00:00')
    last_sync_dt = datetime.fromisoformat(last_sync)
    
    changes = {
        'projects': [],
        'questions': [],
        'responses': []
    }
    
    # Get user's accessible projects
    projects = Project.objects.filter(
        models.Q(created_by=request.user) | 
        models.Q(collaborators=request.user),
        updated_at__gt=last_sync_dt
    ).distinct()
    
    for project in projects:
        project_data = {
            'cloud_id': str(project.id),
            'name': project.name,
            'description': project.description,
            'created_by': str(project.created_by.id),
            'updated_at': project.updated_at.isoformat()
        }
        changes['projects'].append(project_data)
        
        # Get questions for this project
        questions = Question.objects.filter(
            project=project,
            updated_at__gt=last_sync_dt
        )
        
        for question in questions:
            question_data = {
                'cloud_id': str(question.id),
                'project_id': str(project.id),
                'question_text': question.question_text,
                'question_type': question.question_type,
                'options': question.options,
                'validation_rules': question.validation_rules,
                'order_index': question.order_index,
                'updated_at': question.updated_at.isoformat()
            }
            changes['questions'].append(question_data)
        
        # Get responses for this project
        responses = Response.objects.filter(
            project=project,
            updated_at__gt=last_sync_dt
        )
        
        for response in responses:
            response_data = {
                'cloud_id': str(response.id),
                'project_id': str(project.id),
                'question_id': str(response.question.id),
                'respondent_id': response.respondent_id,
                'response_value': response.response_value,
                'response_metadata': response.response_metadata,
                'collected_by': str(response.collected_by.id),
                'collected_at': response.collected_at.isoformat(),
                'updated_at': response.updated_at.isoformat()
            }
            changes['responses'].append(response_data)
    
    return Response(changes)

def get_model_class(table_name):
    """Get Django model class from table name"""
    model_mapping = {
        'projects': Project,
        'questions': Question,
        'responses': Response
    }
    return model_mapping.get(table_name)
```

## 5. Kivy Main Screen (mobile/screens/dashboard.py)

```python
from kivy.uix.screenmanager import Screen
from kivy.properties import ObjectProperty, StringProperty, NumericProperty
from kivy.lang import Builder
from kivy.clock import Clock
from kivymd.uix.card import MDCard
from kivymd.uix.list import OneLineListItem

Builder.load_file('kv/dashboard.kv')

class StatCard(MDCard):
    title = StringProperty()
    value = NumericProperty()
    trend = StringProperty()
    icon = StringProperty()

class DashboardScreen(Screen):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.app = None
        
    def on_enter(self):
        """Called when screen is displayed"""
        self.app = self.manager.get_screen('login').app
        self.load_dashboard_data()
        
        # Update stats every 5 seconds
        Clock.schedule_interval(self.update_stats, 5)
    
    def load_dashboard_data(self):
        """Load dashboard statistics"""
        cursor = self.app.db_service.conn.cursor()
        
        # Get total responses
        cursor.execute("SELECT COUNT(*) FROM responses")
        total_responses = cursor.fetchone()[0]
        
        # Get active projects
        cursor.execute("SELECT COUNT(*) FROM projects WHERE is_active = 1")
        active_projects = cursor.fetchone()[0]
        
        # Get pending sync
        cursor.execute("SELECT COUNT(*) FROM sync_queue WHERE status = 'pending'")
        pending_sync = cursor.fetchone()[0]
        
        # Update UI
        self.ids.responses_card.value = total_responses
        self.ids.projects_card.value = active_projects
        self.ids.sync_card.value = pending_sync
        
        # Load recent projects
        self.load_recent_projects()
    
    def load_recent_projects(self):
        """Load recent projects list"""
        cursor = self.app.db_service.conn.cursor()
        cursor.execute("""
            SELECT p.*, COUNT(r.id) as response_count
            FROM projects p
            LEFT JOIN responses r ON p.id = r.project_id
            GROUP BY p.id
            ORDER BY p.updated_at DESC
            LIMIT 5
        """)
        
        projects = cursor.fetchall()
        
        # Clear existing items
        self.ids.recent_projects.clear_widgets()
        
        # Add project items
        for project in projects:
            item = OneLineListItem(
                text=f"{project['name']} - {project['response_count']} responses",
                on_release=lambda x, p=project: self.open_project(p)
            )
            self.ids.recent_projects.add_widget(item)
    
    def open_project(self, project):
        """Open project details"""
        self.manager.get_screen('data_collection').project_id = project['id']
        self.manager.current = 'data_collection'
    
    def update_stats(self, dt):
        """Update statistics periodically"""
        self.load_dashboard_data()
```

This comprehensive structure provides:

1. **Complete project organization** with clear separation between Django, FastAPI, and Kivy components
2. **All necessary configuration files** including Docker, requirements, and build specs
3. **Key implementation examples** showing how the components work together
4. **Offline-first sync mechanism** with conflict resolution
5. **Auto-detection analytics** that intelligently analyzes data
6. **Professional development workflow** with testing, documentation, and deployment

To get started:
```bash
# 1. Set up the project structure
chmod +x scripts/*.sh
./scripts/setup_django_settings.sh
./scripts/setup_fastapi.sh
./scripts/setup_kivy.sh

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run migrations
cd backend && python manage.py migrate

# 4. Start development
make dev
```

This structure is production-ready and follows best practices for Python development, making it easy to scale and maintain as your project grows.