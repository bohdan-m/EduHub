from django.shortcuts import render
from rest_framework import generics
from rest_framework.permissions import AllowAny
from users.models import User
from users.serializers import UserSerializer


class UserRegister(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
