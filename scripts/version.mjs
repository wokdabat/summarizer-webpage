import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const VERSION_FILES = {
  manifest: join(root, "manifest.json"),
  package: join(root, "package.json"),
  popup: join(root, "popup", "index.html"),
  readme: join(root, "README.md"),
};

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`Invalid version "${version}". Use format major.minor.patch (e.g. 1.1.0).`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(VERSION_FILES.package, "utf8"));
  return pkg.version;
}

function resolveNextVersion(current, arg) {
  if (arg === "patch") {
    const v = parseVersion(current);
    v.patch += 1;
    return formatVersion(v);
  }

  if (arg === "minor") {
    const v = parseVersion(current);
    v.minor += 1;
    v.patch = 0;
    return formatVersion(v);
  }

  if (arg === "major") {
    const v = parseVersion(current);
    v.major += 1;
    v.minor = 0;
    v.patch = 0;
    return formatVersion(v);
  }

  parseVersion(arg);
  return arg;
}

function updateManifest(version) {
  const manifest = JSON.parse(readFileSync(VERSION_FILES.manifest, "utf8"));
  manifest.version = version;
  writeFileSync(VERSION_FILES.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

function updatePackage(version) {
  const pkg = JSON.parse(readFileSync(VERSION_FILES.package, "utf8"));
  pkg.version = version;
  writeFileSync(VERSION_FILES.package, `${JSON.stringify(pkg, null, 2)}\n`);
}

function updatePopup(version) {
  let html = readFileSync(VERSION_FILES.popup, "utf8");
  html = html.replace(/(<span>)v[\d.]+(<\/span>)/, `$1v${version}$2`);
  writeFileSync(VERSION_FILES.popup, html);
}

function updateReadme(version) {
  let readme = readFileSync(VERSION_FILES.readme, "utf8");
  readme = readme.replace(/\*\*Version:\*\* [\d.]+/, `**Version:** ${version}`);
  writeFileSync(VERSION_FILES.readme, readme);
}

function printHelp() {
  console.log(`Usage:
  npm run version:patch   Small fix         1.0.0 -> 1.0.1
  npm run version:minor   New feature       1.0.0 -> 1.1.0
  npm run version:major   Breaking change   1.0.0 -> 2.0.0
  npm run version:set -- 1.2.3             Set an exact version`);
}

const arg = process.argv[2];

if (!arg || arg === "--help" || arg === "-h") {
  printHelp();
  process.exit(arg ? 0 : 1);
}

const current = getCurrentVersion();
const next = resolveNextVersion(current, arg);

updateManifest(next);
updatePackage(next);
updatePopup(next);
updateReadme(next);

console.log(`Version updated: ${current} -> ${next}`);
console.log("Updated: manifest.json, package.json, popup/index.html, README.md");
console.log("Reload the extension in edge://extensions to apply the new version.");
