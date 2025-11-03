from rest_framework import serializers
from users.models import User

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
