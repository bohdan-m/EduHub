"use client";

import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import { IconFlag } from "@tabler/icons-react";
import { communityApi, type ReportReason, type ReportTarget } from "@/api/community.api";
import { getApiErrorMessage } from "@/utils/apiError";

const REASONS: Record<ReportReason, string> = {
  spam: "Spam or advertising",
  abuse: "Harassment or hate",
  inappropriate: "Inappropriate content",
  misleading: "Misleading or wrong",
  copyright: "Copies someone else's work",
  other: "Something else",
};

/** Flags a course, review or comment for the moderators. Enough reports hide it until someone looks. */
function ReportButton({ target, id, label = "Report" }: { target: ReportTarget; id: number; label?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const send = async () => {
    setIsSending(true);
    setError(null);
    try {
      await communityApi.report(target, id, reason, details.trim());
      setIsSent(true);
    } catch (failure) {
      setError(getApiErrorMessage(failure, "Couldn't send the report. Try again."));
    }
    setIsSending(false);
  };

  if (isSent) return <span className="text-xs text-muted" role="status">Reported. Thank you.</span>;

  return (
    <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button variant="ghost" size="sm" className="text-muted">
        <IconFlag size={14} aria-hidden />
        {label}
      </Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-w-md">
            <Modal.Header>
              <Modal.Heading>Report this {target}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 p-0 text-sm font-medium">What&rsquo;s wrong?</legend>
                {(Object.entries(REASONS) as [ReportReason, string][]).map(([value, text]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={`reason-${target}-${id}`} value={value} checked={reason === value} onChange={() => setReason(value)} />
                    {text}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Details (optional)
                <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={3}
                  className="rounded-xl border border-border bg-field px-3 py-2 font-normal outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30" />
              </label>
              {error && <p className="m-0 text-sm text-danger" role="alert">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" slot="close" isDisabled={isSending}>Cancel</Button>
              <Button variant="danger" onPress={send} isPending={isSending}>Send report</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export default ReportButton;
