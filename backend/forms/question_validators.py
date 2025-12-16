"""
Strict validation utilities for question filtering.
Ensures that questions are NEVER loaded or generated without ALL 3 mandatory filters.
"""
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)


def validate_question_filters(respondent_type, commodity, country, raise_exception=True):
    """
    CRITICAL SECURITY: Validate that ALL 3 mandatory filters are present and non-empty.

    This prevents:
    1. Loading questions for wrong respondent types
    2. Data leakage across commodities
    3. Cross-country data mixing
    4. Incomplete question generation

    Args:
        respondent_type: The respondent type (e.g., 'farmer', 'chief')
        commodity: The commodity (e.g., 'cocoa', 'coffee')
        country: The country (e.g., 'Ghana', 'Kenya')
        raise_exception: If True, raises ValidationError. If False, returns error response.

    Returns:
        dict: {'valid': True} if valid, or error details if invalid

    Raises:
        ValidationError: If raise_exception=True and validation fails
    """
    errors = []

    # Check respondent_type
    if not respondent_type or not str(respondent_type).strip():
        errors.append({
            'field': 'respondent_type',
            'message': 'Respondent type is required and cannot be empty'
        })

    # Check commodity
    if not commodity or not str(commodity).strip():
        errors.append({
            'field': 'commodity',
            'message': 'Commodity is required and cannot be empty'
        })

    # Check country
    if not country or not str(country).strip():
        errors.append({
            'field': 'country',
            'message': 'Country is required and cannot be empty'
        })

    if errors:
        error_message = (
            "CRITICAL VALIDATION FAILED: All 3 filters (respondent_type, commodity, country) "
            "are mandatory for question operations. This is a security requirement to prevent "
            "data leakage and ensure data integrity."
        )

        logger.error(f"{error_message} Errors: {errors}")

        if raise_exception:
            raise ValidationError({
                'error': error_message,
                'missing_filters': errors,
                'required_filters': ['respondent_type', 'commodity', 'country']
            })
        else:
            return {
                'valid': False,
                'error': error_message,
                'missing_filters': errors,
                'required_filters': ['respondent_type', 'commodity', 'country']
            }

    # Log successful validation
    logger.info(
        f"✓ Filter validation passed: respondent_type='{respondent_type}', "
        f"commodity='{commodity}', country='{country}'"
    )

    return {'valid': True}


def require_all_filters(view_func):
    """
    Decorator to enforce 3 mandatory filters on viewset actions.

    Usage:
        @require_all_filters
        @action(detail=False, methods=['get'])
        def get_questions(self, request):
            # All 3 filters are guaranteed to be present here
            pass
    """
    def wrapper(self, request, *args, **kwargs):
        # Extract filters from query params or request data
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            respondent_type = request.query_params.get('assigned_respondent_type')
            commodity = request.query_params.get('assigned_commodity')
            country = request.query_params.get('assigned_country')
        else:
            respondent_type = request.data.get('respondent_type') or request.data.get('assigned_respondent_type')
            commodity = request.data.get('commodity') or request.data.get('assigned_commodity')
            country = request.data.get('country') or request.data.get('assigned_country')

        # Validate filters
        validation_result = validate_question_filters(
            respondent_type,
            commodity,
            country,
            raise_exception=False
        )

        if not validation_result.get('valid'):
            return Response(validation_result, status=status.HTTP_400_BAD_REQUEST)

        # If valid, proceed with the original view
        return view_func(self, request, *args, **kwargs)

    return wrapper


def validate_question_bundle(project, respondent_type, commodity, country):
    """
    Validate that a question bundle (combination of filters) is valid and has questions.

    Args:
        project: Project instance
        respondent_type: The respondent type
        commodity: The commodity
        country: The country

    Returns:
        dict: Validation result with question count
    """
    from forms.models import Question
    from django.db.models import Q

    # First validate filters
    validate_question_filters(respondent_type, commodity, country, raise_exception=True)

    # Check if questions exist for this bundle
    questions = Question.objects.filter(
        project=project,
        assigned_respondent_type=respondent_type,
        assigned_commodity=commodity,
        assigned_country=country
    ).exclude(
        Q(assigned_respondent_type__isnull=True) |
        Q(assigned_respondent_type='') |
        Q(assigned_commodity__isnull=True) |
        Q(assigned_commodity='') |
        Q(assigned_country__isnull=True) |
        Q(assigned_country='')
    )

    count = questions.count()

    return {
        'valid': True,
        'has_questions': count > 0,
        'question_count': count,
        'bundle': {
            'respondent_type': respondent_type,
            'commodity': commodity,
            'country': country
        }
    }
