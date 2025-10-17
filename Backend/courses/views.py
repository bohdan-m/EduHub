from rest_framework import generics
from courses.models import Course
from courses.serializers import CourseDetailSerializer, CoursesSerializer, CourseCreateSerializer
from courses.permissions import IsTeacher


class CourseCreateView(generics.CreateAPIView):
    serializer_class = CourseCreateSerializer
    permission_classes = [IsTeacher]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class CourseDetailView(generics.RetrieveAPIView):
    serializer_class = CourseDetailSerializer
    lookup_field = 'pk'

    def get_queryset(self):
        return Course.objects.prefetch_related('images', 'stages__lessons')


class CourseListView(generics.ListAPIView):
    serializer_class = CoursesSerializer

    def get_queryset(self):
        queryset = Course.objects.prefetch_related('images', 'stages')
        
        if self.request.user.role == 'teacher':
            queryset = queryset.filter(author=self.request.user)
        
        return queryset
