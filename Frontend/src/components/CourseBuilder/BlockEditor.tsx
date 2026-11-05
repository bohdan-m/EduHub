"use client";

import { useRef, useState } from "react";
import { Button, Card, Checkbox, FieldError, Input, Label, Spinner, TextArea, TextField, buttonVariants } from "@heroui/react";
import {
  IconAlertTriangle, IconArrowDown, IconArrowUp, IconBulb, IconCopy, IconFileText, IconInfoCircle, IconLink, IconListCheck,
  IconPhoto, IconPlayerPlay, IconPlus, IconTextSize, IconTrash, IconUpload, IconX,
} from "@tabler/icons-react";
import { usersApi } from "@/api/users.api";
import RichTextEditor from "@/components/CourseBuilder/RichTextEditor";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatBytes } from "@/utils/courseMeta";
import { createMatchPair, createQuiz, createQuizOption, validateBlock } from "@/utils/courseForm";
import type { Block, BlockType, CalloutTone, FileBlock, ImageBlock, QuizBlock, QuizKind } from "@/utils/types/courses";
import { LIMITS } from "@/utils/validation";

export const BLOCK_TYPES: { type: BlockType; label: string; icon: typeof IconLink; hint: string }[] = [
  { type: "text", label: "Text", icon: IconTextSize, hint: "Explanations, steps, code" },
  { type: "video", label: "Video", icon: IconPlayerPlay, hint: "A YouTube or Vimeo video" },
  { type: "image", label: "Image", icon: IconPhoto, hint: "A diagram, screenshot or photo" },
  { type: "link", label: "Link", icon: IconLink, hint: "An article, docs or tool" },
  { type: "file", label: "File", icon: IconFileText, hint: "Slides, a worksheet, starter code" },
  { type: "callout", label: "Callout", icon: IconBulb, hint: "A note, tip or warning" },
  { type: "quiz", label: "Quiz", icon: IconListCheck, hint: "A question to check understanding" },
];

const TONES: { tone: CalloutTone; label: string; icon: typeof IconLink }[] = [
  { tone: "info", label: "Note", icon: IconInfoCircle },
  { tone: "tip", label: "Tip", icon: IconBulb },
  { tone: "warning", label: "Warning", icon: IconAlertTriangle },
];

const QUIZ_KINDS: { kind: QuizKind | "truefalse"; label: string }[] = [
  { kind: "choice", label: "Multiple choice" },
  { kind: "truefalse", label: "True / false" },
  { kind: "short", label: "Short answer" },
  { kind: "match", label: "Matching" },
];

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** shown once the author has tried to save */
  error?: string | null;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  isRequired?: boolean;
  description?: string;
  className?: string;
  type?: string;
};

export function Field({ label, value, onChange, error, placeholder, rows, maxLength, isRequired, description, className, type }: FieldProps) {
  return (
    <TextField
      className={className}
      value={value}
      onChange={onChange}
      isInvalid={Boolean(error)}
      isRequired={isRequired}
      type={type}
      fullWidth
    >
      <Label>{label}</Label>
      {rows ? <TextArea rows={rows} placeholder={placeholder} maxLength={maxLength} /> : <Input placeholder={placeholder} maxLength={maxLength} />}
      {description && !error && <p className="m-0 text-xs text-muted">{description}</p>}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}

// Each editor flags only its own fields; validateBlock names the first problem, so match on the field it is about
const errorFor = (error: string | null, ...words: string[]) =>
  error && words.some((w) => error.toLowerCase().includes(w.toLowerCase())) ? error : null;

function AddRowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="self-start" onPress={onPress}>
      <IconPlus size={16} aria-hidden />
      {label}
    </Button>
  );
}

