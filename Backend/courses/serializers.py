from rest_framework import serializers
from courses.models import Course, CourseImage, Stage, Lesson
from users.serializers import UserSerializer


class CourseImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseImage
        fields = ['image', 'course']


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'stage']


class StageSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Stage
        fields = ['id', 'title', 'order', 'course', 'lessons']


class CourseSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    stages = StageSerializer(many=True, read_only=True)
    images = CourseImageSerializer(many=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'author', 'stages', 'images']

    def create(self, validated_data):
        images = validated_data.pop('images')
        course = Course.objects.create(**validated_data)
        for image in images:
            CourseImage.objects.create(image=image, course=course)
        return course
