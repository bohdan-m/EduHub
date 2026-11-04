"use client";

import { useId, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table";
import { Button, Input, TextField, buttonVariants } from "@heroui/react";
import {
  IconArrowBackUp, IconArrowForwardUp, IconBlockquote, IconBold, IconCode, IconColumnInsertRight, IconColumnRemove,
  IconH2, IconH3, IconItalic, IconLink, IconList, IconListNumbers, IconRowInsertBottom, IconRowRemove,
  IconSeparatorHorizontal, IconSourceCode, IconStrikethrough, IconTable, IconTableOff,
} from "@tabler/icons-react";
import { validateWebUrl } from "@/utils/validation";

type RichTextEditorProps = {
  label: string;
  /** Markdown in and out: lessons are stored as Markdown, which the learner view and (later) the AI both use */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  error?: string | null;
  maxLength?: number;
  isRequired?: boolean;
  /** inline formatting and lists only, for short texts like callouts */
  compact?: boolean;
};

function ToolButton({ label, icon, isActive, isDisabled, onPress }: {
  label: string; icon: ReactNode; isActive?: boolean; isDisabled?: boolean; onPress: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      disabled={isDisabled}
      // keep the text selection: a normal click would move focus out of the editor first
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      className={buttonVariants({
        variant: isActive ? "secondary" : "ghost",
        size: "sm",
        isIconOnly: true,
        className: `size-8 min-w-8 ${isActive ? "text-accent-soft-foreground" : "text-muted"}`,
      })}
    >
      {icon}
    </button>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-separator" aria-hidden />;

function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [url, setUrl] = useState<string>(editor.getAttributes("link").href ?? "");
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const problem = validateWebUrl(url);
    if (problem) return setError(problem);
    const chain = editor.chain().focus().extendMarkRange("link");
    // no selection: insert the address itself as the link text
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: url.trim(), marks: [{ type: "link", attrs: { href: url.trim() } }] }).run();
    } else {
      chain.setLink({ href: url.trim() }).run();
    }
    onDone();
  };

  return (
    <div className="flex flex-wrap items-start gap-2 border-b border-separator bg-surface-secondary px-2 py-2">
      <TextField className="min-w-48 flex-1" value={url} onChange={(value) => { setUrl(value); setError(null); }}
        aria-label="Link address" isInvalid={Boolean(error)} autoFocus>
        <Input placeholder="https://…" onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); apply(); }
          if (event.key === "Escape") onDone();
        }} />
        {error && <p className="m-0 mt-1 text-xs text-danger" role="alert">{error}</p>}
      </TextField>
      <Button size="sm" onPress={apply}>Apply</Button>
      {editor.isActive("link") && (
        <Button size="sm" variant="ghost" onPress={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); onDone(); }}>Remove link</Button>
      )}
      <Button size="sm" variant="ghost" onPress={onDone}>Cancel</Button>
    </div>
  );
}