function QuizEditor({ block, update, error }: { block: QuizBlock; update: (b: QuizBlock) => void; error: string | null }) {
  const setOption = (id: string, patch: Partial<QuizBlock["options"][number]>) =>
    update({ ...block, options: block.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const answersError = errorFor(error, "answer");
  const pairsError = errorFor(error, "pair");
  // switching keeps the question and explanation; the answers of the old kind don't carry over
  const switchKind = (kind: QuizKind | "truefalse") =>
    update({ ...createQuiz(kind, block.id), question: block.question, explanation: block.explanation });
  const isTrueFalse = block.kind === "choice" && block.options.length === 2
    && block.options[0].text === "True" && block.options[1].text === "False";
  const currentKind = isTrueFalse ? "truefalse" : block.kind;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quiz type">
        {QUIZ_KINDS.map(({ kind, label }) => (
          <button key={kind} type="button" role="radio" aria-checked={currentKind === kind} onClick={() => currentKind !== kind && switchKind(kind)}
            className={buttonVariants({ size: "sm", variant: currentKind === kind ? "secondary" : "ghost" })}>
            {label}
          </button>
        ))}
      </div>

      <Field label="Question" rows={2} value={block.question} onChange={(question) => update({ ...block, question })}
        error={errorFor(error, "Question")} maxLength={LIMITS.quizQuestion} isRequired
        placeholder={block.kind === "match" ? "Match each SQL command with what it does" : "Which of these is a primary key?"} />

      {block.kind === "choice" && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-medium">
            Answers <span className="font-normal text-muted">· {isTrueFalse ? "tick the right one" : "tick every correct one"}</span>
          </legend>
          {block.options.map((option, i) => (
            <div key={option.id} className="flex items-center gap-2">
              <Checkbox isSelected={option.correct} aria-label={`Answer ${i + 1} is correct`}
                onChange={(correct) => isTrueFalse
                  ? update({ ...block, options: block.options.map((o) => ({ ...o, correct: o.id === option.id ? correct : !correct })) })
                  : setOption(option.id, { correct })}>
                <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
              </Checkbox>
              <TextField className="min-w-0 flex-1" value={option.text} onChange={(text) => setOption(option.id, { text })} isReadOnly={isTrueFalse}
                aria-label={`Answer ${i + 1}`} isInvalid={Boolean(answersError) && !option.text.trim()} fullWidth>
                <Input placeholder={`Answer ${i + 1}`} maxLength={LIMITS.quizOption} />
              </TextField>
              {!isTrueFalse && (
                <Button variant="ghost" size="sm" isIconOnly aria-label={`Remove answer ${i + 1}`} isDisabled={block.options.length <= 2}
                  onPress={() => update({ ...block, options: block.options.filter((o) => o.id !== option.id) })}>
                  <IconX size={16} aria-hidden />
                </Button>
              )}
            </div>
          ))}
          {answersError && <p className="m-0 text-sm text-danger" role="alert">{answersError}</p>}
          {block.options.length < LIMITS.quizOptions && !isTrueFalse && (
            <AddRowButton label="Add answer" onPress={() => update({ ...block, options: [...block.options, createQuizOption()] })} />
          )}
        </fieldset>
      )}

      {block.kind === "short" && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-medium">Accepted answers <span className="font-normal text-muted">· capitals and extra spaces don&rsquo;t matter</span></legend>
          {block.answers.map((accepted, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextField className="min-w-0 flex-1" value={accepted} aria-label={`Accepted answer ${i + 1}`} fullWidth
                isInvalid={Boolean(answersError) && !accepted.trim()}
                onChange={(text) => update({ ...block, answers: block.answers.map((a, j) => (j === i ? text : a)) })}>
                <Input placeholder={i === 0 ? "Paris" : "Another accepted spelling"} maxLength={LIMITS.shortAnswer} />
              </TextField>
              <Button variant="ghost" size="sm" isIconOnly aria-label={`Remove accepted answer ${i + 1}`} isDisabled={block.answers.length <= 1}
                onPress={() => update({ ...block, answers: block.answers.filter((_, j) => j !== i) })}>
                <IconX size={16} aria-hidden />
              </Button>
            </div>
          ))}
          {answersError && <p className="m-0 text-sm text-danger" role="alert">{answersError}</p>}
          {block.answers.length < LIMITS.quizOptions && (
            <AddRowButton label="Add another accepted answer" onPress={() => update({ ...block, answers: [...block.answers, ""] })} />
          )}
        </fieldset>
      )}

      {block.kind === "match" && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm font-medium">Pairs <span className="font-normal text-muted">· learners see the right side shuffled</span></legend>
          {block.pairs.map((pair, i) => (
            <div key={pair.id} className="flex items-center gap-2">
              <TextField className="min-w-0 flex-1" value={pair.left} aria-label={`Pair ${i + 1}, left`} fullWidth isInvalid={Boolean(pairsError) && !pair.left.trim()}
                onChange={(left) => update({ ...block, pairs: block.pairs.map((p) => (p.id === pair.id ? { ...p, left } : p)) })}>
                <Input placeholder="SELECT" maxLength={LIMITS.quizOption} />
              </TextField>
              <span className="text-muted" aria-hidden>→</span>
              <TextField className="min-w-0 flex-1" value={pair.right} aria-label={`Pair ${i + 1}, right`} fullWidth isInvalid={Boolean(pairsError) && !pair.right.trim()}
                onChange={(right) => update({ ...block, pairs: block.pairs.map((p) => (p.id === pair.id ? { ...p, right } : p)) })}>
                <Input placeholder="Reads rows" maxLength={LIMITS.quizOption} />
              </TextField>
              <Button variant="ghost" size="sm" isIconOnly aria-label={`Remove pair ${i + 1}`} isDisabled={block.pairs.length <= 2}
                onPress={() => update({ ...block, pairs: block.pairs.filter((p) => p.id !== pair.id) })}>
                <IconX size={16} aria-hidden />
              </Button>
            </div>
          ))}
          {pairsError && <p className="m-0 text-sm text-danger" role="alert">{pairsError}</p>}
          {block.pairs.length < LIMITS.quizOptions && (
            <AddRowButton label="Add pair" onPress={() => update({ ...block, pairs: [...block.pairs, createMatchPair()] })} />
          )}
        </fieldset>
      )}

      <RichTextEditor compact label="Explanation (optional)" value={block.explanation} onChange={(explanation) => update({ ...block, explanation })}
        error={errorFor(error, "Explanation")} maxLength={LIMITS.quizExplanation} placeholder="Shown after the learner checks their answer" />
    </div>
  );
}

