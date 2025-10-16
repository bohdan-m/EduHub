from rest_framework import generics
from courses.models import Course
from courses.serializers import CourseDetailSerializer, CoursesSerializer, CourseCreateSerializer


class CreateCourse(generics.CreateAPIView):
    serializer_class = CourseCreateSerializer

    def perform_create(self, serializer):
        return serializer.save(author=self.request.user)


class GetCourseDetails(generics.ListAPIView):
    serializer_class = CourseDetailSerializer

    def get_queryset(self):
        course_pk = self.kwargs.get('pk')
        return Course.objects.filter(id=course_pk).prefetch_related('images', 'stages__lessons')


class GetCourses(generics.ListAPIView):
    serializer_class = CoursesSerializer

    def get_queryset(self):
        course_pk = self.kwargs.get('pk')
        return Course.objects.prefetch_related('images', 'stages')
