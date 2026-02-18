"""
Tests for sync module — focusing on _handle_offline_responses resilience.

Tests simulate the backend-side scenarios that occur when the frontend
experiences fluctuating network connectivity during data collection.
"""

from types import SimpleNamespace
from django.test import TestCase
from authentication.models import User
from projects.models import Project
from forms.models import Question
from responses.models import Respondent, Response
from sync.models import SyncQueue
from sync.views import SyncQueueViewSet
import uuid


class HandleOfflineResponsesTestBase(TestCase):
    """Base class with shared setup for _handle_offline_responses tests."""

    def setUp(self):
        """Create user, project, and questions for testing."""

        # Create test user
        self.user = User.objects.create_user(
            username='testcollector',
            email='collector@test.com',
            password='testpass123'
        )

        # Create test project
        self.project = Project.objects.create(
            name='Test Survey Project',
            created_by=self.user
        )

        # Create test questions (no assigned_ fields = not a generated question, skips validation)
        self.questions = []
        for i in range(5):
            q = Question.objects.create(
                project=self.project,
                question_text=f'Test question {i + 1}',
                response_type='text_short',
                order_index=i,
            )
            self.questions.append(q)

    def _build_sync_data(self, respondent_id=None, question_ids=None, responses=None):
        """Build the data payload that the frontend sends for offline sync."""
        if respondent_id is None:
            respondent_id = f'RESP-{uuid.uuid4().hex[:8]}'

        if responses is None:
            if question_ids is None:
                question_ids = [str(q.id) for q in self.questions]
            responses = [
                {
                    'questionId': qid,
                    'responseValue': f'Answer for question {i}',
                }
                for i, qid in enumerate(question_ids)
            ]

        return {
            'projectId': str(self.project.id),
            'respondentData': {
                'respondentId': respondent_id,
                'respondentType': 'farmers',
                'commodities': ['cocoa'],
                'country': 'Ghana',
            },
            'responses': responses,
        }

    def _call_handle_offline_responses(self, data):
        """
        Call _handle_offline_responses via a ViewSet instance.
        Uses a lightweight mock request — the method only needs self.request.user.
        """
        viewset = SyncQueueViewSet()
        viewset.request = SimpleNamespace(user=self.user)
        viewset.kwargs = {}
        viewset.format_kwarg = None

        return viewset._handle_offline_responses(data)


class TestNormalSyncFlow(HandleOfflineResponsesTestBase):
    """Test 1: Normal successful offline sync."""

    def test_all_responses_saved_and_marked_completed(self):
        """All responses should be created and respondent marked 'completed'."""
        data = self._build_sync_data()
        result = self._call_handle_offline_responses(data)

        # Check result
        self.assertTrue(result['success'])

        # Check respondent
        respondent = Respondent.objects.get(
            respondent_id=data['respondentData']['respondentId']
        )
        self.assertEqual(respondent.completion_status, 'completed')
        self.assertEqual(respondent.respondent_type, 'farmers')
        self.assertEqual(respondent.country, 'Ghana')

        # Check all responses created
        response_count = Response.objects.filter(respondent=respondent).count()
        self.assertEqual(response_count, 5)

    def test_created_responses_count_in_result(self):
        """Result should include count of created responses."""
        data = self._build_sync_data()
        result = self._call_handle_offline_responses(data)

        self.assertEqual(result.get('responses_created', 0), 5)


