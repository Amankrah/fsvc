"""
Tests for API views.
"""

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

class APITestCase(TestCase):
    """
    Base test case for API tests.
    """
    
    def setUp(self):
        """
        Set up test client and other test variables.
        """
        self.client = APIClient()
        # Add any common setup here 