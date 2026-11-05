import { Suspense } from "react";
import type { Metadata } from "next";
import CoursePage from "@/components/Course/CoursePage";
import { serverApi } from "@/lib/serverApi";
import type { CourseDetail } from "@/utils/types/courses";

type Props = { params: Promise<{ id: string }> };

// the public view, fetched as a guest: drafts come back empty and the client loads the author's own view
const publicCourse = (id: string) => (/^\d+$/.test(id) ? serverApi<CourseDetail>(`/courses/${id}/`) : Promise.resolve(null));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const course = await publicCourse(id);
  if (!course) return { title: "Course" };
  const description = course.description.slice(0, 200);
  const image = course.images[0]?.image;
  return {
    title: course.title,
    description,
    alternates: { canonical: `/courses/${course.id}` },
    // unlisted courses are for people with the link, not for search engines
    robots: course.status === "unlisted" ? { index: false } : undefined,
    openGraph: { title: course.title, description, type: "article", url: `/courses/${course.id}`, images: image ? [{ url: image }] : undefined },
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { id } = await params;
  // the lesson player reads ?lesson= from the URL, which needs a Suspense boundary
  return <Suspense><CoursePage id={id} initial={await publicCourse(id)} /></Suspense>;
}
