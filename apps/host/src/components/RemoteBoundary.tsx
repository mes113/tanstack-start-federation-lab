import { Button } from "@lab/ui/button";
import { Component, type ReactNode } from "react";

export function RemoteError({
  name,
  message,
  retry,
}: {
  name: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <section
      className="lab-card lab-failure"
      role="alert"
      data-testid={`error-${name.toLowerCase()}`}
    >
      <span className="lab-error-symbol">!</span>
      <span className="lab-kicker">THIS MODULE NEEDS ATTENTION</span>
      <h2>{name} is unavailable</h2>
      <p>{message}</p>
      <p>Your other modules are still available.</p>
      {retry ? (
        <Button variant="outline" onClick={retry}>
          Retry {name.toLowerCase()} render
        </Button>
      ) : (
        <a href="/lab">Reload workspace</a>
      )}
    </section>
  );
}

export class RemoteBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <RemoteError
        name={this.props.name}
        message="This component could not render. Try it again without reloading the other modules."
        retry={() =>
          this.setState((old) => ({ failed: false, attempt: old.attempt + 1 }))
        }
      />
    ) : (
      <div key={this.state.attempt}>{this.props.children}</div>
    );
  }
}
