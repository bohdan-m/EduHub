import Link from "next/link";
import { Card, buttonVariants } from "@heroui/react";
import type { CourseListItem } from "@/utils/types/courses";

interface CoursesListItemProps {
    course: CourseListItem;
}

const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

// shows 1 image on phones, 2 on tablets, 3 on desktop
const imageVisibility = ["", "hidden sm:block", "hidden lg:block"];

function CoursesListItem({ course }: CoursesListItemProps) {
    return (
        <Card className="gap-0 p-4 sm:p-6">
            <Card.Header className="flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0 flex-1">
                    <Card.Title className="m-0 mb-2 text-[19px] font-semibold [overflow-wrap:anywhere] sm:text-[22px]">{course.title}</Card.Title>
                    {course.description && (
                        <Card.Description className="m-0 max-w-[70ch] text-[15px] text-muted sm:text-base">{course.description}</Card.Description>
                    )}
                </div>
                <Link className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })} href={`/courses/${course.id}`}>
                    View course
                </Link>
            </Card.Header>

            <Card.Content className="gap-0">
                {course.images.length > 0 && (
                    <ul className="m-0 mt-4 grid list-none grid-cols-1 gap-3 p-0 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
                        {course.images.slice(0, 3).map((image, i) => (
                            <li key={image.id} className={imageVisibility[i]}>
                                {/* plain img: course photos come from the Django media host, which differs per environment */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img className="block aspect-[4/3] w-full rounded-lg bg-surface-secondary object-cover" alt="" src={image.image} loading="lazy" />
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <time className="text-sm text-muted tabular-nums" dateTime={course.created_at}>
                        {dateFormat.format(new Date(course.created_at))}
                    </time>
                    <p className="m-0 min-w-0 text-[15px] font-medium text-muted">By {course.author.username}</p>
                </div>

                {course.stages.length > 0 && (
                    <div className="mt-5 rounded-lg border border-border">
                        <h3 className="m-0 px-4 py-3 text-base font-semibold sm:px-5 sm:py-4">Curriculum</h3>
                        <ol className="m-0 grid list-none grid-cols-1 border-t border-border p-0 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
                            {course.stages.map(stage => (
                                <li
                                    key={stage.id}
                                    className="flex items-baseline gap-3 border-t border-border px-4 py-2.5 first:border-t-0 sm:flex-col sm:gap-1 sm:border-t-0 sm:px-5 sm:pt-4 sm:pb-5"
                                >
                                    <span className="text-[15px] font-semibold leading-none text-accent tabular-nums sm:text-[32px]">
                                        {String(stage.order).padStart(2, "0")}
                                    </span>
                                    <span className="text-sm text-muted">{stage.title}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </Card.Content>
        </Card>
    );
};

export default CoursesListItem;
