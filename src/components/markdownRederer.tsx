"use client";
import { ComponentProps } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

export default function MarkdownRenderer({ content }: { content: string }) {
  const markdownComponents: Components = {
    h1: (props: ComponentProps<"h1">) => (
      <h1 className="text-4xl font-bold" {...props} />
    ),
    h2: (props: ComponentProps<"h2">) => (
      <h2 className="text-3xl font-semibold" {...props} />
    ),
    h3: (props: ComponentProps<"h3">) => (
      <h3 className="text-2xl font-medium" {...props} />
    ),
    h4: (props: ComponentProps<"h4">) => (
      <h4 className="text-xl font-medium" {...props} />
    ),
    p: (props: ComponentProps<"p">) => <p className="text-sm" {...props} />,
    a: ({ href, ...props }: ComponentProps<"a">) => (
      <a
        href={href || "#"}
        className="text-blue-500 hover:underline"
        {...props}
      />
    ),
    ul: (props: ComponentProps<"ul">) => (
      <ul className="list-disc pl-5" {...props} />
    ),
    ol: (props: ComponentProps<"ol">) => (
      <ol className="list-decimal pl-5" {...props} />
    ),
    blockquote: (props: ComponentProps<"blockquote">) => (
      <blockquote
        className="border-l-4 border-gray-400 italic text-zinc-600"
        {...props}
      />
    ),
    code: ({ inline, className, children, ...props }: any) => {
      // Manual detection of inline code if the inline prop isn't reliable
      const content = String(children).replace(/\n$/, "");

      // If there's no className and the content doesn't contain line breaks,
      // or if inline is explicitly true, treat it as inline code
      const isInline = inline || (!className && !content.includes("\n"));

      if (isInline) {
        return (
          <code
            className="bg-zinc-800 text-white px-2 py-1 rounded font-mono text-sm"
            {...props}
          >
            {children}
          </code>
        );
      }

      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";

      return (
        <div className="rounded-md overflow-hidden">
          <div className="bg-zinc-900 text-zinc-400 text-xs px-4 py-1.5 flex justify-between items-center">
            <span>{language || "plain text"}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(content);
              }}
              className="hover:text-white text-xs"
            >
              Copy
            </button>
          </div>
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            className="rounded-b-md w-full overflow-x-auto"
            showLineNumbers
            customStyle={{
              margin: 0,
              borderRadius: "0 0 0.375rem 0.375rem",
              fontSize: "0.9em",
            }}
            {...props}
          >
            {content}
          </SyntaxHighlighter>
        </div>
      );
    },
    img: (props: ComponentProps<"img">) => (
      <img
        className="max-w-full rounded-md  mx-auto"
        {...props}
        alt={props.alt || ""}
      />
    ),
    table: (props: ComponentProps<"table">) => (
      <div className="overflow-x-auto text-xs">
        <table
          className="min-w-full border-collapse border border-gray-200 dark:border-gray-700"
          {...props}
        />
      </div>
    ),
    thead: (props: ComponentProps<"thead">) => (
      <thead className="bg-zinc-100 dark:bg-zinc-800 text-nowrap" {...props} />
    ),
    tbody: (props: ComponentProps<"tbody">) => (
      <tbody
        className="divide-y divide-gray-200 dark:divide-gray-700"
        {...props}
      />
    ),
    tr: (props: ComponentProps<"tr">) => (
      <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900" {...props} />
    ),
    th: (props: ComponentProps<"th">) => (
      <th
        className="px-4 py-2 text-left border-r font-semibold border-b border-gray-300 dark:border-gray-600"
        {...props}
      />
    ),
    td: (props: ComponentProps<"td">) => (
      <td
        className="px-4 py-2 border-b border-r border-gray-200 dark:border-gray-700"
        {...props}
      />
    ),
  };

  return (
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  );
}
