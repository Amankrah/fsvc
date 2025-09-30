from django.contrib import admin
from .models import Response, Respondent

@admin.register(Respondent)
class RespondentAdmin(admin.ModelAdmin):
    list_display = [
        'respondent_id', 'project', 'name', 'email', 'is_anonymous', 
        'consent_given', 'created_at', 'last_response_at', 'response_count'
    ]
    list_filter = [
        'project', 'is_anonymous', 'consent_given', 'created_at', 'sync_status'
    ]
    search_fields = ['respondent_id', 'name', 'email', 'phone']
    readonly_fields = ['id', 'created_at', 'last_response_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('respondent_id', 'project', 'created_by')
        }),
        ('Personal Details', {
            'fields': ('name', 'email', 'phone', 'is_anonymous'),
            'classes': ('collapse',)
        }),
        ('Demographics & Metadata', {
            'fields': ('demographics', 'location_data'),
            'classes': ('collapse',)
        }),
        ('Consent & Tracking', {
            'fields': ('consent_given', 'sync_status'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'last_response_at'),
            'classes': ('collapse',)
        }),
    )
    
    def response_count(self, obj):
        """Display response count"""
        return obj.get_response_count()
    response_count.short_description = 'Responses'
    
    def get_queryset(self, request):
        """Optimize queryset with select_related"""
        return super().get_queryset(request).select_related('project', 'created_by')

@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = [
        'response_id', 'project', 'question_text_short', 'respondent_id_display', 
        'response_value_short', 'is_validated', 'data_quality_score', 
        'collected_at', 'sync_status'
    ]
    list_filter = [
        'project', 'question__response_type', 'is_validated', 'sync_status', 
        'collected_at', 'collected_by'
    ]
    search_fields = [
        'respondent__respondent_id', 'respondent__name', 'question__question_text', 
        'response_value'
    ]
    readonly_fields = [
        'response_id', 'collected_at', 'synced_at', 'is_validated', 
        'validation_errors', 'data_quality_score'
    ]
    
    fieldsets = (
        ('Response Information', {
            'fields': ('response_id', 'project', 'question', 'respondent')
        }),
        ('Response Data', {
            'fields': ('response_value', 'response_metadata')
        }),
        ('Collection Details', {
            'fields': ('collected_by', 'collected_at'),
            'classes': ('collapse',)
        }),
        ('Location & Device', {
            'fields': ('location_data', 'device_info'),
            'classes': ('collapse',)
        }),
        ('Data Quality', {
            'fields': ('is_validated', 'validation_errors', 'data_quality_score'),
            'classes': ('collapse',)
        }),
        ('Sync Status', {
            'fields': ('sync_status', 'synced_at'),
            'classes': ('collapse',)
        }),
    )
    
    def question_text_short(self, obj):
        """Display shortened question text"""
        return obj.question.question_text[:50] + "..." if len(obj.question.question_text) > 50 else obj.question.question_text
    question_text_short.short_description = 'Question'
    
    def respondent_id_display(self, obj):
        """Display respondent ID"""
        return obj.respondent.respondent_id
    respondent_id_display.short_description = 'Respondent'
    
    def response_value_short(self, obj):
        """Display shortened response value"""
        if not obj.response_value:
            return "-"
        return obj.response_value[:30] + "..." if len(obj.response_value) > 30 else obj.response_value
    response_value_short.short_description = 'Response'
    
    def get_queryset(self, request):
        """Optimize queryset with select_related and prefetch_related"""
        return super().get_queryset(request).select_related(
            'project', 'question', 'respondent', 'collected_by'
        )
    
    actions = ['validate_responses', 'recalculate_quality_scores']
    
    def validate_responses(self, request, queryset):
        """Admin action to validate selected responses"""
        updated = 0
        for response in queryset:
            response.validate_response()
            response.save(update_fields=['is_validated', 'validation_errors'])
            updated += 1
        
        self.message_user(
            request, 
            f"Successfully validated {updated} responses."
        )
    validate_responses.short_description = "Validate selected responses"
    
    def recalculate_quality_scores(self, request, queryset):
        """Admin action to recalculate quality scores for selected responses"""
        updated = 0
        for response in queryset:
            response.calculate_quality_score()
            response.save(update_fields=['data_quality_score'])
            updated += 1
        
        self.message_user(
            request, 
            f"Successfully recalculated quality scores for {updated} responses."
        )
    recalculate_quality_scores.short_description = "Recalculate quality scores"
