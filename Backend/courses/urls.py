from django.urls import path
from courses.views import CreateCourse, GetCourseDetails, GetCourses

urlpatterns = [
    path('course/create/', CreateCourse.as_view(), name='create-course'),
    path('course/<int:pk>/', GetCourseDetails.as_view(), name='course-details'),
    path('course/', GetCourses.as_view(), name='courses')
] 
