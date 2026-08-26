import json
from rest_framework import serializers
from courses.models import Course, CourseImage, Stage, Lesson
from users.serializers import UserSerializer
from django.db import transaction


class CourseImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseImage
        fields = ['id', 'image']


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['id', 'title', 'url', 'order']


class StageSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True)

    class Meta:
        model = Stage
        fields = ['id', 'title', 'order', 'lessons']


class StageShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ['id', 'title', 'order']


class BaseCourseSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    images = CourseImageSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = ['id', 'title', 'description', 'author', 'images', 'created_at']


class CoursesSerializer(BaseCourseSerializer):
    stages = serializers.SerializerMethodField()

    class Meta(BaseCourseSerializer.Meta):
        fields = BaseCourseSerializer.Meta.fields + ['stages']

    def get_stages(self, obj):
        stages_qs = obj.stages.all().order_by('order')[:5]
        return StageShortSerializer(stages_qs, many=True).data


class CourseDetailSerializer(BaseCourseSerializer):
    stages = StageSerializer(many=True, read_only=True)

    class Meta(BaseCourseSerializer.Meta):
        fields = BaseCourseSerializer.Meta.fields + ['stages']


class CourseCreateSerializer(BaseCourseSerializer):
    stages = StageSerializer(many=True)
    uploaded_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False
    )

    class Meta(BaseCourseSerializer.Meta):
        fields = BaseCourseSerializer.Meta.fields + ['stages', 'uploaded_images']

    def to_internal_value(self, data):
        if hasattr(data, "getlist"):
            mutable_data = {}
            list_fields = {"uploaded_images"}

            for key in data.keys():
                values = data.getlist(key)
                if key in list_fields:
                    mutable_data[key] = values
                else:
                    mutable_data[key] = values if len(values) > 1 else data.get(key)
        else:
            mutable_data = dict(data)

        stages_data = mutable_data.get('stages')

        if isinstance(stages_data, str):
            try:
                mutable_data['stages'] = json.loads(stages_data)
            except ValueError as exc:
                raise serializers.ValidationError({'stages': 'Invalid stages payload'}) from exc

        return super().to_internal_value(mutable_data)

    def validate_stages(self, value):
        stage_orders = [stage['order'] for stage in value]
        if len(stage_orders) != len(set(stage_orders)):
            raise serializers.ValidationError("Stage orders must be unique")

        for stage in value:
            lesson_orders = [lesson['order'] for lesson in stage.get('lessons', [])]
            if len(lesson_orders) != len(set(lesson_orders)):
                raise serializers.ValidationError("Lesson orders must be unique within each stage")

        return value

    @transaction.atomic
    def create(self, validated_data):
        stages_data = validated_data.pop('stages', [])
        uploaded_images = validated_data.pop('uploaded_images', [])

        course = Course.objects.create(**validated_data)

        course_images = [
            CourseImage(course=course, image=image)
            for image in uploaded_images
        ]
        CourseImage.objects.bulk_create(course_images)

        for stage_data in stages_data:
            lessons_data = stage_data.pop('lessons', [])
            stage = Stage.objects.create(course=course, **stage_data)

            stage_lessons = [
                Lesson(stage=stage, **lesson_data)
                for lesson_data in lessons_data
            ]
            Lesson.objects.bulk_create(stage_lessons)

        return course
