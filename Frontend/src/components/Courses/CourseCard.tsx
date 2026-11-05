import Link from "next/link";
import { IconBook, IconClock, IconUsers } from "@tabler/icons-react";
import { RatingSummary } from "@/components/Stars";
import { CATEGORIES, LEVELS, STATUSES, formatMinutes, plural } from "@/utils/courseMeta";
import type { CourseListItem } from "@/utils/types/courses";

/** One course in a grid: cover, title, author and the facts that help choose (rating, level, length). */
function CourseCard({ course, showStatus = false, footer }: { course: CourseListItem; showStatus?: boolean; footer?: React.ReactNode }) {
  const cover = course.images[0];
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-accent/40">
      <div className="relative aspect-[16/9] bg-accent-soft">
        {cover ? (
          // plain img: covers come from the API's media host, which differs per environment
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-accent-soft-foreground" aria-hidden>
            <IconBook size={36} stroke={1.4} />
          </div>
        )}
        {showStatus && course.status !== "published" && (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm">
            {STATUSES[course.status].label}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <p className="m-0 text-xs font-medium tracking-wide text-accent uppercase">{CATEGORIES[course.category] ?? "Other"}</p>
        <h3 className="m-0 text-[17px] leading-snug font-semibold [overflow-wrap:anywhere]">
          {/* the whole card is the link; the stretched ::after covers it */}
          <Link href={`/courses/${course.id}`} className="text-foreground no-underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-has-[:focus-visible]:underline">
            {course.title}
          </Link>
        </h3>
        <p className="m-0 line-clamp-2 text-sm text-muted">{course.description}</p>
        <p className="m-0 text-sm text-muted">By {course.author?.name ?? "EduHub"}</p>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <RatingSummary average={course.rating.average} count={course.rating.count} />
          <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-muted">
            <li>{LEVELS[course.level]}</li>
            <li className="inline-flex items-center gap-1"><IconBook size={13} aria-hidden />{plural(course.lesson_count, "lesson")}</li>
            {course.estimated_minutes > 0 && <li className="inline-flex items-center gap-1"><IconClock size={13} aria-hidden />{formatMinutes(course.estimated_minutes)}</li>}
            {course.learner_count > 0 && <li className="inline-flex items-center gap-1"><IconUsers size={13} aria-hidden />{plural(course.learner_count, "learner")}</li>}
          </ul>
        </div>
        {/* above the stretched link, so its own buttons stay clickable */}
        {footer && <div className="relative z-10 mt-3 border-t border-separator pt-3">{footer}</div>}
      </div>
    </article>
  );
}

export default CourseCard;
