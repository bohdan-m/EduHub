import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { AuthorProfile } from "@/api/users.api";
import CourseCard from "@/components/Courses/CourseCard";
import { RatingSummary } from "@/components/Stars";
import { serverApi } from "@/lib/serverApi";
import { plural } from "@/utils/courseMeta";

type Props = { params: Promise<{ id: string }> };

const load = (id: string) => (/^\d+$/.test(id) ? serverApi<AuthorProfile>(`/users/${id}/`) : Promise.resolve(null));
const joined = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const author = await load((await params).id);
  if (!author) return { title: "Author" };
  return { title: author.name, description: author.headline || `Courses by ${author.name} on EduHub.` };
}

/** A public author page: who they are and their published courses. */
export default async function AuthorPage({ params }: Props) {
  const author = await load((await params).id);
  if (!author) notFound();

  return (
    <div className="mt-4 flex flex-col gap-10 pb-6">
      <section className="flex flex-col gap-3 border-b border-separator pb-8">
        <p className="m-0 text-sm text-muted">Author</p>
        <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight [overflow-wrap:anywhere]">{author.name}</h1>
        {author.headline && <p className="m-0 text-lg text-muted">{author.headline}</p>}
        {author.bio && <p className="m-0 max-w-[70ch] whitespace-pre-line">{author.bio}</p>}
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 gap-y-2 p-0 text-sm">
          <li>{plural(author.course_count, "course")}</li>
          <li>{plural(author.learner_count, "learner")}</li>
          <li><RatingSummary average={author.rating.average} count={author.rating.count} /></li>
          <li className="text-muted">Joined {joined.format(new Date(author.joined))}</li>
        </ul>
      </section>
      {author.courses.length === 0 ? (
        <p className="m-0 text-muted">No published courses yet.</p>
      ) : (
        <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {author.courses.map((course) => <li key={course.id}><CourseCard course={course} /></li>)}
        </ul>
      )}
    </div>
  );
}
