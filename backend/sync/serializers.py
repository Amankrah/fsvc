from rest_framework import serializers
from .models import SyncQueue
from authentication.serializers import UserSerializer

class SyncQueueSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    
    class Meta:
        model = SyncQueue
        fields = [
            'id', 'table_name', 'record_id', 'operation', 
            'data', 'created_by', 'created_by_details', 'created_at', 
            'attempts', 'last_attempt', 'status', 'error_message', 'priority'
        ]
        read_only_fields = ['id', 'created_at', 'attempts', 'last_attempt', 'created_by']
        
    def validate_priority(self, value):
        """Ensure priority is within reasonable bounds"""
        if value < 0 or value > 100:
            raise serializers.ValidationError("Priority must be between 0 and 100.")
        return value
    
    def validate_table_name(self, value):
        """Validate table name"""
        allowed_tables = ['projects', 'questions', 'responses', 'analytics_results']
        if value not in allowed_tables:
            raise serializers.ValidationError(f"Table name must be one of: {', '.join(allowed_tables)}")
        return value
    
    def validate_operation(self, value):
        """Validate operation type"""
        allowed_operations = ['create', 'update', 'delete']
        if value not in allowed_operations:
            raise serializers.ValidationError(f"Operation must be one of: {', '.join(allowed_operations)}")
        return value 