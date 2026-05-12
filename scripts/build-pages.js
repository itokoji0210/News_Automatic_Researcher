import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const docs = path.join(root, "docs");

async function copy(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(path.join(root, from), path.join(root, to));
}

async function main() {
  await mkdir(path.join(docs, "data"), { recursive: true });

  await copy("public/index.html", "docs/index.html");
  await copy("public/styles.css", "docs/styles.css");
  await copy("public/app.js", "docs/app.js");
  await copy("data/trends.json", "docs/data/trends.json");
  await copy("data/scored-topics.json", "docs/data/scored-topics.json");
  await copy("data/feedback.json", "docs/data/feedback.json");
  await copy("data/codex-prompt.md", "docs/data/codex-prompt.md");
  await copy("data/codex-prompt.json", "docs/data/codex-prompt.json");

  const rootIndex = await readFile(path.join(docs, "index.html"), "utf8");
  await writeFile(path.join(root, "index.html"), rootIndex, "utf8");
  await copy("public/styles.css", "styles.css");
  await copy("public/app.js", "app.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
