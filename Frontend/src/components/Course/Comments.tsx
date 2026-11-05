"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Button, Spinner } from "@heroui/react";
import { communityApi, type Comment } from "@/api/community.api";
import ReportButton from "@/components/ReportButton";
import { getApiErrorMessage } from "@/utils/apiError";
import { LIMITS } from "@/utils/validation";

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const textareaClass = "w-full rounded-xl border border-border bg-field px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

function CommentForm({ placeholder, submitLabel, initial = "", onSubmit, onCancel }: {
  placeholder: string; submitLabel: string; initial?: string; onSubmit: (body: string) => Promise<void>; onCancel?: () => void;
}) {
  const fieldId = useId();
  const [body, setBody] = useState(initial);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't post that. Try again."));
    }
    setIsSending(false);
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <label className="sr-only" htmlFor={fieldId}>{placeholder}</label>
      <textarea id={fieldId}className={textareaClass} rows={3} maxLength={LIMITS.comment} placeholder={placeholder}
        value={body} onChange={(event) => setBody(event.target.value)} />
      {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" isDisabled={!body.trim()} isPending={isSending}>{submitLabel}</Button>
        {onCancel && <Button size="sm" variant="ghost" onPress={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}

function CommentItem({ comment, isSignedIn, onReply, onChanged, onDeleted }: {
  comment: Comment; isSignedIn: boolean; onReply?: (body: string) => Promise<void>;
  onChanged: (comment: Comment) => void; onDeleted: (id: number) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "reply">("view");
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm("Delete this comment? Replies to it go too.")) return;
    try {
      await communityApi.deleteComment(comment.id);
      onDeleted(comment.id);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't delete it. Try again."));
    }
  };

  return (
    <article className="flex flex-col gap-1.5" aria-label={`Comment by ${comment.author.name}`}>
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold">{comment.author.name}</span>
        {comment.is_course_author && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-foreground">Author</span>}
        <time className="text-xs text-muted" dateTime={comment.created_at}>{when.format(new Date(comment.created_at))}</time>
        {comment.edited_at && <span className="text-xs text-muted">(edited)</span>}
      </p>
      {mode === "edit" ? (
        <CommentForm placeholder="Edit your comment" submitLabel="Save" initial={comment.body} onCancel={() => setMode("view")}
          onSubmit={async (body) => { onChanged(await communityApi.editComment(comment.id, body)); setMode("view"); }} />
      ) : (
        <p className="m-0 text-[15px] whitespace-pre-line [overflow-wrap:anywhere]">{comment.body}</p>
      )}
      {mode === "view" && (
        <div className="-ml-2 flex flex-wrap items-center gap-1">
          {onReply && isSignedIn && <Button size="sm" variant="ghost" onPress={() => setMode("reply")}>Reply</Button>}
          {comment.can_edit && <Button size="sm" variant="ghost" onPress={() => setMode("edit")}>Edit</Button>}
          {comment.can_delete && <Button size="sm" variant="ghost" className="text-danger" onPress={remove}>Delete</Button>}
          {isSignedIn && !comment.can_edit && <ReportButton target="comment" id={comment.id} />}
        </div>
      )}
      {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
      {mode === "reply" && onReply && (
        <CommentForm placeholder={`Reply to ${comment.author.name}`} submitLabel="Reply" onCancel={() => setMode("view")}
          onSubmit={async (body) => { await onReply(body); setMode("view"); }} />
      )}
    </article>
  );
}

/** Questions and discussion under one lesson; replies are one level deep. */
function Comments({ courseId, lessonId, isSignedIn, isDraft }: { courseId: number; lessonId: number; isSignedIn: boolean; isDraft: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = (offset = 0) =>
    communityApi.comments(courseId, lessonId, offset)
      .then((page) => {
        setCount(page.count);
        setComments((current) => (offset === 0 ? page.results : [...current, ...page.results]));
      })
      .catch(() => setLoadError(true))
      .finally(() => setIsLoading(false));

  // mounted per lesson (keyed by the player), so a slow answer for a lesson already left can't land here
  useEffect(() => {
    if (isDraft) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isDraft) return null;

  const replace = (next: Comment) =>
    setComments((list) => list.map((c) => (c.id === next.id ? { ...next, replies: c.replies }
      : { ...c, replies: c.replies.map((r) => (r.id === next.id ? next : r)) })));
  const remove = (id: number) => {
    setComments((list) => list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) })));
    setCount((n) => Math.max(0, n - 1));
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="discussion-heading">
      <h2 id="discussion-heading" className="m-0 text-lg font-semibold">Discussion {count > 0 && <span className="font-normal text-muted">· {count}</span>}</h2>
      {isSignedIn ? (
        <CommentForm placeholder="Ask a question or share a thought about this lesson" submitLabel="Post"
          onSubmit={async (body) => { const added = await communityApi.addComment(courseId, lessonId, body); setComments((list) => [added, ...list]); setCount((n) => n + 1); }} />
      ) : (
        <p className="m-0 text-sm text-muted"><Link href="/login">Log in</Link> to join the discussion.</p>
      )}
      {isLoading ? (
        <p className="m-0 flex items-center gap-2 text-sm text-muted" role="status"><Spinner size="sm" /> Loading comments…</p>
      ) : loadError ? (
        <p className="m-0 text-sm text-danger" role="alert">Couldn&rsquo;t load the discussion.</p>
      ) : comments.length === 0 ? (
        <p className="m-0 text-sm text-muted">No comments yet. Questions are welcome.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-5 p-0">
          {comments.map((comment) => (
            <li key={comment.id} className="flex flex-col gap-3">
              <CommentItem comment={comment} isSignedIn={isSignedIn} onChanged={replace} onDeleted={remove}
                onReply={async (body) => {
                  const reply = await communityApi.addComment(courseId, lessonId, body, comment.id);
                  setComments((list) => list.map((c) => (c.id === comment.id ? { ...c, replies: [...c.replies, reply] } : c)));
                }} />
              {comment.replies.length > 0 && (
                <ul className="m-0 ml-4 flex list-none flex-col gap-4 border-l-2 border-separator p-0 pl-4">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}><CommentItem comment={reply} isSignedIn={isSignedIn} onChanged={replace} onDeleted={remove} /></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {comments.length < count && !isLoading && (
        <Button size="sm" variant="outline" className="self-start" onPress={() => void load(comments.length)}>Show more</Button>
      )}
    </section>
  );
}

export default Comments;
