from django.test import TestCase
from rest_framework.test import APIRequestFactory
from users.models import User
from courses.permissions import IsTeacher

class IsTeacherPermissionTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = IsTeacher()

        self.teacher_user = User.objects.create_user(
            username="teacher",
            email="teacher@email.com",
            role="teacher",
            password="1234"
        )

        self.student_user = User.objects.create_user(
            username="student",
            email="student@email.com",
            role="student",
            password="1234"
        )

    def test_teacher_has_permission(self):
        request = self.factory.get("/fake-url/")
        request.user = self.teacher_user
        self.assertTrue(self.permission.has_permission(request, None))

    def test_student_has_no_permission(self):
        request = self.factory.get("/fake-url/")
        request.user = self.student_user
        self.assertFalse(self.permission.has_permission(request, None))
