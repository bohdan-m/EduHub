from django.test import TestCase
from rest_framework.test import APIRequestFactory

from courses.permissions import IsTeacher
from users.models import User


class IsTeacherPermissionCoverageTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = IsTeacher()

    def test_denies_anonymous_user(self):
        request = self.factory.get("/courses/create/")
        request.user = type("AnonymousUserStub", (), {"is_authenticated": False, "role": None})()

        self.assertFalse(self.permission.has_permission(request, None))

    def test_denies_authenticated_non_teacher(self):
        request = self.factory.get("/courses/create/")
        request.user = User.objects.create_user(
            username="student",
            email="student@example.com",
            role="student",
            password="student-demo-123",
        )

        self.assertFalse(self.permission.has_permission(request, None))
