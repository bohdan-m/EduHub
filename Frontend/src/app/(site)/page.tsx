import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buttonVariants } from "@heroui/react";
import { IconCertificate, IconChecklist, IconMessageCircle, IconPencil } from "@tabler/icons-react";
import CourseCard from "@/components/Courses/CourseCard";
import { auth } from "@/lib/auth";
import { serverApi } from "@/lib/serverApi";
import type { CourseListResponse } from "@/utils/types/courses";

const STEPS = [
  { icon: IconChecklist, title: "Learn at your pace", text: "Lessons with text, video and quizzes. Your progress is saved, so you pick up where you stopped on any device." },
  { icon: IconCertificate, title: "Finish with a certificate", text: "Complete every lesson to get a certificate with a link anyone can check." },
  { icon: IconMessageCircle, title: "Ask and discuss", text: "Every lesson has a discussion. Authors answer questions and reply to reviews." },
  { icon: IconPencil, title: "Teach what you know", text: "Anyone can build a course: stages, lessons, quizzes, images and files, saved as a draft until you publish." },
];

// "/" for visitors; signed-in people go straight to what they are learning
export default async function Landing() {
  if (await auth.api.getSession({ headers: await headers() })) redirect("/learning");
  const featured = await serverApi<CourseListResponse>("/courses/?sort=popular&limit=6");

  return (
    <div className="flex flex-col gap-16 pb-6">
      <section className="mt-6 flex flex-col items-start gap-5 rounded-3xl bg-accent-soft px-6 py-12 sm:px-12 sm:py-16">
        <h1 className="m-0 max-w-[18ch] text-[clamp(32px,5vw,52px)] leading-[1.08] font-semibold tracking-tight text-balance text-accent-soft-foreground">
          Learn something new, or teach what you know
        </h1>
        <p className="m-0 max-w-[55ch] text-lg text-muted">
          EduHub is a free course platform. People in the community write the courses; you take them at your own pace,
          check yourself with quizzes and earn a certificate.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants({ size: "lg" })} href="/register">Create a free account</Link>
          <Link className={buttonVariants({ size: "lg", variant: "outline" })} href="/home">Browse courses</Link>
        </div>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="m-0 text-2xl font-semibold">How it works</h2>
        <ul className="m-0 mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground" aria-hidden><Icon size={20} /></span>
              <h3 className="m-0 text-base font-semibold">{title}</h3>
              <p className="m-0 text-sm text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {featured && featured.results.length > 0 && (
        <section aria-labelledby="popular-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="popular-heading" className="m-0 text-2xl font-semibold">Popular courses</h2>
            <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/home">See all courses</Link>
          </div>
          <ul className="m-0 mt-6 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {featured.results.map((course) => <li key={course.id}><CourseCard course={course} /></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
