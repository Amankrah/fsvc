from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_modern import ModernQuestionViewSet

router = DefaultRouter()
router.register(r'questions', ModernQuestionViewSet, basename='questions')

urlpatterns = [
    path('', include(router.urls)),
] 