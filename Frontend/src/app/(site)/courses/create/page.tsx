"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, FieldError, Form, Input, Label, Spinner, TextArea, TextField, buttonVariants } from "@heroui/react";
import { IconAlertCircle, IconPlus, IconTrash } from "@tabler/icons-react";
import { coursesApi } from "@/api/courses.api";
import { authClient } from "@/lib/auth-client";
import { getApiErrorMessage } from "@/utils/apiError";
import { buildCourseCreatePayload, type CourseComposerLesson, type CourseComposerStage, type CourseComposerValues } from "@/utils/courseForm";
import { LIMITS, validateImages, validateText, validateYoutubeUrl } from "@/utils/validation";

// crypto.randomUUID needs a secure context; plain http on a LAN IP doesn't have one
const createId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emptyLesson = (): CourseComposerLesson => ({ id: createId(), title: "", url: "" });
const emptyStage = (): CourseComposerStage => ({ id: createId(), title: "", lessons: [emptyLesson()] });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function CourseCreatePage() {
    const router = useRouter();
    const { data: session, isPending: isSessionPending } = authClient.useSession();
    const isTeacher = session?.user.role === "teacher";

    const [values, setValues] = useState<CourseComposerValues>({ title: "", description: "", stages: [emptyStage()] });
    const [images, setImages] = useState<File[]>([]);
    const [imageError, setImageError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateStage = (stageId: string, update: (stage: CourseComposerStage) => CourseComposerStage) =>
        setValues((current) => ({ ...current, stages: current.stages.map((s) => (s.id === stageId ? update(s) : s)) }));

    const updateLesson = (stageId: string, lessonId: string, patch: Partial<CourseComposerLesson>) =>
        updateStage(stageId, (stage) => ({
            ...stage,
            lessons: stage.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
        }));

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // every text field validates itself (the form won't submit while one is invalid); files are checked on change
        if (imageError) return;

        setError(null);
        setIsSubmitting(true);
        try {
            const course = await coursesApi.createCourse(buildCourseCreatePayload(values, images));
            router.push(`/courses/${course.id}`);
        } catch (submitError) {
            setError(getApiErrorMessage(submitError, "Couldn't publish the course. Check the details and try again."));
            setIsSubmitting(false);
        }
    };

    if (isSessionPending) {
        return (
            <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
                <Spinner size="sm" />
                Loading…
            </div>
        );
    }

    if (!isTeacher) {
        return (
            <section className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
                <h1 className="m-0 text-2xl font-semibold">Teacher account needed</h1>
                <p className="m-0 text-muted">Only teachers can publish courses. Log in with a teacher account to create one.</p>
                <Link className={buttonVariants({ variant: "outline", className: "mt-3" })} href="/home">Back to courses</Link>
            </section>
        );
    }

    const lessonCount = values.stages.reduce((sum, stage) => sum + stage.lessons.length, 0);

    return (
        <div className="mt-4 pb-4">
            <section className="border-b border-separator pb-8">
                <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold leading-tight tracking-tight">Create a course</h1>
                <p className="m-0 mt-2 max-w-[60ch] text-muted">
                    Add the basics, then build the curriculum stage by stage. Lessons play from YouTube links.
                </p>
            </section>

            <Form className="mt-8 flex flex-col gap-8" onSubmit={handleSubmit}>
                <Card className="gap-5 p-5 sm:p-7">
                    <h2 className="m-0 text-lg font-semibold">Details</h2>
                    <TextField
                        name="title"
                        value={values.title}
                        onChange={(title) => setValues((current) => ({ ...current, title }))}
                        validate={(value) => validateText(value, "Course title", LIMITS.courseTitle)}
                        isRequired
                        isDisabled={isSubmitting}
                        fullWidth
                    >
                        <Label>Title</Label>
                        <Input placeholder="Product Design Foundations" />
                        <FieldError />
                    </TextField>
                    <TextField
                        name="description"
                        value={values.description}
                        onChange={(description) => setValues((current) => ({ ...current, description }))}
                        validate={(value) => validateText(value, "Description", LIMITS.courseDescription)}
                        isRequired
                        isDisabled={isSubmitting}
                        fullWidth
                    >
                        <Label>Description</Label>
                        <TextArea rows={4} placeholder="What learners will be able to do, and who the course is for." />
                        <FieldError />
                    </TextField>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="course-images" className="text-sm font-medium">Cover images <span className="font-normal text-muted">(optional)</span></label>
                        <input
                            id="course-images"
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isSubmitting}
                            aria-invalid={imageError ? true : undefined}
                            aria-describedby="course-images-hint"
                            onChange={(event) => {
                                const files = Array.from(event.target.files ?? []);
                                setImages(files);
                                setImageError(validateImages(files));
                            }}
                            className="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-default file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-surface-tertiary"
                        />
                        <p id="course-images-hint" className={`m-0 text-sm ${imageError ? "text-danger" : "text-muted"}`} role={imageError ? "alert" : undefined}>
                            {imageError ?? `Up to ${LIMITS.images} images, 5 MB each. Course cards show the first three.`}
                        </p>
                    </div>
                </Card>

                <section className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="m-0 text-lg font-semibold">Curriculum</h2>
                            <p className="m-0 mt-1 text-sm text-muted">{plural(values.stages.length, "stage")} · {plural(lessonCount, "lesson")} · numbered in the order shown</p>
                        </div>
                    </div>

                    <ol className="m-0 flex list-none flex-col gap-4 p-0">
                        {values.stages.map((stage, stageIndex) => (
                            <li key={stage.id}>
                                <Card className="gap-4 p-5 sm:p-6">
                                    <div className="flex items-end gap-3">
                                        <span className="pb-2.5 text-lg font-semibold text-accent tabular-nums">{String(stageIndex + 1).padStart(2, "0")}</span>
                                        <TextField
                                            className="min-w-0 flex-1"
                                            value={stage.title}
                                            onChange={(title) => updateStage(stage.id, (s) => ({ ...s, title }))}
                                            validate={(value) => validateText(value, "Stage title", LIMITS.stageTitle)}
                                            isRequired
                                            isDisabled={isSubmitting}
                                            fullWidth
                                        >
                                            <Label>Stage title</Label>
                                            <Input placeholder="Research and framing" />
                        <FieldError />
                                        </TextField>
                                        {values.stages.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                isIconOnly
                                                aria-label={`Remove stage ${stageIndex + 1}`}
                                                isDisabled={isSubmitting}
                                                onPress={() => setValues((current) => ({ ...current, stages: current.stages.filter((s) => s.id !== stage.id) }))}
                                            >
                                                <IconTrash size={18} aria-hidden />
                                            </Button>
                                        )}
                                    </div>

                                    <ol className="m-0 flex list-none flex-col gap-3 border-l-2 border-separator p-0 pl-4 sm:ml-7">
                                        {stage.lessons.map((lesson, lessonIndex) => (
                                            <li key={lesson.id} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                                <TextField
                                                    className="min-w-0 flex-1"
                                                    value={lesson.title}
                                                    onChange={(title) => updateLesson(stage.id, lesson.id, { title })}
                                                    validate={(value) => validateText(value, "Lesson title", LIMITS.lessonTitle)}
                                                    isRequired
                                                    isDisabled={isSubmitting}
                                                    fullWidth
                                                >
                                                    <Label>Lesson {lessonIndex + 1}</Label>
                                                    <Input placeholder="User interviews in practice" />
                                                    <FieldError />
                                                </TextField>
                                                <div className="flex min-w-0 flex-1 items-end gap-2">
                                                    <TextField
                                                        className="min-w-0 flex-1"
                                                        type="url"
                                                        value={lesson.url}
                                                        onChange={(url) => updateLesson(stage.id, lesson.id, { url })}
                                                        validate={validateYoutubeUrl}
                                                        isDisabled={isSubmitting}
                                                        fullWidth
                                                    >
                                                        <Label>YouTube link</Label>
                                                        <Input placeholder="https://www.youtube.com/watch?v=…" />
                                                        <FieldError />
                                                    </TextField>
                                                    {stage.lessons.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            isIconOnly
                                                            aria-label={`Remove lesson ${lessonIndex + 1}`}
                                                            isDisabled={isSubmitting}
                                                            onPress={() => updateStage(stage.id, (s) => ({ ...s, lessons: s.lessons.filter((l) => l.id !== lesson.id) }))}
                                                        >
                                                            <IconTrash size={18} aria-hidden />
                                                        </Button>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="self-start sm:ml-7"
                                        isDisabled={isSubmitting}
                                        onPress={() => updateStage(stage.id, (s) => ({ ...s, lessons: [...s.lessons, emptyLesson()] }))}
                                    >
                                        <IconPlus size={16} aria-hidden />
                                        Add lesson
                                    </Button>
                                </Card>
                            </li>
                        ))}
                    </ol>

                    <Button
                        variant="outline"
                        className="self-start"
                        isDisabled={isSubmitting}
                        onPress={() => setValues((current) => ({ ...current, stages: [...current.stages, emptyStage()] }))}
                    >
                        <IconPlus size={18} aria-hidden />
                        Add stage
                    </Button>
                </section>

                {error && (
                    <Alert status="danger">
                        <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
                        <Alert.Content>
                            <Alert.Description>{error}</Alert.Description>
                        </Alert.Content>
                    </Alert>
                )}

                <div className="flex flex-col-reverse gap-3 border-t border-separator pt-6 sm:flex-row sm:justify-end">
                    <Link className={buttonVariants({ variant: "ghost" })} href="/home">Cancel</Link>
                    <Button type="submit" isPending={isSubmitting}>
                        {isSubmitting ? "Publishing…" : "Publish course"}
                    </Button>
                </div>
            </Form>
        </div>
    );
}
