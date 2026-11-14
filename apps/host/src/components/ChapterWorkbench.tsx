import { useId, useState, type ReactNode, type KeyboardEvent } from "react";
import { BoundaryFrame } from "./HandbookShell";
import { CodeExample } from "./CodeExample";
import { CheckCircle2, ArrowUpRight } from "lucide-react";
export function ChapterWorkbench({
  number,
  title,
  description,
  question,
  expected,
  code,
  file,
  command,
  checks,
  children,
}: {
  number: string;
  title: string;
  description: string;
  question: string;
  expected: string;
  code: string;
  file: string;
  command: string;
  checks: string[];
  children: ReactNode;
}) {
  const [view, setView] = useState("Example");
  const id = useId();
  const tabs = ["Example", "Code", "Tests"];
  function keydown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setView(tabs[next]!);
    document.getElementById(`${id}-tab-${tabs[next]}`)?.focus();
  }
  return (
    <section className="chapter-workbench">
      <BoundaryFrame owner="Host">
        <header className="chapter-heading">
          <span className="guide-eyebrow">THE HANDBOOK · {number}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        <div className="chapter-objective">
          <div>
            <span>THE QUESTION</span>
            <strong>{question}</strong>
          </div>
          <div>
            <span>WHAT SUCCESS LOOKS LIKE</span>
            <p>
              <CheckCircle2 size={15} />
              {expected}
            </p>
          </div>
        </div>
      </BoundaryFrame>
      <div
        className="chapter-tabs"
        role="tablist"
        aria-label={`${title} views`}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            role="tab"
            id={`${id}-tab-${tab}`}
            aria-selected={view === tab}
            aria-controls={`${id}-panel-${tab}`}
            tabIndex={view === tab ? 0 : -1}
            onKeyDown={(event) => keydown(event, index)}
            onClick={() => setView(tab)}
          >
            {tab}
            <small>
              {tab === "Example"
                ? "Try it"
                : tab === "Code"
                  ? "Understand it"
                  : "Verify it"}
            </small>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-Example`}
        aria-labelledby={`${id}-tab-Example`}
        hidden={view !== "Example"}
      >
        {children}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-Code`}
        aria-labelledby={`${id}-tab-Code`}
        hidden={view !== "Code"}
      >
        <div className="chapter-reading">
          <h2>Follow the implementation</h2>
          <p>
            This annotated excerpt points to the real implementation in the
            repository. The remote keeps ownership of its server functions.
          </p>
          <CodeExample title={title} code={code} file={file} />
          <a
            className="chapter-source"
            href="https://github.com/mes113/tanstack-start-federation-lab"
            target="_blank"
            rel="noreferrer"
          >
            Browse the source repository <ArrowUpRight size={14} />
          </a>
          <small>
            The excerpt reflects this local checkout. The repository may differ
            until these changes are pushed.
          </small>
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-Tests`}
        aria-labelledby={`${id}-tab-Tests`}
        hidden={view !== "Tests"}
      >
        <div className="chapter-reading">
          <h2>Verify the behavior</h2>
          <p>
            Run these commands in your terminal. Stop the dev servers before
            tests that start their own apps. This page does not execute
            commands.
          </p>
          <CodeExample
            title="Run the checks"
            file="Repository root"
            code={command}
          />
          <ul className="chapter-checks">
            {checks.map((check) => (
              <li key={check}>
                <CheckCircle2 size={16} />
                {check}
              </li>
            ))}
          </ul>
          <p className="chapter-test-note">
            These are test expectations, not live pass/fail indicators. Read the
            terminal report for the current result.
          </p>
        </div>
      </div>
    </section>
  );
}
