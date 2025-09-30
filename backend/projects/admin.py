from django.contrib import admin
from .models import Project

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'created_by', 'get_question_count', 'get_response_count', 'created_at', 'sync_status', 'cloud_id']
    search_fields = ['name', 'description', 'created_by__email', 'created_by__username']
    list_filter = ['sync_status', 'created_at', 'updated_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'cloud_id']
    ordering = ['-created_at']
    list_select_related = ['created_by']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'name', 'description', 'created_by')
        }),
        ('Configuration', {
            'fields': ('settings', 'metadata'),
            'classes': ('collapse',),
        }),
        ('Sync Information', {
            'fields': ('sync_status', 'cloud_id'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    def get_question_count(self, obj):
        """Display the number of questions in this project"""
        return obj.questions.count()
    get_question_count.short_description = 'Questions'
    
    def get_response_count(self, obj):
        """Display the number of responses in this project"""
        return obj.responses.count()
    get_response_count.short_description = 'Responses'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('created_by')
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "created_by":
            kwargs["queryset"] = db_field.related_model.objects.all().order_by('email')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
