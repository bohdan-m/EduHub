from django.urls import path
from users.views import UserRegister

urlpatterns = [
    path('register/', UserRegister.as_view(), name='register')
]