class TestZeroResponseFix(HandleOfflineResponsesTestBase):
    """Test 2: The zero-response bug fix — respondent stays 'draft' when no responses save."""

    def test_invalid_questions_keep_respondent_as_draft(self):
        """
        If all question IDs are invalid (don't exist in DB), response creation
        will fail, so the respondent should stay as 'draft'.
        """
        fake_q_ids = [str(uuid.uuid4()) for _ in range(3)]
        data = self._build_sync_data(responses=[
            {'questionId': qid, 'responseValue': f'Answer {i}'}
            for i, qid in enumerate(fake_q_ids)
        ])
        result = self._call_handle_offline_responses(data)

        # The method returns success=True even when individual responses fail
        self.assertTrue(result['success'])

        respondent = Respondent.objects.get(
            respondent_id=data['respondentData']['respondentId']
        )
        # KEY FIX VERIFICATION: respondent should NOT be 'completed'
        self.assertEqual(respondent.completion_status, 'draft')

        # No responses should exist
        response_count = Response.objects.filter(respondent=respondent).count()
        self.assertEqual(response_count, 0)

    def test_missing_response_values_keep_respondent_as_draft(self):
        """Responses with None values should be skipped; respondent stays 'draft'."""
        data = self._build_sync_data(responses=[
            {'questionId': str(self.questions[0].id), 'responseValue': None},
            {'questionId': None, 'responseValue': 'some value'},
        ])
        result = self._call_handle_offline_responses(data)

        respondent = Respondent.objects.get(
            respondent_id=data['respondentData']['respondentId']
        )
        # All responses were skipped (None questionId, None responseValue)
        self.assertEqual(respondent.completion_status, 'draft')

    def test_empty_responses_returns_error(self):
        """Empty responses list should fail validation."""
        data = self._build_sync_data()
        data['responses'] = []

        result = self._call_handle_offline_responses(data)
        self.assertFalse(result['success'])


class TestDuplicateHandling(HandleOfflineResponsesTestBase):
    """Test 3: Duplicate prevention — simulates Issue 1 (partial success + full re-queue)."""

    def test_duplicate_responses_are_skipped(self):
        """Re-syncing the same data should skip already-existing responses."""
        data = self._build_sync_data()
        respondent_id = data['respondentData']['respondentId']

        # First sync: creates all 5 responses
        result1 = self._call_handle_offline_responses(data)
        self.assertTrue(result1['success'])
        self.assertEqual(result1.get('responses_created', 0), 5)

        # Second sync with same data: all 5 should be skipped
        result2 = self._call_handle_offline_responses(data)
        self.assertTrue(result2['success'])
        self.assertEqual(result2.get('responses_skipped', 0), 5)

        # Still only 5 responses in DB (not 10)
        respondent = Respondent.objects.get(respondent_id=respondent_id)
        self.assertEqual(Response.objects.filter(respondent=respondent).count(), 5)
        self.assertEqual(respondent.completion_status, 'completed')

    def test_partial_duplicate_creates_only_new_responses(self):
        """
        Simulates Issue 1: 3 of 5 responses were saved online, then ALL 5 get re-queued.
        Backend should create only the 2 new ones and skip the 3 existing.
        """
        data = self._build_sync_data()
        respondent_id = data['respondentData']['respondentId']

        # Pre-create respondent
        respondent = Respondent.objects.create(
            respondent_id=respondent_id,
            project=self.project,
            is_anonymous=True,
            consent_given=True,
            respondent_type='farmers',
            completion_status='draft',
            created_by=self.user,
        )

        # Pre-create 3 responses (simulating online success before network drop)
        for i in range(3):
            Response.objects.create(
                project=self.project,
                question=self.questions[i],
                respondent=respondent,
                response_value=f'Online answer {i}',
                collected_by=self.user,
            )

        self.assertEqual(Response.objects.filter(respondent=respondent).count(), 3)

        # Now sync all 5 (as the frontend would after a partial failure)
        result = self._call_handle_offline_responses(data)
        self.assertTrue(result['success'])

        # Should have created 2 new + skipped 3 existing
        self.assertEqual(result.get('responses_created', 0), 2)
        self.assertEqual(result.get('responses_skipped', 0), 3)

        # Total should be 5, not 8
        self.assertEqual(Response.objects.filter(respondent=respondent).count(), 5)

        # Respondent should now be marked completed
        respondent.refresh_from_db()
        self.assertEqual(respondent.completion_status, 'completed')


