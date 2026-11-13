// Vendor the official shadcn/ui registry components; no CLI/framework detection required.
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("apps/remote/src/components/ui", { recursive: true });
for (const name of [
  "button",
  "input",
  "badge",
  "table",
  "skeleton",
  "card",
  "checkbox",
]) {
  const response = await fetch(
    `https://ui.shadcn.com/r/styles/new-york-v4/${name}.json`,
  );
  if (!response.ok) throw new Error(`${name}: ${response.status}`);
  const item = await response.json();
  for (const file of item.files) {
    const content = file.content
      .replace(/from "cn"/g, 'from "../../lib/utils"')
      .replace(/@\/lib\/utils/g, "../../lib/utils");
    await writeFile(`apps/remote/src/components/ui/${name}.tsx`, content);
  }
}
