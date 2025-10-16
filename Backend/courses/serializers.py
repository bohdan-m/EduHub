from rest_framework import serializers
from courses.models import Course, CourseImage, Stage, Lesson
from users.serializers import UserSerializer


class CourseImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseImage
        fields = ['id', 'image']


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'order']


class StageSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True)

    class Meta:
        model = Stage
        fields = ['id', 'title', 'order', 'lessons']


class StageShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ['id', 'title', 'order']


class CoursesSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    stages = StageShortSerializer(many=True, read_only=True)
    images = CourseImageSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'author', 'stages', 'images']


class CourseDetailSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    stages = StageSerializer(many=True, read_only=True)
    images = CourseImageSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'author', 'stages', 'images']
    

class CourseCreateSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    stages = StageSerializer(many=True)
    images = CourseImageSerializer(many=True, read_only=True)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'author', 'stages', 'images', 'uploaded_images']

    def create(self, validated_data):
        stages_data = validated_data.pop('stages', [])
        images = validated_data.pop('uploaded_images', [])
        course = Course.objects.create(**validated_data)
        for image in images:
            CourseImage.objects.create(course=course, image=image)
        for stage_data in stages_data:
            lessons = stage_data.pop('lessons', [])
            stage = Stage.objects.create(course=course, **stage_data)
            for lesson in lessons:
                Lesson.objects.create(stage=stage, **lesson)
        return course
