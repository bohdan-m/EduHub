from django.urls import path
from users.views import UserRegister, CustomTokenObtainPairView

urlpatterns = [
    path('register/', UserRegister.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='login')
]
