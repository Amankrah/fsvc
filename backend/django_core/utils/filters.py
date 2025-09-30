import django_filters
from django.db.models import Q
from datetime import datetime
from projects.models import Project
from forms.models import Question
from responses.models import Response
from django_filters import rest_framework as filters
from rest_framework import filters as drf_filters

class BaseFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='search_filter')
    created_after = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    updated_after = django_filters.DateTimeFilter(field_name='updated_at', lookup_expr='gte')
    updated_before = django_filters.DateTimeFilter(field_name='updated_at', lookup_expr='lte')

    def search_filter(self, queryset, name, value):
        return queryset.filter(
            Q(name__icontains=value) |
            Q(description__icontains=value)
        )

class ProjectFilter(BaseFilter):
    class Meta:
        model = Project
        fields = {
            'name': ['exact', 'icontains'],
            'created_by': ['exact'],
            'sync_status': ['exact'],
        }

class QuestionFilter(filters.FilterSet):
    """Custom filter for Question model"""
    
    # Text search filters
    question_text = filters.CharFilter(lookup_expr='icontains')
    project_name = filters.CharFilter(field_name='project__name', lookup_expr='icontains')
    
    # Exact match filters
    project_id = filters.UUIDFilter(field_name='project__id')
    response_type = filters.ChoiceFilter(choices=[
        ('numeric', 'Numeric'),
        ('text', 'Text'),
        ('long_text', 'Long Text'),
        ('choice', 'Multiple Choice'),
        ('scale', 'Scale'),
        ('date', 'Date'),
        ('location', 'Location'),
    ])
    is_required = filters.BooleanFilter()
    allow_multiple = filters.BooleanFilter()
    
    # Range filters
    order_index_min = filters.NumberFilter(field_name='order_index', lookup_expr='gte')
    order_index_max = filters.NumberFilter(field_name='order_index', lookup_expr='lte')
    
    # Date filters
    created_after = filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = Question
        fields = {
            'response_type': ['exact'],
            'is_required': ['exact'],
            'allow_multiple': ['exact'],
            'order_index': ['exact', 'gte', 'lte'],
            'sync_status': ['exact'],
            'created_at': ['gte', 'lte'],
        }

class ResponseFilter(BaseFilter):
    class Meta:
        model = Response
        fields = {
            'project': ['exact'],
            'question': ['exact'],
            'respondent_id': ['exact'],
            'collected_by': ['exact'],
            'sync_status': ['exact'],
        }

    def search_filter(self, queryset, name, value):
        return queryset.filter(
            Q(response_value__icontains=value) |
            Q(respondent_id__icontains=value) |
            Q(question__question_text__icontains=value)
        ) 