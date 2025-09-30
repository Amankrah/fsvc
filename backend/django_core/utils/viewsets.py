from rest_framework import viewsets
from .pagination import CustomPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

class BaseModelViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet that includes pagination, filtering, and search capabilities.
    """
    pagination_class = CustomPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = []  # To be overridden by child classes
    search_fields = []     # To be overridden by child classes
    ordering_fields = []   # To be overridden by child classes
    ordering = ['-created_at']  # Default ordering 