/** Picks a file, uploads it, and stores the returned path on the block; shows what is attached now. */
function UploadField({ block, update, error }: { block: ImageBlock | FileBlock; update: (b: Block) => void; error: string | null }) {
  const kind = block.type;
  const input = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const limit = kind === "image" ? LIMITS.imageBytes : LIMITS.fileBytes;
    if (file.size > limit) {
      setUploadError(`"${file.name}" is over ${formatBytes(limit)}.`);
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const saved = await usersApi.upload(file, kind);
      update(block.type === "image"
        ? { ...block, path: saved.path, url: saved.url }
        : { ...block, path: saved.path, url: saved.url, size: saved.size, name: block.name || saved.name });
    } catch (failure) {
      setUploadError(getApiErrorMessage(failure, "Couldn't upload the file. Try again."));
    }
    setIsUploading(false);
    if (input.current) input.current.value = "";
  };

  const message = uploadError ?? errorFor(error, "Upload");
  return (
    <div className="flex flex-col gap-2">
      {block.type === "image" && block.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.url} alt="" className="max-h-64 w-full rounded-lg bg-surface-secondary object-contain" />
      )}
      {block.type === "file" && block.path && (
        <p className="m-0 flex items-center gap-2 text-sm"><IconFileText size={16} aria-hidden /> Attached · {formatBytes(block.size)}</p>
      )}
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-hidden
        accept={kind === "image" ? "image/png,image/jpeg,image/gif,image/webp" : ".pdf,.zip,.docx,.xlsx,.pptx,.txt,.md,.csv"}
        onChange={(event) => void pick(event.target.files?.[0])} />
      <Button variant="outline" size="sm" className="self-start" isDisabled={isUploading} onPress={() => input.current?.click()}>
        {isUploading ? <Spinner size="sm" /> : <IconUpload size={16} aria-hidden />}
        {block.path ? `Replace ${kind}` : kind === "image" ? "Upload image" : "Upload file"}
      </Button>
      <p className="m-0 text-xs text-muted">
        {kind === "image"
          ? "JPEG, PNG, GIF or WebP, up to 5 MB. Location and camera details are removed."
          : "PDF, ZIP, Word, Excel, PowerPoint, text, Markdown or CSV, up to 20 MB."}
      </p>
      {message && <p className="m-0 text-sm text-danger" role="alert">{message}</p>}
    </div>
  );
}

