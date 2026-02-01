from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from users.models import User

class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword123'
        )
        self.token_url = reverse('login')
        self.refresh_url = reverse('token_refresh')

    def test_register(self):
        body = {
            "username": "student",
            "email": "student@gmail.com",
            "password": "1234",  
            "role": "student"
        }
        response = self.client.post('/api/register/', body, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['username'], body['username'])
        self.assertEqual(response.data['email'], body['email'])
        self.assertEqual(response.data['role'], body['role'])
        self.assertNotIn('password', response.data) 

    def test_obtain_token_pair_success(self):
        data = {
            'username': 'testuser',
            'password': 'testpassword123'
        }
        response = self.client.post(self.token_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_obtain_token_pair_failure(self):
        data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }
        response = self.client.post(self.token_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)

    def test_refresh_token_success(self):
        response = self.client.post(self.token_url, {
            'username': 'testuser',
            'password': 'testpassword123'
        }, format='json')
        refresh_token = response.data['refresh']

        response = self.client.post(self.refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_refresh_token_failure(self):
        response = self.client.post(self.refresh_url, {'refresh': 'invalidtoken'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', response.data)

    def test_logout_blacklists_refresh_token(self):
        response = self.client.post(self.token_url, {
            'username': 'testuser',
            'password': 'testpassword123'
        }, format='json')
        refresh_token = response.data['refresh']

        logout_url = reverse('token_logout')
        response = self.client.post(logout_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Using the same refresh token again should fail
        response = self.client.post(self.refresh_url, {'refresh': refresh_token}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
