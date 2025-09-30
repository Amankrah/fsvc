from django.contrib import admin
from .models import Question

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['id', 'project', 'question_text', 'response_type', 'order_index', 'is_required', 'created_at', 'sync_status']
    search_fields = ['question_text', 'project__name']
    list_filter = ['response_type', 'sync_status', 'is_required', 'created_at', 'project']
    readonly_fields = ['id', 'created_at']
    ordering = ['project', 'order_index']
    list_select_related = ['project']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('id', 'project', 'question_text', 'response_type')
        }),
        ('Configuration', {
            'fields': ('is_required', 'allow_multiple', 'options', 'validation_rules', 'order_index'),
        }),
        ('Sync Information', {
            'fields': ('sync_status',),
            'classes': ('collapse',),
        }),
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('project')
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "project":
            kwargs["queryset"] = db_field.related_model.objects.all().order_by('name')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