function Fields({ block, update, error }: { block: Block; update: (b: Block) => void; error: string | null }) {
  switch (block.type) {
    case "text":
      return (
        <RichTextEditor label="Text" value={block.text} onChange={(text) => update({ ...block, text })} error={error} isRequired
          maxLength={LIMITS.blockText} placeholder="Write the lesson here. Use the toolbar for headings, lists, links, code and tables." />
      );
    case "video":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="YouTube or Vimeo link" type="url" value={block.url} onChange={(url) => update({ ...block, url })} error={errorFor(error, "YouTube")}
            isRequired placeholder="https://www.youtube.com/watch?v=…" />
          <Field label="Caption (optional)" value={block.caption} onChange={(caption) => update({ ...block, caption })} maxLength={LIMITS.videoCaption} />
        </div>
      );
    case "image":
      return (
        <div className="flex flex-col gap-4">
          <UploadField block={block} update={update} error={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Description for screen readers" value={block.alt} onChange={(alt) => update({ ...block, alt })} error={errorFor(error, "Image description")}
              isRequired maxLength={LIMITS.imageAlt} placeholder="Diagram of a table with three columns" />
            <Field label="Caption (optional)" value={block.caption} onChange={(caption) => update({ ...block, caption })} maxLength={LIMITS.videoCaption} />
          </div>
        </div>
      );
    case "link":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Web address" type="url" value={block.url} onChange={(url) => update({ ...block, url })} error={errorFor(error, "Add a link", "web address")}
            isRequired placeholder="https://…" />
          <Field label="Title" value={block.title} onChange={(title) => update({ ...block, title })} error={errorFor(error, "Link title")}
            isRequired maxLength={LIMITS.linkTitle} placeholder="Official documentation" />
          <Field className="sm:col-span-2" label="Why open it (optional)" value={block.description} onChange={(description) => update({ ...block, description })}
            error={errorFor(error, "Description")} maxLength={LIMITS.linkDescription} />
        </div>
      );
    case "file":
      return (
        <div className="flex flex-col gap-4">
          <UploadField block={block} update={update} error={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name shown to learners" value={block.name} onChange={(name) => update({ ...block, name })} error={errorFor(error, "File name")}
              isRequired maxLength={LIMITS.linkTitle} placeholder="Lesson slides.pdf" />
            <Field label="What it's for (optional)" value={block.description} onChange={(description) => update({ ...block, description })}
              error={errorFor(error, "Description")} maxLength={LIMITS.fileDescription} />
          </div>
        </div>
      );
    case "callout":
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Callout style">
            {TONES.map(({ tone, label, icon: Icon }) => (
              <button key={tone} type="button" role="radio" aria-checked={block.tone === tone} onClick={() => update({ ...block, tone })}
                className={buttonVariants({ size: "sm", variant: block.tone === tone ? "secondary" : "ghost" })}>
                <Icon size={16} aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <RichTextEditor compact label="Text" value={block.text} onChange={(text) => update({ ...block, text })} error={error} isRequired
            maxLength={LIMITS.calloutText} placeholder="Something worth pointing out" />
        </div>
      );
    case "quiz":
      return <QuizEditor block={block} update={update} error={error} />;
  }
}

type BlockEditorProps = {
  block: Block;
  index: number;
  count: number;
  showErrors: boolean;
  onChange: (block: Block) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
};

function BlockEditor({ block, index, count, showErrors, onChange, onMove, onRemove, onDuplicate }: BlockEditorProps) {
  const meta = BLOCK_TYPES.find((t) => t.type === block.type)!;
  const Icon = meta.icon;
  const error = showErrors ? validateBlock(block) : null;

  return (
    <Card className={`gap-4 p-4 sm:p-5 ${error ? "ring-1 ring-danger/50" : ""}`}>
      <div className="flex items-center gap-1">
        <span className="mr-1 flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground" aria-hidden><Icon size={16} /></span>
        <h3 className="m-0 flex-1 text-sm font-semibold">{meta.label} <span className="font-normal text-muted">· block {index + 1}</span></h3>
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Move block ${index + 1} up`} isDisabled={index === 0} onPress={() => onMove(-1)}>
          <IconArrowUp size={16} aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Move block ${index + 1} down`} isDisabled={index === count - 1} onPress={() => onMove(1)}>
          <IconArrowDown size={16} aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Duplicate block ${index + 1}`} onPress={onDuplicate}>
          <IconCopy size={16} aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Delete block ${index + 1}`} onPress={onRemove}>
          <IconTrash size={16} aria-hidden />
        </Button>
      </div>
      <Fields block={block} update={onChange} error={error} />
    </Card>
  );
}

export default BlockEditor;
