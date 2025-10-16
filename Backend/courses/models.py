from django.db import models
from users.models import User
from django.core.validators import MaxValueValidator


class Course(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='courses')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class CourseImage(models.Model):
    image = models.ImageField(upload_to='course_previews/')
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='images')


class Stage(models.Model):
    title = models.CharField(max_length=100)
    order = models.PositiveIntegerField(validators=[MaxValueValidator(100)])
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='stages')

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title


class Lesson(models.Model):
    title = models.CharField(max_length=100)
    order = models.PositiveIntegerField(validators=[MaxValueValidator(100)])
    stage = models.ForeignKey(Stage, on_delete=models.CASCADE, related_name='lessons')

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title
