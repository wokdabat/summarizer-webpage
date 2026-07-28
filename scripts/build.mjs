import { cpSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { readFileSync } from "fs";

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

if (process.argv.includes("--zip")) {
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const zipName = `page-summarizer-v${version}.zip`;
  const zipPath = join(root, "dist", zipName);

  rmSync(zipPath, { force: true });

  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${out}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: "inherit" }
    );
  } else {
    execSync(`cd "${out}" && zip -r "${zipPath}" .`, { stdio: "inherit", shell: true });
  }

  console.log(`Zip created: dist/${zipName}`);
  console.log("Upload this zip if publishing, or share it with others.");
}
