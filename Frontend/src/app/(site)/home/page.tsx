import { Suspense } from "react";
import type { Metadata } from "next";
import CoursesList from "@/components/Courses/CoursesList";

export const metadata: Metadata = {
  title: "Browse courses",
  description: "Free courses written by the EduHub community: programming, data, design, business and more.",
};

export default function Home() {
  // the filters read the URL's query string, which needs a Suspense boundary
  return (
    <Suspense>
      <CoursesList />
    </Suspense>
  );
}
