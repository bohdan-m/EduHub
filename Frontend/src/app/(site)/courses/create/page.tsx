"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner, buttonVariants } from "@heroui/react";
import { draftsApi } from "@/api/drafts.api";
import CourseBuilder, { type RestoredDraft } from "@/components/CourseBuilder/CourseBuilder";
import { authClient } from "@/lib/auth-client";
import { parseDraftData } from "@/utils/draftData";

export default function CourseCreatePage() {
    const { data: session, isPending } = authClient.useSession();
    // undefined while loading; null when there is no draft (or it can't be read, which shouldn't block creating)
    const [restored, setRestored] = useState<RestoredDraft | null | undefined>(undefined);
    const userId = session?.user.id;

    useEffect(() => {
        if (!userId) return;
        draftsApi.get()
            .then((saved) => {
                const draft = saved && parseDraftData(saved.data);
                setRestored(draft ? { draft, savedAt: saved.updated_at } : null);
            })
            .catch(() => setRestored(null));
    }, [userId]);

    if (isPending || (session && restored === undefined)) {
        return (
            <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
                <Spinner size="sm" />
                Loading…
            </div>
        );
    }

    if (!session) {
        return (
            <section className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
                <h1 className="m-0 text-2xl font-semibold">Log in to create a course</h1>
                <p className="m-0 text-muted">Courses belong to your account, so log in or sign up first.</p>
                <Link className={buttonVariants({ variant: "outline", className: "mt-3" })} href="/login">Log in</Link>
            </section>
        );
    }

    return <CourseBuilder restored={restored} />;
}
