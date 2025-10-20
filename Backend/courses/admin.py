from django.contrib import admin
from courses.models import Course, CourseImage, Stage, Lesson


class CourseImageInline(admin.TabularInline):
    model = CourseImage
    extra = 1


class StageInline(admin.TabularInline):
    model = Stage
    extra = 1


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1

class StageAdmin(admin.ModelAdmin):
    inlines = [LessonInline]
    list_display = ['id', 'title', 'course']
    list_filter = ['id', 'course']


class CourseAdmin(admin.ModelAdmin):
    inlines = [CourseImageInline, StageInline]
    list_display = ['id', 'title', 'description', 'author', 'created_at']
    list_filter = ['id', 'author']


admin.site.register(Course, CourseAdmin)
admin.site.register(Stage, StageAdmin)
admin.site.register(Lesson)
