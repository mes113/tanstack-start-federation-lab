import { Button } from "@lab/ui/button";
import { useRef, useState, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@lab/ui/tabs";
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
  steps,
  observed,
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
  steps?: { action: string; expect: string }[];
  observed?: string;
}) {
  const [view, setView] = useState("Example");
  const codeTab = useRef<HTMLButtonElement>(null);
  const tabs = ["Example", "Code", "Tests"];
  return (
    <Tabs value={view} onValueChange={setView} asChild>
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
        <TabsList
          className="chapter-tabs"
          variant="line"
          aria-label={title + " views"}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              ref={tab === "Code" ? codeTab : undefined}
            >
              {tab}
              <small>
                {tab === "Example"
                  ? "Try it"
                  : tab === "Code"
                    ? "Understand it"
                    : "Verify it"}
              </small>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Example" forceMount hidden={view !== "Example"}>
          {steps && (
            <section className="scenario-guide" aria-label="Guided experiment">
              <div className="scenario-guide-heading">
                <div>
                  <span className="guide-eyebrow">TRY THIS EXPERIMENT</span>
                  <h2>Try it, then check the result</h2>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setView("Code");
                    codeTab.current?.focus();
                  }}
                >
                  See the code
                </Button>
              </div>
              <ol>
                {steps.map((step, index) => (
                  <li key={step.action}>
                    <span className="scenario-step-number">{index + 1}</span>
                    <div>
                      <strong>{step.action}</strong>
                      <p>
                        <span>Expect</span> {step.expect}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {observed && (
                <div className="scenario-observation">
                  <span>Page loader result</span>
                  <p>{observed}</p>
                  <small>
                    This snapshot is from the page request. Live results appear
                    in the example below; automated SSR checks are in Tests.
                  </small>
                </div>
              )}
            </section>
          )}
          {children}
        </TabsContent>
        <TabsContent value="Code" forceMount hidden={view !== "Code"}>
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
              The excerpt reflects this local checkout. The repository may
              differ until these changes are pushed.
            </small>
          </div>
        </TabsContent>
        <TabsContent value="Tests" forceMount hidden={view !== "Tests"}>
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
              These are test expectations, not live pass/fail indicators. Read
              the terminal report for the current result.
            </p>
          </div>
        </TabsContent>
      </section>
    </Tabs>
  );
}
