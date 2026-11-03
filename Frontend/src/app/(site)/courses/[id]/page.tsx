"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Card, Spinner, buttonVariants } from "@heroui/react";
import { IconAlertCircle, IconArrowLeft, IconPlayerPlayFilled } from "@tabler/icons-react";
import { coursesApi } from "@/api/courses.api";
import type { CourseDetail, LessonItem } from "@/utils/types/courses";
import { getYoutubeEmbedUrl } from "@/utils/youtube";

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

const pad = (n: number) => String(n).padStart(2, "0");

function getFirstPlayableLesson(course: CourseDetail) {
    for (const stage of course.stages) {
        const lesson = stage.lessons.find((item) => getYoutubeEmbedUrl(item.url));
        if (lesson) return lesson;
    }
    return null;
}

const backLink = (
    <Link className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2 self-start text-muted" })} href="/home">
        <IconArrowLeft size={16} aria-hidden />
        All courses
    </Link>
);

export default function CourseDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        coursesApi.courseDetail(id)
            .then((data) => {
                setCourse(data);
                setSelectedLesson(getFirstPlayableLesson(data));
            })
            .catch((fetchError) => {
                console.error(fetchError);
                setError(fetchError?.response?.status === 404 ? "This course doesn't exist." : "We couldn't load this course right now.");
            })
            .finally(() => setIsLoading(false));
    }, [id]);

    if (isLoading) {
        return (
            <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
                <Spinner size="sm" />
                Loading course…
            </div>
        );
    }

    if (error || !course) {
        return (
            <div className="mt-6 flex flex-col gap-6">
                {backLink}
                <Alert status="danger">
                    <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
                    <Alert.Content>
                        <Alert.Description>{error ?? "This course doesn't exist."}</Alert.Description>
                    </Alert.Content>
                </Alert>
            </div>
        );
    }

    const videoUrl = selectedLesson ? getYoutubeEmbedUrl(selectedLesson.url) : null;
    const lessonCount = course.stages.reduce((sum, stage) => sum + stage.lessons.length, 0);

    return (
        <div className="mt-4 flex flex-col gap-10 pb-4">
            <section className="flex flex-col gap-6 border-b border-separator pb-8">
                {backLink}
                <div className="grid gap-6 md:grid-cols-[1fr_minmax(240px,300px)] md:items-start md:gap-10">
                    <div>
                        <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold leading-tight tracking-tight text-balance [overflow-wrap:anywhere]">{course.title}</h1>
                        {course.description && <p className="m-0 mt-3 max-w-[65ch] text-muted">{course.description}</p>}
                    </div>
                    <dl className="m-0 grid grid-cols-3 gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-1 md:gap-3 md:p-5">
                        {[
                            ["Instructor", course.author?.name ?? "EduHub"],
                            ["Published", dateFormat.format(new Date(course.created_at))],
                            ["Content", `${course.stages.length} stages · ${lessonCount} lessons`],
                        ].map(([label, value]) => (
                            <div key={label} className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-4">
                                <dt className="text-sm text-muted">{label}</dt>
                                <dd className="m-0 text-[15px] font-medium [overflow-wrap:anywhere] md:text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>

            {course.images.length > 0 && (
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {course.images.map((image, i) => (
                        <li key={image.id}>
                            {/* plain img: course photos come from the API's media host, which differs per environment */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="block aspect-[4/3] w-full rounded-lg bg-surface-secondary object-cover" alt={`${course.title}, image ${i + 1}`} src={image.image} />
                        </li>
                    ))}
                </ul>
            )}

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
                <div className="flex flex-col gap-3">
                    {selectedLesson && videoUrl ? (
                        <>
                            <div className="aspect-video overflow-hidden rounded-xl bg-black">
                                <iframe
                                    key={videoUrl}
                                    className="size-full border-0"
                                    src={videoUrl}
                                    title={selectedLesson.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    referrerPolicy="strict-origin-when-cross-origin"
                                />
                            </div>
                            <p className="m-0 text-sm text-muted">Now playing</p>
                            <h2 className="m-0 -mt-2 text-xl font-semibold [overflow-wrap:anywhere]">{selectedLesson.title}</h2>
                        </>
                    ) : (
                        <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border-tertiary px-6 text-center text-muted">
                            No lesson in this course has a playable YouTube video yet.
                        </div>
                    )}
                </div>

                <Card className="gap-0 p-0">
                    <h2 className="m-0 border-b border-border px-5 py-4 text-base font-semibold">Curriculum</h2>
                    {course.stages.length === 0 ? (
                        <p className="m-0 px-5 py-4 text-muted">Stages will appear here once the teacher adds them.</p>
                    ) : (
                        <ol className="m-0 list-none p-0">
                            {course.stages.map((stage) => (
                                <li key={stage.id} className="border-b border-border px-3 pt-3 pb-2 last:border-b-0">
                                    <h3 className="m-0 flex items-baseline gap-3 px-2 pb-2 text-[15px] font-semibold">
                                        <span className="text-accent tabular-nums">{pad(stage.order)}</span>
                                        <span className="[overflow-wrap:anywhere]">{stage.title}</span>
                                    </h3>
                                    {stage.lessons.length === 0 ? (
                                        <p className="m-0 px-2 pb-2 text-sm text-muted">No lessons yet.</p>
                                    ) : (
                                        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                                            {stage.lessons.map((lesson) => {
                                                const isPlayable = Boolean(getYoutubeEmbedUrl(lesson.url));
                                                const isSelected = selectedLesson?.id === lesson.id;
                                                return (
                                                    <li key={lesson.id}>
                                                        <button
                                                            type="button"
                                                            disabled={!isPlayable}
                                                            aria-current={isSelected ? "true" : undefined}
                                                            onClick={() => setSelectedLesson(lesson)}
                                                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isSelected ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-secondary"}`}
                                                        >
                                                            <span className="w-5 shrink-0 text-muted tabular-nums">
                                                                {isSelected ? <IconPlayerPlayFilled size={14} aria-hidden className="text-accent" /> : pad(lesson.order)}
                                                            </span>
                                                            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{lesson.title}</span>
                                                            {!isPlayable && <span className="shrink-0 text-xs text-muted">No video</span>}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>
            </section>
        </div>
    );
}
