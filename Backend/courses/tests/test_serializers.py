from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from courses.models import Course, Stage, Lesson, CourseImage
from courses.serializers import (
    CourseCreateSerializer,
    CourseImageSerializer,
    StageSerializer,
    StageShortSerializer,
    CoursesSerializer,
    CourseDetailSerializer,
    LessonSerializer
)
from users.models import User


class SerializerTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="Alex",
            email="email@email.com",
            role="teacher",
            password="1234"
        )

        self.course = Course.objects.create(
            title="Course Title",
            description="Course Description",
            author=self.user
        )

        self.stage = Stage.objects.create(
            title="Stage Title",
            order=1,
            course=self.course
        )

        self.lesson = Lesson.objects.create(
            title="Lesson Title",
            order=1,
            stage=self.stage
        )

        self.image = CourseImage.objects.create(
            course=self.course,
            image=SimpleUploadedFile("test.jpg", b"file_content", content_type="image/jpeg")
        )

    # LessonSerializer

    def test_lesson_serializer_serialization(self):
        serializer = LessonSerializer(self.lesson)
        data = serializer.data
        self.assertEqual(data['title'], self.lesson.title)
        self.assertEqual(data['order'], self.lesson.order)

    def test_lesson_serializer_deserialization(self):
        data = {'title': 'New Lesson', 'order': 2}
        serializer = LessonSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        lesson = serializer.save(stage=self.stage)
        self.assertEqual(lesson.title, 'New Lesson')
        self.assertEqual(lesson.stage, self.stage)

    # StageSerializer

    def test_stage_serializer_serialization(self):
        serializer = StageSerializer(self.stage)
        data = serializer.data
        self.assertEqual(data['title'], self.stage.title)
        self.assertIn('lessons', data)
        self.assertEqual(len(data['lessons']), 1)
        self.assertEqual(data['lessons'][0]['title'], self.lesson.title)

    def test_stage_serializer_deserialization_validation(self):
        data = {'title': 'New Stage', 'order': 2, 'lessons': [{'title': 'Lesson 2', 'order': 2}]}
        serializer = StageSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['title'], 'New Stage')
        self.assertEqual(serializer.validated_data['order'], 2)
        self.assertEqual(len(serializer.validated_data['lessons']), 1)

    # StageShortSerializer

    def test_stage_short_serializer(self):
        from courses.serializers import StageShortSerializer
        serializer = StageShortSerializer(self.stage)
        data = serializer.data
        self.assertEqual(data['title'], self.stage.title)
        self.assertEqual(data['order'], self.stage.order)
        self.assertNotIn('lessons', data)  

    # CourseCreateSerializer

    def test_course_create_serializer(self):
        data = {
            'title': 'New Course',
            'description': 'Desc',
            'stages': [
                {
                    'title': 'Stage 1',
                    'order': 1,
                    'lessons': [{'title': 'Lesson 1', 'order': 1}]
                }
            ],
        }
        serializer = CourseCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        course = serializer.save(author=self.user)
        self.assertEqual(course.title, 'New Course')
        self.assertEqual(course.stages.count(), 1)
        self.assertEqual(course.stages.first().lessons.count(), 1)

    def test_course_create_serializer_empty_images(self):
        data = {
            'title': 'Course No Images',
            'description': 'Desc',
            'stages': [],
            'uploaded_images': []
        }
        serializer = CourseCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        course = serializer.save(author=self.user)
        self.assertEqual(course.stages.count(), 0)
        self.assertEqual(course.images.count(), 0)

    # CoursesSerializer

    def test_courses_serializer(self):
        from courses.serializers import CoursesSerializer
        serializer = CoursesSerializer(self.course)
        data = serializer.data
        self.assertEqual(data['title'], self.course.title)
        self.assertIn('stages', data)
        self.assertIn('images', data)
        self.assertEqual(data['stages'][0]['title'], self.stage.title)
        self.assertEqual(data['images'][0]['id'], self.image.id)

    # CourseDetailSerializer

    def test_course_detail_serializer(self):
        from courses.serializers import CourseDetailSerializer
        serializer = CourseDetailSerializer(self.course)
        data = serializer.data
        self.assertEqual(data['title'], self.course.title)
        self.assertIn('stages', data)
        self.assertIn('images', data)
        self.assertEqual(len(data['stages'][0]['lessons']), 1)
        self.assertEqual(data['stages'][0]['lessons'][0]['title'], self.lesson.title)
