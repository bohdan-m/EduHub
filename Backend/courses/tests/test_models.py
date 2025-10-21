from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from courses.models import Course, Stage, Lesson, CourseImage
from users.models import User


class CourseModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="Alex",
            email="email@email.com",
            role="student",
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

    # Course

    def test_course_created(self):
        self.assertEqual(self.course.title, "Course Title")
        self.assertEqual(self.course.description, "Course Description")
        self.assertEqual(self.course.author, self.user)
        self.assertIsNotNone(self.course.created_at)

    def test_course_str(self):
        self.assertEqual(str(self.course), "Course Title")

    def test_course_related_name(self):
        self.assertIn(self.course, self.user.courses.all())

    # Stage

    def test_stage_created(self):
        self.assertEqual(self.stage.title, "Stage Title")
        self.assertEqual(self.stage.order, 1)
        self.assertEqual(self.stage.course, self.course)

    def test_stage_str(self):
        self.assertEqual(str(self.stage), "Stage Title")

    def test_stage_related_name(self):
        self.assertIn(self.stage, self.course.stages.all())

    def test_stage_ordering(self):
        stage2 = Stage.objects.create(title="Stage 2", order=2, course=self.course)
        stages = list(self.course.stages.all())
        self.assertEqual(stages, [self.stage, stage2])

    def test_stage_order_validation(self):
        stage_invalid = Stage(title="Invalid Stage", order=101, course=self.course)
        with self.assertRaises(ValidationError):
            stage_invalid.full_clean()

    # Lesson

    def test_lesson_created(self):
        self.assertEqual(self.lesson.title, "Lesson Title")
        self.assertEqual(self.lesson.order, 1)
        self.assertEqual(self.lesson.stage, self.stage)

    def test_lesson_str(self):
        self.assertEqual(str(self.lesson), "Lesson Title")

    def test_lesson_related_name(self):
        self.assertIn(self.lesson, self.stage.lessons.all())

    def test_lesson_ordering(self):
        lesson2 = Lesson.objects.create(title="Lesson 2", order=2, stage=self.stage)
        lessons = list(self.stage.lessons.all())
        self.assertEqual(lessons, [self.lesson, lesson2])

    def test_lesson_order_validation(self):
        lesson_invalid = Lesson(title="Invalid Lesson", order=101, stage=self.stage)
        with self.assertRaises(ValidationError):
            lesson_invalid.full_clean()

    # CourseImage

    def test_course_image_created(self):
        image_file = SimpleUploadedFile("test.jpg", b"file_content", content_type="image/jpeg")
        course_image = CourseImage.objects.create(course=self.course, image=image_file)
        self.assertEqual(course_image.course, self.course)
        self.assertTrue(course_image.image.name.startswith("course_previews/"))
