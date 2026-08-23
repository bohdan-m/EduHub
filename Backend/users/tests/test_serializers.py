from django.contrib.auth import get_user_model
from django.test import TestCase

from users.serializers import CustomTokenObtainPairSerializer, UserSerializer

User = get_user_model()


class UserSerializerTests(TestCase):
    def test_create_user_serializer_hashes_password_and_lowercases_email(self):
        serializer = UserSerializer(data={
            "username": "newstudent",
            "email": "Student@Example.COM",
            "password": "student-demo-123",
            "role": "student",
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertEqual(user.email, "student@example.com")
        self.assertTrue(user.check_password("student-demo-123"))

    def test_create_user_serializer_rejects_duplicate_email(self):
        User.objects.create_user(
            username="existing",
            email="existing@example.com",
            role="student",
            password="student-demo-123",
        )

        serializer = UserSerializer(data={
            "username": "newstudent",
            "email": "existing@example.com",
            "password": "student-demo-123",
            "role": "student",
        })

        self.assertFalse(serializer.is_valid())
        self.assertEqual(str(serializer.errors["email"][0]), "User with this email already exists.")

    def test_create_user_serializer_rejects_weak_password(self):
        serializer = UserSerializer(data={
            "username": "weakpass",
            "email": "weak@example.com",
            "password": "12345678",
            "role": "student",
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)


class CustomTokenSerializerTests(TestCase):
    def test_custom_token_serializer_adds_user_fields(self):
        user = User.objects.create_user(
            username="teacher",
            email="teacher@example.com",
            role="teacher",
            password="teacher-demo-123",
        )

        serializer = CustomTokenObtainPairSerializer(data={
            "username": "teacher",
            "password": "teacher-demo-123",
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        data = serializer.validated_data

        self.assertIn("access", data)
        self.assertIn("refresh", data)
        self.assertEqual(data["username"], user.username)
        self.assertEqual(data["email"], user.email)
        self.assertEqual(data["role"], user.role)
