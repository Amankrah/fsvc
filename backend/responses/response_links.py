"""
Response Link Models
Enables shareable questionnaire links for web-based responses
"""

from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid
import secrets
from datetime import timedelta
from projects.models import Project
from authentication.models import User


class ResponseLinkManager(models.Manager):
    """Custom manager for ResponseLink"""

    def active(self):
        """Get all active links"""
        return self.filter(
            is_active=True,
            expires_at__gt=timezone.now()
        ).exclude(
            response_count__gte=models.F('max_responses')
        )

    def expired(self):
        """Get all expired links"""
        now = timezone.now()
        return self.filter(
            models.Q(expires_at__lte=now) |
            models.Q(response_count__gte=models.F('max_responses')) |
            models.Q(is_active=False)
        )

    def create_link(self, project, created_by, **kwargs):
        """Factory method to create a new response link with defaults"""
        token = secrets.token_urlsafe(32)
        expires_at = kwargs.pop('expires_at', timezone.now() + timedelta(days=7))

        return self.create(
            token=token,
            project=project,
            created_by=created_by,
            expires_at=expires_at,
            **kwargs
        )


class ResponseLink(models.Model):
    """
    Shareable link for collecting responses without app installation
    Links can be single-use or multi-use and automatically expire
    """

    # Primary key
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # Unique shareable token
    token = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique token for the shareable URL"
    )

    # Project and user association
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='response_links',
        help_text="Project this link belongs to"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='created_response_links',
        help_text="User who created this link"
    )

    # Question configuration
    question_set = models.JSONField(
        default=list,
        help_text="List of question IDs to include in this link's form"
    )

    # Respondent targeting
    respondent_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Target respondent type (farmers, processors, etc.)"
    )

    commodity = models.CharField(
        max_length=200,
        blank=True,
        help_text="Target commodity (comma-separated if multiple)"
    )

    country = models.CharField(
        max_length=100,
        blank=True,
        help_text="Target country"
    )

    # Link configuration
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this link is currently active"
    )

    max_responses = models.PositiveIntegerField(
        default=1,
        help_text="Maximum number of responses allowed (0 = unlimited)"
    )

    response_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of responses submitted via this link"
    )

    expires_at = models.DateTimeField(
        help_text="When this link expires"
    )

    # Link metadata
    title = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional title for the link (e.g., 'Farmer Survey 2024')"
    )

    description = models.TextField(
        blank=True,
        help_text="Optional description shown to respondents"
    )

    custom_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional custom metadata (tags, notes, etc.)"
    )

    # Auto-expire settings
    auto_expire_after_use = models.BooleanField(
        default=True,
        help_text="Automatically expire link after first successful submission"
    )

    require_consent = models.BooleanField(
        default=True,
        help_text="Require respondents to give consent before starting"
    )

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    first_accessed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this link was first accessed"
    )

    last_accessed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this link was last accessed"
    )

    access_count = models.PositiveIntegerField(
        default=0,
        help_text="Total number of times this link was accessed"
    )

    # Custom manager
    objects = ResponseLinkManager()

    class Meta:
        db_table = 'response_links'
        verbose_name = 'Response Link'
        verbose_name_plural = 'Response Links'
        ordering = ['-created_at']

        indexes = [
            models.Index(fields=['token']),
            models.Index(fields=['project', 'is_active']),
            models.Index(fields=['created_by', 'is_active']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['-created_at']),
        ]

        constraints = [
            models.CheckConstraint(
                check=models.Q(max_responses__gte=0),
                name='max_responses_non_negative'
            ),
            models.CheckConstraint(
                check=models.Q(response_count__gte=0),
                name='response_count_non_negative'
            ),
        ]

    def __str__(self):
        status = "Active" if self.is_valid() else "Expired"
        tags = []
        if self.respondent_type:
            tags.append(self.respondent_type)
        if self.commodity:
            tags.append(self.commodity)
        if self.country:
            tags.append(self.country)
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        return f"{self.title or self.token[:8]}...{tag_str} - {status} ({self.response_count}/{self.max_responses or '∞'})"

    def clean(self):
        """Model validation"""
        super().clean()

        # Validate expiration date
        if self.expires_at and self.expires_at <= timezone.now():
            raise ValidationError({'expires_at': 'Expiration date must be in the future'})

        # Validate max_responses
        if self.max_responses > 0 and self.response_count > self.max_responses:
            raise ValidationError({
                'response_count': f'Response count cannot exceed max_responses ({self.max_responses})'
            })

    def save(self, *args, **kwargs):
        """Enhanced save with validation"""
        # Allow skipping validation if needed
        skip_validation = kwargs.pop('skip_validation', False)
        if not skip_validation:
            self.full_clean()
        super().save(*args, **kwargs)

    @property
    def is_valid(self) -> bool:
        """Check if link is currently valid and usable"""
        if not self.is_active:
            return False

        if self.expires_at <= timezone.now():
            return False

        if self.max_responses > 0 and self.response_count >= self.max_responses:
            return False

        return True

    @property
    def is_expired(self) -> bool:
        """Check if link is expired"""
        return not self.is_valid

    @property
    def is_unlimited(self) -> bool:
        """Check if link allows unlimited responses"""
        return self.max_responses == 0

    @property
    def remaining_responses(self) -> int:
        """Get number of remaining responses allowed"""
        if self.is_unlimited:
            return float('inf')
        return max(0, self.max_responses - self.response_count)

    @property
    def share_url(self) -> str:
        """Get the full shareable URL"""
        # TODO: Update with actual domain
        from django.conf import settings
        base_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        return f"{base_url}/respond/{self.token}"

    def increment_access(self, save=True):
        """Increment access count and update timestamps"""
        self.access_count += 1
        self.last_accessed_at = timezone.now()

        if not self.first_accessed_at:
            self.first_accessed_at = timezone.now()

        if save:
            self.save(update_fields=['access_count', 'last_accessed_at', 'first_accessed_at'])

    def increment_response(self, save=True):
        """Increment response count and potentially expire link"""
        self.response_count += 1

        # Auto-expire if configured
        if self.auto_expire_after_use:
            self.is_active = False

        # Auto-expire if max responses reached
        if self.max_responses > 0 and self.response_count >= self.max_responses:
            self.is_active = False

        if save:
            self.save(update_fields=['response_count', 'is_active'])

    def deactivate(self, save=True):
        """Manually deactivate the link"""
        self.is_active = False
        if save:
            self.save(update_fields=['is_active'])

    def extend_expiration(self, days=7, save=True):
        """Extend the expiration date"""
        self.expires_at = timezone.now() + timedelta(days=days)
        if save:
            self.save(update_fields=['expires_at'])

    def get_response_rate(self) -> float:
        """Calculate response rate (responses / accesses)"""
        if self.access_count == 0:
            return 0.0
        return (self.response_count / self.access_count) * 100

    def get_statistics(self) -> dict:
        """Get comprehensive statistics for this link"""
        return {
            'is_valid': self.is_valid,
            'is_expired': self.is_expired,
            'total_accesses': self.access_count,
            'total_responses': self.response_count,
            'remaining_responses': self.remaining_responses if not self.is_unlimited else 'unlimited',
            'response_rate': round(self.get_response_rate(), 2),
            'first_accessed': self.first_accessed_at,
            'last_accessed': self.last_accessed_at,
            'expires_at': self.expires_at,
            'days_until_expiration': (self.expires_at - timezone.now()).days if self.expires_at > timezone.now() else 0,
        }

    @classmethod
    def cleanup_expired_links(cls, older_than_days=30):
        """Clean up expired links older than specified days"""
        cutoff_date = timezone.now() - timedelta(days=older_than_days)
        expired_links = cls.objects.filter(
            expires_at__lt=cutoff_date,
            is_active=False
        )
        count = expired_links.count()
        expired_links.delete()
        return count
