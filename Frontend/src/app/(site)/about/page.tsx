import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@heroui/react";
import DescriptionPage from "@/components/Description/DescriptionPage";

export const metadata: Metadata = {
  title: "About",
  description: "What EduHub is, who writes the courses, and how the platform is run.",
};

const FACTS = [
  { title: "Anyone can teach", text: "Every account can build a course. There are no paid plans and no gatekeeping: a course is a draft until its author publishes it." },
  { title: "Free to learn", text: "Every published course is free. Learners keep their progress, notes and bookmarks, and get a certificate when they finish." },
  { title: "Moderated by the community", text: "Reviews come only from people who took a lesson. Anyone can report a course, review or comment; enough reports hide it until a moderator looks." },
  { title: "Your data stays yours", text: "Download everything we keep about you, or delete your account and its content, from the Settings page." },
];

export default function AboutPage() {
  return (
    <div className="pb-6">
      <DescriptionPage
        header="About EduHub"
        description="EduHub is a small, independent course platform. Courses are written by the people who use it, and every lesson is free to take."
      />
      <ul className="m-0 mt-10 grid list-none gap-4 p-0 sm:grid-cols-2">
        {FACTS.map(({ title, text }) => (
          <li key={title} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="m-0 text-base font-semibold">{title}</h2>
            <p className="m-0 mt-1 text-muted">{text}</p>
          </li>
        ))}
      </ul>
      <section className="mt-10 flex flex-col items-start gap-3 rounded-2xl bg-accent-soft p-6">
        <h2 className="m-0 text-lg font-semibold text-accent-soft-foreground">Have something to teach?</h2>
        <p className="m-0 max-w-[60ch] text-muted">Start a draft: it stays private until you publish it.</p>
        <Link className={buttonVariants()} href="/courses/create">Create a course</Link>
      </section>
    </div>
  );
}
