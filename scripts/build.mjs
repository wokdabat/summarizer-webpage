import { cpSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const out = join(root, "dist", "page-summarizer");

const copyItems = [
  "manifest.json",
  "background",
  "content",
  "popup",
  "icons",
];

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const item of copyItems) {
  cpSync(join(root, item), join(out, item), { recursive: true });
}

console.log("Build complete: dist/page-summarizer");
console.log("Load that folder in edge://extensions (Load unpacked)");
