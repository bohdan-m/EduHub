from django.contrib.auth.models import AbstractUser
from django.db import models

CHOICES = [
    ('student','student'),
    ('teacher', 'teacher')
]

class User(AbstractUser):
    role = models.CharField(max_length=10, choices=CHOICES, null=False, blank=False)

    def __srt__(self):
        return f"{self.username}, {self.role}"
