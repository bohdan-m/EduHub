from django.urls import path
from courses.views import CourseCreateView, CourseDetailView, CourseListView, CourseDeleteView

urlpatterns = [
    path('course/<int:pk>/', CourseDeleteView.as_view(), name='course-delete'),
    path('course/<int:pk>/', CourseDetailView.as_view(), name='course-details'),
    path('course/create/', CourseCreateView.as_view(), name='create-course'),
    path('course/', CourseListView.as_view(), name='courses')
] 
