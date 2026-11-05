"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Spinner, buttonVariants } from "@heroui/react";
import { coursesApi } from "@/api/courses.api";
import { draftsApi } from "@/api/drafts.api";
import CourseBuilder, { type RestoredDraft } from "@/components/CourseBuilder/CourseBuilder";
import { parseDraftData } from "@/utils/draftData";
import type { CourseDetail } from "@/utils/types/courses";

export default function CourseEditPage() {
    const { id } = useParams<{ id: string }>();
    const [course, setCourse] = useState<CourseDetail | null>(null);
    const [restored, setRestored] = useState<RestoredDraft | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        coursesApi.courseDetail(id)
            .then(async (data) => {
                if (!data.is_owner) return setError("Only the course's author can edit it.");
                // a draft that can't be read shouldn't stop editing the course itself
                const saved = await draftsApi.get(data.id).catch(() => null);
                const draft = saved && parseDraftData(saved.data);
                setRestored(draft ? { draft, savedAt: saved.updated_at } : null);
                setCourse(data);
            })
            .catch((fetchError) => setError(fetchError?.response?.status === 404 ? "This course doesn't exist." : "We couldn't load this course right now."));
    }, [id]);

    if (error) {
        return (
            <section className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
                <h1 className="m-0 text-2xl font-semibold">Can&rsquo;t edit this course</h1>
                <p className="m-0 text-muted">{error}</p>
                <Link className={buttonVariants({ variant: "outline", className: "mt-3" })} href={`/courses/${id}`}>Back to the course</Link>
            </section>
        );
    }

    if (!course) {
        return (
            <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
                <Spinner size="sm" />
                Loading course…
            </div>
        );
    }

    return <CourseBuilder course={course} restored={restored} />;
}
