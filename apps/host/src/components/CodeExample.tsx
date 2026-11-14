import { useMemo } from "react";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import tsx from "shiki/langs/tsx.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import theme from "shiki/themes/github-dark.mjs";
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockTitle,
  CodeBlockActions,
  CodeBlockCopyButton,
  CodeBlockContent,
  CodeBlockLine,
  CodeBlockFooter,
} from "./ui/code-block";

// A synchronous JS engine makes the highlighted code part of the initial SSR HTML.
const highlighter = createHighlighterCoreSync({
  themes: [theme],
  langs: [tsx, shellscript],
  engine: createJavaScriptRegexEngine(),
});

export function CodeExample({
  code,
  file,
  title,
}: {
  code: string;
  file: string;
  title: string;
}) {
  const lines = useMemo(
    () =>
      highlighter.codeToTokens(code, {
        lang: file.startsWith("Repository") ? "shellscript" : "tsx",
        theme: "github-dark",
      }).tokens,
    [code, file],
  );
  return (
    <section className="learn-code" aria-label={title}>
      <span className="learn-section-label">UNDER THE HOOD</span>
      <h3>{title}</h3>
      <CodeBlock>
        <CodeBlockHeader>
          <CodeBlockTitle title={file}>{file}</CodeBlockTitle>
          <CodeBlockActions>
            <CodeBlockCopyButton value={code} />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent lineNumbers>
          {lines.map((line, index) => (
            <CodeBlockLine key={index}>
              {line.map((token, tokenIndex) => (
                <span key={tokenIndex} style={{ color: token.color }}>
                  {token.content}
                </span>
              ))}
            </CodeBlockLine>
          ))}
        </CodeBlockContent>
        <CodeBlockFooter>
          {file.startsWith("Repository")
            ? "Run from the repository root"
            : "Annotated excerpt · see the source file for full context"}
        </CodeBlockFooter>
      </CodeBlock>
    </section>
  );
}
