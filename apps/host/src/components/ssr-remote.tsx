import { lazyRemote } from "@module-federation/tanstack/runtime";
import { createElement, type ComponentProps, type ElementType } from "react";

// Cache module code only, never request data. A loader-resolved module must render
// synchronously in SSR: re-wrapping it in React.lazy can emit hidden streamed HTML
// that needs JavaScript to reveal, especially after a remote recovers.
export function ssrRemote<T extends Exclude<ElementType, string>>(
  loadModule: () => Promise<{ default: T }>,
) {
  let resolved: T | undefined;
  const load = async () => {
    const module = await loadModule();
    resolved = module.default;
    return module;
  };
  const Lazy = lazyRemote(load, { retryAfterMs: 300 });
  const Component = (props: ComponentProps<T>) =>
    createElement(resolved ?? Lazy, props);
  return { load, Component };
}
