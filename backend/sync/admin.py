from django.contrib import admin
from .models import SyncQueue

@admin.register(SyncQueue)
class SyncQueueAdmin(admin.ModelAdmin):
    list_display = ['id', 'table_name', 'record_id', 'operation', 'status', 'priority', 'attempts', 'created_by', 'created_at', 'last_attempt']
    list_filter = ['status', 'operation', 'table_name', 'priority', 'created_at', 'created_by']
    search_fields = ['table_name', 'record_id', 'operation', 'created_by__email', 'created_by__username']
    readonly_fields = ['id', 'created_at', 'last_attempt', 'attempts']
    ordering = ['-priority', '-created_at']
    list_select_related = ['created_by']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'table_name', 'record_id', 'operation', 'priority')
        }),
        ('Sync Data', {
            'fields': ('data',),
            'classes': ('collapse',),
        }),
        ('Status Information', {
            'fields': ('status', 'attempts', 'created_at', 'last_attempt', 'error_message')
        }),
        ('User Information', {
            'fields': ('created_by',),
            'classes': ('collapse',),
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('created_by')
    
    def has_add_permission(self, request):
        # SyncQueue items are typically created programmatically
        return False
