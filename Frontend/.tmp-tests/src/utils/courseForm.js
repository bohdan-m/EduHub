export function buildCourseCreatePayload(values, uploadedImages = []) {
    return {
        title: values.title.trim(),
        description: values.description.trim(),
        stages: values.stages.map((stage, stageIndex) => ({
            title: stage.title.trim(),
            order: stageIndex + 1,
            lessons: stage.lessons.map((lesson, lessonIndex) => ({
                title: lesson.title.trim(),
                url: lesson.url.trim(),
                order: lessonIndex + 1,
            })),
        })),
        uploaded_images: uploadedImages,
    };
}
