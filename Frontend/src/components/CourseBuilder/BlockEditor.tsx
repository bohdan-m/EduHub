"use client";

import { Button, Card, Checkbox, FieldError, Input, Label, TextArea, TextField, buttonVariants } from "@heroui/react";
import {
  IconAlertTriangle, IconArrowDown, IconArrowUp, IconBulb, IconInfoCircle, IconLink, IconListCheck,
  IconPlayerPlay, IconPlus, IconTextSize, IconTrash, IconX,
} from "@tabler/icons-react";
import RichTextEditor from "@/components/CourseBuilder/RichTextEditor";
import { createQuizOption, validateBlock } from "@/utils/courseForm";
import type { Block, BlockType, CalloutTone, QuizBlock } from "@/utils/types/courses";
import { LIMITS } from "@/utils/validation";

export const BLOCK_TYPES: { type: BlockType; label: string; icon: typeof IconLink; hint: string }[] = [
  { type: "text", label: "Text", icon: IconTextSize, hint: "Explanations, steps, code" },
  { type: "video", label: "Video", icon: IconPlayerPlay, hint: "A YouTube video" },
  { type: "link", label: "Link", icon: IconLink, hint: "An article, docs or tool" },
  { type: "callout", label: "Callout", icon: IconBulb, hint: "A note, tip or warning" },
  { type: "quiz", label: "Quiz", icon: IconListCheck, hint: "A question to check understanding" },
];

const TONES: { tone: CalloutTone; label: string; icon: typeof IconLink }[] = [
  { tone: "info", label: "Note", icon: IconInfoCircle },
  { tone: "tip", label: "Tip", icon: IconBulb },
  { tone: "warning", label: "Warning", icon: IconAlertTriangle },
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

function QuizEditor({ block, update, error }: { block: QuizBlock; update: (b: QuizBlock) => void; error: string | null }) {
  const setOption = (id: string, patch: Partial<QuizBlock["options"][number]>) =>
    update({ ...block, options: block.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const answersError = errorFor(error, "answer");

  return (
    <div className="flex flex-col gap-4">
      <Field label="Question" rows={2} value={block.question} onChange={(question) => update({ ...block, question })}
        error={errorFor(error, "Question")} maxLength={LIMITS.quizQuestion} isRequired placeholder="Which of these is a primary key?" />

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 p-0 text-sm font-medium">Answers <span className="font-normal text-muted">· tick every correct one</span></legend>
        {block.options.map((option, i) => (
          <div key={option.id} className="flex items-center gap-2">
            <Checkbox isSelected={option.correct} onChange={(correct) => setOption(option.id, { correct })} aria-label={`Answer ${i + 1} is correct`}>
              <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
            </Checkbox>
            <TextField className="min-w-0 flex-1" value={option.text} onChange={(text) => setOption(option.id, { text })}
              aria-label={`Answer ${i + 1}`} isInvalid={Boolean(answersError) && !option.text.trim()} fullWidth>
              <Input placeholder={`Answer ${i + 1}`} maxLength={LIMITS.quizOption} />
            </TextField>
            <Button variant="ghost" size="sm" isIconOnly aria-label={`Remove answer ${i + 1}`} isDisabled={block.options.length <= 2}
              onPress={() => update({ ...block, options: block.options.filter((o) => o.id !== option.id) })}>
              <IconX size={16} aria-hidden />
            </Button>
          </div>
        ))}
        {answersError && <p className="m-0 text-sm text-danger" role="alert">{answersError}</p>}
        {block.options.length < LIMITS.quizOptions && (
          <Button variant="ghost" size="sm" className="self-start" onPress={() => update({ ...block, options: [...block.options, createQuizOption()] })}>
            <IconPlus size={16} aria-hidden />
            Add answer
          </Button>
        )}
      </fieldset>

      <RichTextEditor compact label="Explanation (optional)" value={block.explanation} onChange={(explanation) => update({ ...block, explanation })}
        error={errorFor(error, "Explanation")} maxLength={LIMITS.quizExplanation} placeholder="Shown after the learner checks their answer" />
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
          <Field label="YouTube link" type="url" value={block.url} onChange={(url) => update({ ...block, url })} error={errorFor(error, "YouTube")}
            isRequired placeholder="https://www.youtube.com/watch?v=…" />
          <Field label="Caption (optional)" value={block.caption} onChange={(caption) => update({ ...block, caption })} maxLength={LIMITS.videoCaption} />
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
};

function BlockEditor({ block, index, count, showErrors, onChange, onMove, onRemove }: BlockEditorProps) {
  const meta = BLOCK_TYPES.find((t) => t.type === block.type)!;
  const Icon = meta.icon;
  const error = showErrors ? validateBlock(block) : null;

  return (
    <Card className={`gap-4 p-4 sm:p-5 ${error ? "ring-1 ring-danger/50" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground" aria-hidden><Icon size={16} /></span>
        <h3 className="m-0 flex-1 text-sm font-semibold">{meta.label} <span className="font-normal text-muted">· block {index + 1}</span></h3>
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Move block ${index + 1} up`} isDisabled={index === 0} onPress={() => onMove(-1)}>
          <IconArrowUp size={16} aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" isIconOnly aria-label={`Move block ${index + 1} down`} isDisabled={index === count - 1} onPress={() => onMove(1)}>
          <IconArrowDown size={16} aria-hidden />
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
