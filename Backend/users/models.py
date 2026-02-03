from django.contrib.auth.models import AbstractUser
from django.db import models

CHOICES = [
    ('student','student'),
    ('teacher', 'teacher')
]

class User(AbstractUser):
    role = models.CharField(max_length=10, choices=CHOICES, null=False, blank=False)

    # Avoid reverse accessor clash with auth.User when AUTH_USER_MODEL is set
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='users_user_set',
        blank=True,
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='users_user_set',
        blank=True,
    )

    def __str__(self):
        return f"{self.username}, {self.role}"