function RichTextEditor({ label, value, onChange, placeholder, error, maxLength, isRequired, compact }: RichTextEditorProps) {
  const labelId = useId();
  const errorId = useId();
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [length, setLength] = useState(value.length);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: compact ? false : { levels: [2, 3] },
        codeBlock: compact ? false : {},
        horizontalRule: compact ? false : {},
        underline: false, // Markdown has no underline
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Markdown,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(compact ? [] : [TableKit.configure({ table: { resizable: false } })]),
    ],
    content: value,
    contentType: "markdown",
    immediatelyRender: false, // rendered on the client only; avoids a server/client mismatch in Next.js
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();
      setLength(markdown.length);
      onChange(markdown);
    },
    editorProps: {
      attributes: {
        class: `lesson-prose tiptap-content ${compact ? "min-h-20" : "min-h-44"} px-3 py-2.5 outline-none`,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        ...(error ? { "aria-invalid": "true", "aria-describedby": errorId } : {}),
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? {
      bold: e.isActive("bold"), italic: e.isActive("italic"), strike: e.isActive("strike"), code: e.isActive("code"),
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"), link: e.isActive("link"), table: e.isActive("table"),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
    } : null),
  });

  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
    if (editor) command(editor.chain().focus()).run();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium">
        {label}{isRequired && <span className="text-danger" aria-hidden> *</span>}
      </span>
      <div className={`overflow-hidden rounded-xl border bg-surface transition-colors focus-within:border-accent ${error ? "border-danger" : "border-border"}`}>
        <div className="flex flex-wrap items-center gap-0.5 border-b border-separator bg-surface-secondary/60 px-1.5 py-1" role="toolbar" aria-label={`${label} formatting`}>
          {!compact && (
            <>
              <ToolButton label="Heading" icon={<IconH2 size={17} />} isActive={state?.h2} onPress={() => run((c) => c.toggleHeading({ level: 2 }))} />
              <ToolButton label="Subheading" icon={<IconH3 size={17} />} isActive={state?.h3} onPress={() => run((c) => c.toggleHeading({ level: 3 }))} />
              <Divider />
            </>
          )}
          <ToolButton label="Bold (Ctrl+B)" icon={<IconBold size={17} />} isActive={state?.bold} onPress={() => run((c) => c.toggleBold())} />
          <ToolButton label="Italic (Ctrl+I)" icon={<IconItalic size={17} />} isActive={state?.italic} onPress={() => run((c) => c.toggleItalic())} />
          <ToolButton label="Strikethrough" icon={<IconStrikethrough size={17} />} isActive={state?.strike} onPress={() => run((c) => c.toggleStrike())} />
          <ToolButton label="Inline code" icon={<IconCode size={17} />} isActive={state?.code} onPress={() => run((c) => c.toggleCode())} />
          <ToolButton label="Link" icon={<IconLink size={17} />} isActive={state?.link || isLinkOpen} onPress={() => setIsLinkOpen((open) => !open)} />
          <Divider />
          <ToolButton label="Bulleted list" icon={<IconList size={17} />} isActive={state?.bullet} onPress={() => run((c) => c.toggleBulletList())} />
          <ToolButton label="Numbered list" icon={<IconListNumbers size={17} />} isActive={state?.ordered} onPress={() => run((c) => c.toggleOrderedList())} />
          <ToolButton label="Quote" icon={<IconBlockquote size={17} />} isActive={state?.quote} onPress={() => run((c) => c.toggleBlockquote())} />
          {!compact && (
            <>
              <ToolButton label="Code block" icon={<IconSourceCode size={17} />} isActive={state?.codeBlock} onPress={() => run((c) => c.toggleCodeBlock())} />
              <ToolButton label="Divider line" icon={<IconSeparatorHorizontal size={17} />} onPress={() => run((c) => c.setHorizontalRule())} />
              <ToolButton label="Insert table" icon={<IconTable size={17} />} isActive={state?.table} isDisabled={state?.table}
                onPress={() => run((c) => c.insertTable({ rows: 3, cols: 2, withHeaderRow: true }))} />
            </>
          )}
          <span className="ml-auto flex items-center gap-0.5">
            <ToolButton label="Undo (Ctrl+Z)" icon={<IconArrowBackUp size={17} />} isDisabled={!state?.canUndo} onPress={() => run((c) => c.undo())} />
            <ToolButton label="Redo (Ctrl+Shift+Z)" icon={<IconArrowForwardUp size={17} />} isDisabled={!state?.canRedo} onPress={() => run((c) => c.redo())} />
          </span>
        </div>

        {state?.table && (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-separator px-1.5 py-1 text-xs text-muted" role="toolbar" aria-label="Table">
            <span className="px-1.5">Table:</span>
            <ToolButton label="Add row below" icon={<IconRowInsertBottom size={17} />} onPress={() => run((c) => c.addRowAfter())} />
            <ToolButton label="Add column right" icon={<IconColumnInsertRight size={17} />} onPress={() => run((c) => c.addColumnAfter())} />
            <ToolButton label="Delete row" icon={<IconRowRemove size={17} />} onPress={() => run((c) => c.deleteRow())} />
            <ToolButton label="Delete column" icon={<IconColumnRemove size={17} />} onPress={() => run((c) => c.deleteColumn())} />
            <ToolButton label="Delete table" icon={<IconTableOff size={17} />} onPress={() => run((c) => c.deleteTable())} />
          </div>
        )}

        {isLinkOpen && editor && <LinkForm editor={editor} onDone={() => setIsLinkOpen(false)} />}

        <EditorContent editor={editor} />
      </div>
      <div className="flex justify-between gap-3 text-xs">
        {error ? <p id={errorId} className="m-0 text-danger" role="alert">{error}</p> : <span />}
        {maxLength && length > maxLength * 0.8 && (
          <span className={length > maxLength ? "text-danger" : "text-muted"}>{length.toLocaleString()} / {maxLength.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}

export default RichTextEditor;
