from rest_framework import serializers
from users.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'password']
        read_only_fields = ['id']
        extra_kwargs = {
            'email': {'required': True},
            'role': {'required': True},
            'password': {'write_only': True},  
        }

    def validate_email(self, value): 
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists.")
        return value.lower()

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
    

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):

    def validate(self, attrs):
        data = super().validate(attrs)

        user = self.user  

        data.update({
            "user": {
                "username": user.username,
                "email": user.email,
                "role": getattr(user, "role", None),
            }
        })

        return data
