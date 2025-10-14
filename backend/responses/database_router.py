"""
Database Router Service for Multi-Source Response Distribution

This service handles routing responses to multiple databases based on question sources.
When a response is submitted, it will be sent to:
- Owner database (if 'owner' in question_sources)
- Partner databases (for each partner in question_sources)
"""

import requests
import logging
from typing import List, Dict, Any
from django.conf import settings
import json
from datetime import datetime

logger = logging.getLogger(__name__)


class DatabaseRouter:
    """
    Routes responses to multiple database endpoints based on question sources.
    """

    def __init__(self, timeout: int = 30):
        """
        Initialize the database router.

        Args:
            timeout: Request timeout in seconds (default: 30)
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'FSVC-DatabaseRouter/1.0'
        })

    def route_response(self, response_instance) -> Dict[str, Any]:
        """
        Route a response to all target databases based on question sources.

        Args:
            response_instance: Response model instance

        Returns:
            Dict with routing results for each endpoint
        """
        question = response_instance.question

        # Get all target database endpoints
        endpoints = question.get_database_endpoints()

        if not endpoints:
            logger.warning(
                f"No database endpoints found for question {question.id} "
                f"with sources: {question.question_sources}"
            )
            return {
                'success': False,
                'message': 'No database endpoints configured',
                'results': []
            }

        # Prepare response data payload
        payload = self._prepare_payload(response_instance)

        # Send to each endpoint
        results = []
        success_count = 0

        for endpoint_config in endpoints:
            result = self._send_to_endpoint(
                endpoint_config=endpoint_config,
                payload=payload,
                response_id=str(response_instance.response_id)
            )
            results.append(result)

            if result['success']:
                success_count += 1

        return {
            'success': success_count > 0,
            'total_endpoints': len(endpoints),
            'successful_submissions': success_count,
            'failed_submissions': len(endpoints) - success_count,
            'results': results
        }

    def _prepare_payload(self, response_instance) -> Dict[str, Any]:
        """
        Prepare response data payload for external database submission.

        Args:
            response_instance: Response model instance

        Returns:
            Dict containing formatted response data
        """
        # Build comprehensive payload
        payload = {
            # Core response data
            'response_id': str(response_instance.response_id),
            'response_value': response_instance.response_value,
            'structured_data': response_instance.structured_data,

            # Question context
            'question': {
                'id': str(response_instance.question.id),
                'text': response_instance.question.question_text,
                'response_type': response_instance.question.response_type,
                'category': response_instance.question.category,
                'subcategory': response_instance.question.subcategory,
            },

            # Respondent context
            'respondent': {
                'id': response_instance.respondent.respondent_id,
                'type': response_instance.respondent.respondent_type,
                'commodity': response_instance.respondent.commodity,
                'country': response_instance.respondent.country,
                'name': response_instance.respondent.name,
            },

            # Question bank context (captured at response time)
            'question_bank_context': response_instance.question_bank_context,

            # Project context
            'project': {
                'id': str(response_instance.project.id),
                'name': response_instance.project.name,
            },

            # Additional data fields
            'choice_selections': response_instance.choice_selections,
            'numeric_value': float(response_instance.numeric_value) if response_instance.numeric_value else None,
            'datetime_value': response_instance.datetime_value.isoformat() if response_instance.datetime_value else None,

            # Geographic data
            'geo_data': response_instance.geo_data,
            'geo_accuracy': response_instance.geo_accuracy,
            'location_data': response_instance.location_data,

            # Media files
            'media_files': response_instance.media_files,

            # Collection metadata
            'collected_at': response_instance.collected_at.isoformat(),
            'collected_by': response_instance.collected_by.username if response_instance.collected_by else None,
            'device_info': response_instance.device_info,

            # Data quality
            'is_validated': response_instance.is_validated,
            'validation_errors': response_instance.validation_errors,
            'data_quality_score': response_instance.data_quality_score,

            # Metadata
            'response_metadata': response_instance.response_metadata,
            'response_format': response_instance.response_format,

            # Submission timestamp
            'submitted_at': datetime.utcnow().isoformat(),
        }

        return payload

    def _send_to_endpoint(
        self,
        endpoint_config: Dict[str, str],
        payload: Dict[str, Any],
        response_id: str
    ) -> Dict[str, Any]:
        """
        Send response data to a specific database endpoint.

        Args:
            endpoint_config: Dict with 'name', 'endpoint', 'api_key'
            payload: Response data payload
            response_id: Response ID for logging

        Returns:
            Dict with submission result
        """
        endpoint_name = endpoint_config.get('name', 'unknown')
        endpoint_url = endpoint_config.get('endpoint', '')
        api_key = endpoint_config.get('api_key', '')

        if not endpoint_url:
            logger.error(
                f"No endpoint URL configured for {endpoint_name} "
                f"(response {response_id})"
            )
            return {
                'endpoint_name': endpoint_name,
                'success': False,
                'error': 'No endpoint URL configured',
                'timestamp': datetime.utcnow().isoformat()
            }

        try:
            # Prepare headers with API key
            headers = self.session.headers.copy()
            if api_key:
                headers['Authorization'] = f'Bearer {api_key}'

            # Ensure endpoint URL has proper format
            if not endpoint_url.startswith(('http://', 'https://')):
                endpoint_url = f'https://{endpoint_url}'

            # Add /api/responses path if not present
            if not endpoint_url.endswith('/responses'):
                endpoint_url = f"{endpoint_url.rstrip('/')}/api/responses"

            logger.info(
                f"Sending response {response_id} to {endpoint_name} "
                f"at {endpoint_url}"
            )

            # Send POST request
            response = self.session.post(
                endpoint_url,
                json=payload,
                headers=headers,
                timeout=self.timeout
            )

            # Check response status
            if response.status_code in [200, 201]:
                logger.info(
                    f"Successfully sent response {response_id} to {endpoint_name} "
                    f"(status: {response.status_code})"
                )
                return {
                    'endpoint_name': endpoint_name,
                    'endpoint_url': endpoint_url,
                    'success': True,
                    'status_code': response.status_code,
                    'response_data': response.json() if response.content else None,
                    'timestamp': datetime.utcnow().isoformat()
                }
            else:
                error_message = f"HTTP {response.status_code}"
                try:
                    error_details = response.json()
                    error_message = f"{error_message}: {error_details}"
                except:
                    error_message = f"{error_message}: {response.text[:200]}"

                logger.error(
                    f"Failed to send response {response_id} to {endpoint_name}: "
                    f"{error_message}"
                )
                return {
                    'endpoint_name': endpoint_name,
                    'endpoint_url': endpoint_url,
                    'success': False,
                    'status_code': response.status_code,
                    'error': error_message,
                    'timestamp': datetime.utcnow().isoformat()
                }

        except requests.exceptions.Timeout:
            error_msg = f"Request timeout after {self.timeout} seconds"
            logger.error(
                f"Timeout sending response {response_id} to {endpoint_name}: "
                f"{error_msg}"
            )
            return {
                'endpoint_name': endpoint_name,
                'endpoint_url': endpoint_url,
                'success': False,
                'error': error_msg,
                'timestamp': datetime.utcnow().isoformat()
            }

        except requests.exceptions.ConnectionError as e:
            error_msg = f"Connection error: {str(e)}"
            logger.error(
                f"Connection error sending response {response_id} to {endpoint_name}: "
                f"{error_msg}"
            )
            return {
                'endpoint_name': endpoint_name,
                'endpoint_url': endpoint_url,
                'success': False,
                'error': error_msg,
                'timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.exception(
                f"Error sending response {response_id} to {endpoint_name}: "
                f"{error_msg}"
            )
            return {
                'endpoint_name': endpoint_name,
                'endpoint_url': endpoint_url,
                'success': False,
                'error': error_msg,
                'timestamp': datetime.utcnow().isoformat()
            }

    def __del__(self):
        """Clean up session on deletion"""
        if hasattr(self, 'session'):
            self.session.close()


# Singleton instance
_router_instance = None


def get_database_router() -> DatabaseRouter:
    """
    Get or create singleton DatabaseRouter instance.

    Returns:
        DatabaseRouter instance
    """
    global _router_instance
    if _router_instance is None:
        _router_instance = DatabaseRouter()
    return _router_instance
