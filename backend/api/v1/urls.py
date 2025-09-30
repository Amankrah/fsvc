"""
URL configuration for API v1.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from . import views
from projects.views import ProjectViewSet
from sync.views import SyncQueueViewSet
from analytics_results.views import AnalyticsResultViewSet
from forms.views_modern import ModernQuestionViewSet as QuestionViewSet
from responses.views import ResponseViewSet, RespondentViewSet

# Create a router and register the ViewSets
router = DefaultRouter()
router.register(r'projects', ProjectViewSet, basename='projects')
router.register(r'sync-queue', SyncQueueViewSet, basename='sync-queue')
router.register(r'analytics-results', AnalyticsResultViewSet, basename='analytics-results')
router.register(r'questions', QuestionViewSet, basename='questions')
router.register(r'responses', ResponseViewSet, basename='responses')
router.register(r'respondents', RespondentViewSet, basename='respondents')

# Create nested routers for project-related resources
projects_router = routers.NestedDefaultRouter(router, r'projects', lookup='project')
projects_router.register(r'questions', views.QuestionViewSet, basename='project-questions')
projects_router.register(r'responses', ResponseViewSet, basename='project-responses')
projects_router.register(r'analytics', AnalyticsResultViewSet, basename='project-analytics')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(projects_router.urls)),
    # Dashboard endpoints
    path('dashboard-stats/', views.dashboard_stats, name='dashboard-stats'),
    path('activity-stream/', views.activity_stream, name='activity-stream'),
    path('dashboard/', views.dashboard_combined, name='dashboard-combined'),
    # Authentication endpoints
    path('auth/', include('authentication.urls')),
] 