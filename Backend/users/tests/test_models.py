from django.test import TestCase
from users.models import User

class UserModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="Alex", 
            role="student", 
            email="email@email.com", 
            password="1234"
        )

    def test_user_created(self):
        self.assertEqual(self.user.username, 'Alex')
        self.assertEqual(self.user.email, 'email@email.com')
        self.assertEqual(self.user.role, 'student')
        self.assertTrue(self.user.check_password('1234'))

    def test_user_str(self):
        self.assertEqual(str(self.user), "Alex, student")

    def test_user_unique(self):
        with self.assertRaises(Exception):
            User.objects.create_user(
                username="Alex", 
                role="student", 
                email="email@email.com",
                password="1234"
            )
