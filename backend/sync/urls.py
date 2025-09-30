from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SyncQueueViewSet

router = DefaultRouter()
router.register(r'sync-queue', SyncQueueViewSet, basename='sync-queue')

urlpatterns = [
    path('', include(router.urls)),
] 