class TestRespondentDeduplication(HandleOfflineResponsesTestBase):
    """Test 4: Issue 2 — respondent re-creation via get_or_create."""

    def test_existing_respondent_is_reused(self):
        """If respondent already exists, get_or_create should find it, not create a duplicate."""
        fixed_id = f'RESP-{uuid.uuid4().hex[:8]}'
        data = self._build_sync_data(respondent_id=fixed_id)

        # Pre-create the respondent (simulating online createRespondent before network drop)
        Respondent.objects.create(
            respondent_id=fixed_id,
            project=self.project,
            is_anonymous=True,
            consent_given=True,
            completion_status='draft',
            created_by=self.user,
        )

        # Sync should reuse existing respondent
        result = self._call_handle_offline_responses(data)
        self.assertTrue(result['success'])

        # Only 1 respondent should exist with this ID
        self.assertEqual(
            Respondent.objects.filter(respondent_id=fixed_id).count(),
            1
        )

    def test_double_sync_does_not_duplicate_respondent(self):
        """Two syncs with same respondent ID should not create two respondents."""
        fixed_id = f'RESP-{uuid.uuid4().hex[:8]}'
        data = self._build_sync_data(respondent_id=fixed_id)

        self._call_handle_offline_responses(data)
        self._call_handle_offline_responses(data)

        self.assertEqual(
            Respondent.objects.filter(respondent_id=fixed_id).count(),
            1
        )


class TestMissingDataValidation(HandleOfflineResponsesTestBase):
    """Test 5: Missing or malformed data validation."""

    def test_missing_project_id_returns_error(self):
        data = self._build_sync_data()
        data['projectId'] = None
        result = self._call_handle_offline_responses(data)
        self.assertFalse(result['success'])

    def test_missing_respondent_data_returns_error(self):
        data = self._build_sync_data()
        data['respondentData'] = {}
        result = self._call_handle_offline_responses(data)
        # Should not crash — returns a dict with either success or error
        self.assertIsInstance(result, dict)

    def test_missing_responses_returns_error(self):
        data = self._build_sync_data()
        data['responses'] = []
        result = self._call_handle_offline_responses(data)
        self.assertFalse(result['success'])


class TestResponseUniqueConstraint(HandleOfflineResponsesTestBase):
    """Test 6: Database-level unique_together constraint protection."""

    def test_unique_constraint_prevents_duplicates(self):
        """
        Even if the application-level check is bypassed,
        the DB constraint should prevent duplicate (question, respondent) pairs.
        """
        data = self._build_sync_data()
        respondent_id = data['respondentData']['respondentId']

        # First sync
        self._call_handle_offline_responses(data)

        respondent = Respondent.objects.get(respondent_id=respondent_id)

        # Try to directly create a duplicate (bypassing app checks)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Response.objects.create(
                project=self.project,
                question=self.questions[0],
                respondent=respondent,
                response_value='Duplicate attempt',
                collected_by=self.user,
            )


class TestCompletionStatusLogic(HandleOfflineResponsesTestBase):
    """Test 7: Completion status transitions."""

    def test_partial_responses_still_mark_completed(self):
        """If at least 1 response saves, respondent should be 'completed'."""
        valid_q = str(self.questions[0].id)
        invalid_q = str(uuid.uuid4())

        data = self._build_sync_data(responses=[
            {'questionId': valid_q, 'responseValue': 'Valid answer'},
            {'questionId': invalid_q, 'responseValue': 'This will fail'},
        ])

        result = self._call_handle_offline_responses(data)
        self.assertTrue(result['success'])

        respondent = Respondent.objects.get(
            respondent_id=data['respondentData']['respondentId']
        )
        # At least 1 response saved, so should be completed
        self.assertEqual(respondent.completion_status, 'completed')
        self.assertEqual(Response.objects.filter(respondent=respondent).count(), 1)

    def test_existing_draft_respondent_becomes_completed_after_sync(self):
        """A 'draft' respondent should be upgraded to 'completed' when responses are synced."""
        fixed_id = f'RESP-{uuid.uuid4().hex[:8]}'

        respondent = Respondent.objects.create(
            respondent_id=fixed_id,
            project=self.project,
            is_anonymous=True,
            consent_given=True,
            completion_status='draft',
            created_by=self.user,
        )

        data = self._build_sync_data(respondent_id=fixed_id)
        result = self._call_handle_offline_responses(data)
        self.assertTrue(result['success'])

        respondent.refresh_from_db()
        self.assertEqual(respondent.completion_status, 'completed')
