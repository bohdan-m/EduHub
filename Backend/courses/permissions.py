from rest_framework.permissions import BasePermission


class IsTeacher(BasePermission):
    def has_permission(self, request, view):
        return getattr(request.user, 'is_authenticated', False) and getattr(request.user, 'role', None) == 'teacher'
