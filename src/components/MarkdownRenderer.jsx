import Markdown from "react-markdown";

/**
 * Renders markdown content as styled HTML for read-only scroll display.
 * Used in place of the raw textarea when the user is viewing (not editing).
 */
export default function MarkdownRenderer({ content }) {
  return (
    <div className="markdown-rendered">
      <Markdown>{content}</Markdown>
    </div>
  );
}
