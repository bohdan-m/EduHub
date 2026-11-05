"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Spinner } from "@heroui/react";
import { IconAlertCircle } from "@tabler/icons-react";
import { communityApi, type Reported } from "@/api/community.api";
import { getApiErrorMessage } from "@/utils/apiError";

const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** The moderators' queue: everything with open reports, most reported first. Keep it, or remove it for good. */
export default function ModerationPage() {
  const [items, setItems] = useState<Reported[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Moderation · EduHub";
    communityApi.openReports().then(setItems)
      .catch((failure) => setError(failure?.response?.status === 403 ? "Only moderators can see this page." : "Couldn't load the reports."));
  }, []);

  const decide = async (item: Reported, action: "keep" | "remove") => {
    if (action === "remove" && !window.confirm(`Remove this ${item.target_type} for good?`)) return;
    const key = `${item.target_type}-${item.target_id}`;
    setBusy(key);
    try {
      await communityApi.decide(item.target_type, item.target_id, action);
      setItems((list) => list?.filter((x) => `${x.target_type}-${x.target_id}` !== key) ?? null);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "That didn't work. Try again."));
    }
    setBusy(null);
  };

  return (
    <div className="mt-4 flex flex-col gap-6 pb-6">
      <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold tracking-tight">Moderation</h1>
      {error && (
        <Alert status="danger"><Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>
      )}
      {!items && !error && <div className="flex items-center gap-3 text-muted" role="status"><Spinner size="sm" /> Loading reports…</div>}
      {items?.length === 0 && <p className="m-0 text-muted">Nothing to review right now.</p>}
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {items?.map((item) => {
          const key = `${item.target_type}-${item.target_id}`;
          return (
            <li key={key}>
              <Card className="gap-3 p-5">
                <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="rounded-full bg-default px-2 py-0.5 font-medium capitalize">{item.target_type}</span>
                  <span>{item.reports === 1 ? "1 report" : `${item.reports} reports`}: {item.reasons.join(", ")}</span>
                  {item.is_hidden && <span className="text-danger">Hidden</span>}
                  <span className="text-muted">since {when.format(new Date(item.first_reported_at))}</span>
                </p>
                <blockquote className="m-0 border-l-2 border-border pl-3 whitespace-pre-line [overflow-wrap:anywhere]">{item.preview}</blockquote>
                {item.details.length > 0 && (
                  <ul className="m-0 list-disc pl-5 text-sm text-muted">{item.details.map((detail, i) => <li key={i}>{detail}</li>)}</ul>
                )}
                <div className="flex flex-wrap gap-2">
                  {item.course_id && <Link className="self-center text-sm" href={`/courses/${item.course_id}`}>Open the course</Link>}
                  <span className="flex-1" />
                  <Button size="sm" variant="outline" isDisabled={busy === key} onPress={() => decide(item, "keep")}>Keep and close reports</Button>
                  <Button size="sm" variant="danger" isDisabled={busy === key} onPress={() => decide(item, "remove")}>Remove</Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
