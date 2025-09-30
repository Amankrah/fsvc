from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ResponseViewSet, RespondentViewSet

router = DefaultRouter()
router.register(r'responses', ResponseViewSet, basename='responses')
router.register(r'respondents', RespondentViewSet, basename='respondents')

urlpatterns = [
    path('', include(router.urls)),
] 