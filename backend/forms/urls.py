from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_modern import (
    ModernQuestionViewSet, 
    QuestionBankViewSet, 
    DynamicQuestionSessionViewSet
)

router = DefaultRouter()
router.register(r'questions', ModernQuestionViewSet, basename='questions')
router.register(r'question-bank', QuestionBankViewSet, basename='question-bank')
router.register(r'question-sessions', DynamicQuestionSessionViewSet, basename='question-sessions')

urlpatterns = [
    path('', include(router.urls)),
] 