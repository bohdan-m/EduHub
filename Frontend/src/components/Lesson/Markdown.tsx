import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

// react-markdown renders no raw HTML and strips javascript: links, so author (and later AI) text is safe to show.
// Fenced code blocks get syntax colours (the language is detected when the author didn't name one).
function Markdown({ text }: { text: string }) {
  return (
    <div className="lesson-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true }]]}
        components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
