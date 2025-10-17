from django.urls import path
from courses.views import CourseCreateView, CourseDetailView, CourseListView

urlpatterns = [
    path('course/create/', CourseCreateView.as_view(), name='create-course'),
    path('course/<int:pk>/', CourseDetailView.as_view(), name='course-details'),
    path('course/', CourseListView.as_view(), name='courses')
] 
