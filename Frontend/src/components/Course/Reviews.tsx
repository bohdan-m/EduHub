"use client";

import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { communityApi, type Review, type ReviewPage } from "@/api/community.api";
import ReportButton from "@/components/ReportButton";
import { StarInput, Stars } from "@/components/Stars";
import { getApiErrorMessage } from "@/utils/apiError";
import { LIMITS } from "@/utils/validation";

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const textareaClass = "w-full rounded-xl border border-border bg-field px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

function ReviewForm({ courseId, existing, onSaved, onDeleted }: {
  courseId: number; existing: Review | null; onSaved: (review: Review) => void; onDeleted: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) return setError("Pick a rating from 1 to 5 stars.");
    setIsSaving(true);
    setError(null);
    try {
      onSaved(await communityApi.saveReview(courseId, rating, text.trim()));
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't save your review. Try again."));
    }
    setIsSaving(false);
  };

  const remove = async () => {
    if (!window.confirm("Delete your review?")) return;
    try {
      await communityApi.deleteReview(courseId);
      onDeleted();
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't delete your review. Try again."));
    }
  };

  return (
    <form className="flex flex-col gap-3 rounded-xl bg-surface-secondary p-4" onSubmit={save} aria-label="Your review">
      <StarInput value={rating} onChange={setRating} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        What did you think? (optional)
        <textarea className={`${textareaClass} font-normal`} rows={3} maxLength={LIMITS.review} value={text} onChange={(event) => setText(event.target.value)}
          placeholder="What was useful, what was missing, who would you recommend it to?" />
      </label>
      {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" isPending={isSaving}>{existing ? "Update review" : "Post review"}</Button>
        {existing && <Button size="sm" variant="ghost" className="text-danger" onPress={remove}>Delete</Button>}
      </div>
    </form>
  );
}

function AuthorReply({ review, onSaved }: { review: Review; onSaved: (review: Review) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(review.author_reply);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      onSaved(await communityApi.reply(review.id, text.trim()));
      setIsEditing(false);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't save the reply."));
    }
  };

  if (!isEditing) {
    return <Button size="sm" variant="ghost" className="-ml-2 self-start" onPress={() => setIsEditing(true)}>{review.author_reply ? "Edit reply" : "Reply"}</Button>;
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`reply-${review.id}`}>Your reply</label>
      <textarea id={`reply-${review.id}`} className={textareaClass} rows={2} maxLength={LIMITS.review} value={text} onChange={(event) => setText(event.target.value)} />
      {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onPress={save}>Save reply</Button>
        <Button size="sm" variant="ghost" onPress={() => setIsEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

/** Rating summary, the learner's own review form (once they finished a lesson), and everyone's reviews. */
function Reviews({ courseId, canReview, hasMyReview, isOwner, isSignedIn, onChanged }: {
  courseId: number; canReview: boolean; hasMyReview: boolean; isOwner: boolean; isSignedIn: boolean; onChanged: () => void;
}) {
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [mine, setMine] = useState<Review | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    communityApi.reviews(courseId).then(setPage).catch(() => setError(true));
    if (canReview && hasMyReview) communityApi.myReview(courseId).then(setMine).catch(() => setMine(null));
  }, [courseId, canReview, hasMyReview]);

  const reload = () => {
    communityApi.reviews(courseId).then(setPage).catch(() => setError(true));
    onChanged();
  };
  const loadMore = async () => {
    if (!page) return;
    const more = await communityApi.reviews(courseId, page.results.length);
    setPage({ ...more, results: [...page.results, ...more.results] });
  };

  const total = page?.count ?? 0;
  const average = total ? Object.entries(page!.distribution).reduce((sum, [stars, n]) => sum + Number(stars) * n, 0) / total : 0;

  return (
    <section className="flex flex-col gap-5" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="m-0 text-2xl font-semibold">Reviews</h2>
      {!page ? (
        error ? <p className="m-0 text-sm text-danger" role="alert">Couldn&rsquo;t load reviews.</p>
          : <p className="m-0 flex items-center gap-2 text-sm text-muted" role="status"><Spinner size="sm" /> Loading reviews…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {total ? (
              <>
                <p className="m-0 text-4xl font-semibold tabular-nums">{average.toFixed(1)}</p>
                <Stars value={average} />
                <p className="m-0 text-sm text-muted">{total === 1 ? "1 review" : `${total} reviews`}</p>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0" aria-label="Ratings by stars">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const n = page.distribution[String(stars)] ?? 0;
                    return (
                      <li key={stars} className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-3 tabular-nums">{stars}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-default">
                          <span className="block h-full rounded-full bg-highlight-ink" style={{ width: `${(n / total) * 100}%` }} />
                        </span>
                        <span className="w-6 text-right tabular-nums">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : <p className="m-0 text-sm text-muted">No reviews yet.</p>}
          </div>

          <div className="flex flex-col gap-5">
            {canReview && (
              <ReviewForm key={mine?.id ?? "new"} courseId={courseId} existing={mine}
                onSaved={(review) => { setMine(review); reload(); }} onDeleted={() => { setMine(null); reload(); }} />
            )}
            {!canReview && isSignedIn && !isOwner && (
              <p className="m-0 text-sm text-muted">Finish a lesson of this course to review it.</p>
            )}
            <ul className="m-0 flex list-none flex-col divide-y divide-separator p-0">
              {page.results.map((review) => (
                <li key={review.id} className="flex flex-col gap-1.5 py-4 first:pt-0">
                  <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-semibold">{review.reviewer.name}</span>
                    <Stars value={review.rating} size={14} />
                    <time className="text-xs text-muted" dateTime={review.updated_at}>{when.format(new Date(review.updated_at))}</time>
                  </p>
                  {review.text && <p className="m-0 text-[15px] whitespace-pre-line [overflow-wrap:anywhere]">{review.text}</p>}
                  {review.author_reply && (
                    <div className="mt-1 rounded-lg bg-surface-secondary p-3 text-sm">
                      <p className="m-0 mb-1 text-xs font-semibold text-muted">Reply from the author</p>
                      <p className="m-0 whitespace-pre-line [overflow-wrap:anywhere]">{review.author_reply}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    {isOwner && <AuthorReply review={review}
                      onSaved={(saved) => setPage((current) => current && { ...current, results: current.results.map((r) => (r.id === saved.id ? saved : r)) })} />}
                    {isSignedIn && !review.is_mine && !isOwner && <ReportButton target="review" id={review.id} />}
                  </div>
                </li>
              ))}
            </ul>
            {page.results.length < total && <Button size="sm" variant="outline" className="self-start" onPress={loadMore}>Show more reviews</Button>}
          </div>
        </div>
      )}
    </section>
  );
}

export default Reviews;
