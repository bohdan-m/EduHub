"use client";

import { IconStar, IconStarFilled } from "@tabler/icons-react";

/** Five stars filled to `value` (rounded to the nearest whole star), with the number read out. */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-highlight-ink" role="img" aria-label={label ?? `${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) =>
        star <= filled ? <IconStarFilled key={star} size={size} aria-hidden /> : <IconStar key={star} size={size} className="text-border-tertiary" aria-hidden />)}
    </span>
  );
}

/** "4.6 ★ (12)" for cards; "New" when nobody has rated yet. */
export function RatingSummary({ average, count }: { average: number | null; count: number }) {
  if (!count || average === null) return <span className="text-sm text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="font-semibold tabular-nums">{average.toFixed(1)}</span>
      <Stars value={average} size={14} />
      <span className="text-muted tabular-nums">({count})</span>
    </span>
  );
}

/** A 1–5 picker built from radio buttons, so arrow keys and screen readers work as for any radio group. */
export function StarInput({ value, onChange, name = "rating" }: { value: number; onChange: (value: number) => void; name?: string }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-1 p-0 text-sm font-medium">Your rating</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer rounded-md p-0.5 text-highlight-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
            <input type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} className="sr-only"
              aria-label={`${star} star${star === 1 ? "" : "s"}`} />
            {star <= value ? <IconStarFilled size={26} aria-hidden /> : <IconStar size={26} className="text-border-tertiary" aria-hidden />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
