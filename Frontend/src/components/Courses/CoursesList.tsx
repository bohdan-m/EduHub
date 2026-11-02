"use client";

import { useEffect, useState } from "react";
import { coursesApi } from "@/api/auth.api";
import type { CourseListItem } from "@/utils/types/courses";
import CoursesListItem from "@/components/Courses/CoursesListItem";
import { useInView } from "react-intersection-observer";
import { Alert, Button, Card, EmptyState, Spinner, buttonVariants } from "@heroui/react";
import { IconAlertCircle, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useUserStore } from "@/store/store";
import DescriptionPage from "@/components/Description/DescriptionPage";

const FIRST_PAGE = "/courses/"

function CoursesList () {
    const isTeacher = useUserStore((state) => state.user?.role === "teacher")
    const [isLoading, setIsLoading] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)
    const [hasError, setHasError] = useState(false)

    const [courses, setCourses] = useState<CourseListItem[]>([])
    const [next, setNext] = useState<string | null>(null)

    // the API returns absolute next-page URLs; apiClient already has the /api base
    const nextPath = next ? next.slice(next.indexOf('/courses/')) : null

    // flags are set by the callers, so this only touches state after the request settles
    const fetchCourses = (url: string = FIRST_PAGE) =>
        coursesApi.courses(url)
            .then(data => {
                setNext(data.next)
                setCourses(prev => url === FIRST_PAGE ? data.results : [...prev, ...data.results])
            })
            .catch(error => {
                console.error(error)
                setHasError(true)
            })
            .finally(() => {
                setIsLoading(false)
                setIsFetchingMore(false)
            })

    useEffect(() => {
        fetchCourses()
    }, [])

    const loadMore = () => {
        if (!nextPath) return
        setHasError(false)
        setIsFetchingMore(true)
        fetchCourses(nextPath)
    }

    // The sentinel only exists while idle, so each page mounts a fresh one; a fresh one that is
    // already on screen reports in view at once and pulls the next page. hasError removes it, so a failed page isn't retried in a loop.
    const { ref } = useInView({
        rootMargin: '100px',
        onChange: (inView) => inView && loadMore(),
    })

    const retry = () => {
        if (courses.length && nextPath) return loadMore()
        setHasError(false)
        setIsLoading(true)
        fetchCourses()
    }

    const errorNote = (
        <Alert status="danger" className="mt-10 items-center">
            <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
            <Alert.Content>
                <Alert.Title>Couldn&rsquo;t load courses</Alert.Title>
                <Alert.Description>Check your connection and try again.</Alert.Description>
            </Alert.Content>
            <Button size="sm" variant="danger-soft" onPress={retry}>Try again</Button>
        </Alert>
    )

    let content
    if (isLoading) {
        content = (
            <div className="mt-10 flex items-center justify-center gap-3 py-12 text-muted" role="status">
                <Spinner size="sm" />
                Loading courses…
            </div>
        )
    } else if (courses.length > 0) {
        content = (
            <ul className="m-0 mt-10 flex list-none flex-col gap-6 p-0">
                {courses.map(course => (
                <li key={course.id}>
                    <CoursesListItem course={course}/>
                </li>
                ))}
                {hasError ? <li>{errorNote}</li> : next && (
                    <li ref={isFetchingMore ? undefined : ref} key={next} className="flex min-h-5 items-center justify-center gap-2 text-sm text-muted">
                        {isFetchingMore && <><Spinner size="sm" /> Loading more courses…</>}
                    </li>
                )}
            </ul>
        )
    } else if (hasError) {
        content = errorNote
    } else {
        content = (
            <EmptyState className="mt-10 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border-tertiary px-6 py-12 text-center text-base">
                <p className="m-0 text-lg font-semibold text-foreground">No courses yet</p>
                <p className="m-0 text-muted">New courses from teachers will appear here.</p>
            </EmptyState>
        )
    }

    return (
        <div>
            <DescriptionPage header="Online Courses from Qualified Teachers" description="Welcome to our online courses page, where you can improve your skills in any field. Choose one of our courses, designed to provide you with comprehensive knowledge and practical experience from qualified instructors. Explore the courses below and find the one that is perfect for your learning needs." />
            {isTeacher && (
                <Card className="mt-10 flex-col items-start gap-4 bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <h2 className="m-0 text-lg font-semibold text-accent-soft-foreground">Publish a new course</h2>
                        <p className="m-0 mt-1 max-w-[60ch] text-muted">Build a curriculum of staged lessons, with optional cover images, in the same format students browse.</p>
                    </div>
                    <Link className={buttonVariants({ variant: "primary", className: "w-full sm:w-auto" })} href="/courses/create">
                        <IconPlus size={18} aria-hidden />
                        Create course
                    </Link>
                </Card>
            )}
            {content}
        </div>
    )
};

export default CoursesList;
