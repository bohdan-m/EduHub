import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Certificate } from "@/api/learning.api";
import Brand from "@/components/Brand";
import PrintButton from "@/components/PrintButton";
import { serverApi, siteUrl } from "@/lib/serverApi";
import { plural } from "@/utils/courseMeta";

type Props = { params: Promise<{ code: string }> };

const load = (code: string) => (/^[\w-]{6,40}$/.test(code) ? serverApi<Certificate>(`/certificates/${code}/`, 300) : Promise.resolve(null));
const dateFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const certificate = await load((await params).code);
  if (!certificate) return { title: "Certificate" };
  return {
    title: `${certificate.learner_name} completed ${certificate.course_title}`,
    robots: { index: false }, // a learner's name: shareable by link, not searchable
  };
}

/** A public, printable certificate. Its URL is the proof: anyone with it can check it here. */
export default async function CertificatePage({ params }: Props) {
  const { code } = await params;
  const certificate = await load(code);
  if (!certificate) notFound();

  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 py-8 print:py-0">
      <div className="flex w-full max-w-3xl items-center justify-between print:hidden">
        <Brand />
        <PrintButton />
      </div>
      <article className="flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl border-4 border-double border-accent/50 bg-surface px-8 py-14 text-center sm:px-16 print:border-accent print:shadow-none">
        <p className="m-0 text-sm font-medium tracking-[0.2em] text-accent uppercase">Certificate of completion</p>
        <p className="m-0 text-muted">This certifies that</p>
        <h1 className="m-0 text-[clamp(28px,5vw,44px)] font-semibold tracking-tight [overflow-wrap:anywhere]">{certificate.learner_name}</h1>
        <p className="m-0 text-muted">completed every lesson of</p>
        <h2 className="m-0 text-[clamp(20px,3vw,28px)] font-semibold text-balance [overflow-wrap:anywhere]">{certificate.course_title}</h2>
        <p className="m-0 text-sm text-muted">
          {plural(certificate.lesson_count, "lesson")} · by {certificate.author_name} · on {dateFormat.format(new Date(certificate.completed_at))}
        </p>
        <div className="mt-6 flex w-full flex-col items-center gap-1 border-t border-separator pt-6 text-xs text-muted">
          <span>Certificate ID {certificate.code}</span>
          <span>Check it at {siteUrl}/certificates/{certificate.code}</span>
        </div>
      </article>
      <Link href={`/courses/${certificate.course_id}`} className="text-sm print:hidden">View the course</Link>
    </div>
  );
}
