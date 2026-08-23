from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from courses.models import Course, Stage, Lesson, CourseImage
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.files.uploadedfile import SimpleUploadedFile


class CourseViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="teacher",
            email="teacher@email.com",
            role="teacher",
            password="1234"
        )

        refresh = RefreshToken.for_user(self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        self.course = Course.objects.create(
            title="Existing Course",
            description="Desc",
            author=self.user
        )
        self.stage = Stage.objects.create(title="Stage 1", order=1, course=self.course)
        self.lesson = Lesson.objects.create(
            title="Lesson 1",
            url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            order=1,
            stage=self.stage
        )
        self.image = CourseImage.objects.create(
            course=self.course,
            image=SimpleUploadedFile("test.jpg", b"file_content", content_type="image/jpeg")
        )

    # CourseCreateView
    def test_create_course(self):
        url = reverse('course-create')
        data = {
            "title": "New Course",
            "description": "New Desc",
            "stages": [
                {
                    "title": "Stage A",
                    "order": 1,
                    "lessons": [{"title": "Lesson A1", "url": "https://youtu.be/aqz-KE-bpKQ", "order": 1}]
                }
            ],
            "uploaded_images": []
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Course.objects.filter(title="New Course").count(), 1)
        new_course = Course.objects.get(title="New Course")
        self.assertEqual(new_course.stages.count(), 1)
        self.assertEqual(new_course.stages.first().lessons.count(), 1)

    def test_student_cannot_create_course(self):
        student = User.objects.create_user(
            username="student",
            email="student@email.com",
            role="student",
            password="student-demo-123"
        )
        refresh = RefreshToken.for_user(student)
        student_client = APIClient()
        student_client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = student_client.post(reverse('course-create'), {
            "title": "Blocked Course",
            "description": "Blocked Desc",
            "stages": [],
            "uploaded_images": []
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_course_rejects_duplicate_stage_orders(self):
        response = self.client.post(reverse('course-create'), {
            "title": "Invalid Course",
            "description": "Desc",
            "stages": [
                {"title": "Stage A", "order": 1, "lessons": []},
                {"title": "Stage B", "order": 1, "lessons": []}
            ],
            "uploaded_images": []
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("stages", response.data)

    # CourseDeleteView
    def test_delete_course(self):
        url = reverse('course-delete', kwargs={'pk': self.course.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Course.objects.filter(id=self.course.id).exists())

    def test_student_cannot_delete_course(self):
        student = User.objects.create_user(
            username="student-delete",
            email="student-delete@email.com",
            role="student",
            password="student-demo-123"
        )
        refresh = RefreshToken.for_user(student)
        student_client = APIClient()
        student_client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = student_client.delete(reverse('course-delete', kwargs={'pk': self.course.id}))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_teacher_cannot_delete_other_teacher_course(self):
        other_teacher = User.objects.create_user(
            username="other-teacher",
            email="other-teacher@email.com",
            role="teacher",
            password="teacher-demo-123"
        )
        refresh = RefreshToken.for_user(other_teacher)
        other_client = APIClient()
        other_client.credentials(HTTP_AUTHORIZATION=f'Bearer {str(refresh.access_token)}')

        response = other_client.delete(reverse('course-delete', kwargs={'pk': self.course.id}))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # CourseDetailView
    def test_course_detail(self):
        url = reverse('course-detail', kwargs={'pk': self.course.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.course.title)
        self.assertEqual(len(response.data['stages']), 1)
        self.assertEqual(len(response.data['stages'][0]['lessons']), 1)
        self.assertEqual(response.data['stages'][0]['lessons'][0]['url'], self.lesson.url)
        self.assertEqual(len(response.data['images']), 1)

    def test_course_detail_is_public(self):
        url = reverse('course-detail', kwargs={'pk': self.course.id})
        anonymous_client = APIClient()
        response = anonymous_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], self.course.title)

    # CourseListView
    def test_course_list(self):
        url = reverse('course-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        courses_list = response.data.get('results', response.data)
        self.assertTrue(len(courses_list) >= 1)
        self.assertEqual(courses_list[0]['title'], self.course.title)
