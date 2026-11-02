import type { CourseCreateInput, CourseCreateLessonInput, CourseCreateStageInput } from "./types/courses.js";

export interface CourseComposerLesson {
    id: string
    title: string
    url: string
}

export interface CourseComposerStage {
    id: string
    title: string
    lessons: CourseComposerLesson[]
}

export interface CourseComposerValues {
    title: string
    description: string
    stages: CourseComposerStage[]
}

export function buildCourseCreatePayload(
    values: CourseComposerValues,
    uploadedImages: File[] = [],
): CourseCreateInput {
    return {
        title: values.title.trim(),
        description: values.description.trim(),
        stages: values.stages.map((stage, stageIndex): CourseCreateStageInput => ({
            title: stage.title.trim(),
            order: stageIndex + 1,
            lessons: stage.lessons.map((lesson, lessonIndex): CourseCreateLessonInput => ({
                title: lesson.title.trim(),
                url: lesson.url.trim(),
                order: lessonIndex + 1,
            })),
        })),
        uploaded_images: uploadedImages,
    };
}
