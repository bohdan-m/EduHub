import { IconAlertTriangle, IconBulb, IconExternalLink, IconInfoCircle, IconLink } from "@tabler/icons-react";
import Markdown from "@/components/Lesson/Markdown";
import QuizView, { type GradeQuiz } from "@/components/Lesson/QuizView";
import { gradeLocally, isFullQuiz } from "@/utils/quiz";
import type { CalloutTone, LessonBlock } from "@/utils/types/courses";
import { getYoutubeEmbedUrl } from "@/utils/youtube";

const CALLOUTS: Record<CalloutTone, { label: string; icon: typeof IconBulb; className: string }> = {
  info: { label: "Note", icon: IconInfoCircle, className: "border-accent/30 bg-accent-soft text-accent-soft-foreground" },
  tip: { label: "Tip", icon: IconBulb, className: "border-highlight/40 bg-highlight/10 text-foreground" },
  warning: { label: "Watch out", icon: IconAlertTriangle, className: "border-danger/30 bg-danger/10 text-foreground" },
};

function BlockView({ block, grade }: { block: LessonBlock; grade: GradeQuiz }) {
  switch (block.type) {
    case "text":
      return <Markdown text={block.text} />;
    case "video": {
      const src = getYoutubeEmbedUrl(block.url);
      if (!src) return null;
      return (
        <figure className="m-0 flex flex-col gap-2">
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe
              className="size-full border-0"
              src={src}
              title={block.caption || "Lesson video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          {block.caption && <figcaption className="text-sm text-muted">{block.caption}</figcaption>}
        </figure>
      );
    }
    case "link": {
      let host = "";
      try {
        host = new URL(block.url).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 no-underline transition-colors hover:border-accent/50 hover:bg-surface-secondary"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground" aria-hidden>
            <IconLink size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 font-medium text-foreground [overflow-wrap:anywhere]">
              {block.title}
              <IconExternalLink size={14} className="shrink-0 text-muted" aria-label="(opens in a new tab)" />
            </span>
            {block.description && <span className="mt-0.5 block text-sm text-muted">{block.description}</span>}
            <span className="mt-1 block text-xs text-muted">{host}</span>
          </span>
        </a>
      );
    }
    case "callout": {
      const { label, icon: Icon, className } = CALLOUTS[block.tone];
      return (
        <aside className={`flex gap-3 rounded-xl border p-4 ${className}`} aria-label={label}>
          <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="m-0 mb-1 text-sm font-semibold">{label}</p>
            <Markdown text={block.text} />
          </div>
        </aside>
      );
    }
    case "quiz":
      return <QuizView quiz={block} grade={grade} />;
  }
}

// The builder's preview has every answer at hand (and nothing saved yet to ask the API about)
const gradeHere: GradeQuiz = async (quiz, selected) => {
  if (!isFullQuiz(quiz)) throw new Error("This quiz can only be checked by the server.");
  return gradeLocally(quiz, selected);
};

/** A lesson as learners see it; the course builder's preview uses it too. Pass `grade` to have the API check quizzes. */
function LessonContent({ blocks, grade = gradeHere }: { blocks: LessonBlock[]; grade?: GradeQuiz }) {
  if (blocks.length === 0) {
    return <p className="m-0 rounded-xl border border-dashed border-border-tertiary px-6 py-10 text-center text-muted">This lesson has no content yet.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block) => <BlockView key={block.id} block={block} grade={grade} />)}
    </div>
  );
}

export default LessonContent;
