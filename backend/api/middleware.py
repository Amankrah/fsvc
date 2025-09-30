"""
Middleware for the API application.
"""

from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
import json

class APIExceptionMiddleware(MiddlewareMixin):
    """
    Middleware to handle API exceptions and return JSON responses.
    """
    
    def process_exception(self, request, exception):
        if request.path.startswith('/api/'):
            return JsonResponse({
                'error': str(exception),
                'status': 'error'
            }, status=500)
        return None 