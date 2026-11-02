// Fails when Chinese text is added to the repository or to release commit messages.
// Project files, commits and release notes are English only; see CLAUDE.md.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that contained Chinese before the English-only rule. Translate them and
// remove their entry; never add a new one.
const LEGACY_FILES = new Set([
  "design/label-scheme-a-four-variants.html",
  "design/variants/label-a-red-black-regular.svg",
  "design/variants/label-a-red-black-sale.svg",
  "design/variants/label-a-red-white-regular.svg",
  "design/variants/label-a-red-white-sale.svg",
  "docs/label-design-system.md",
  "src/utils/labelLayout.test.ts",
]);

const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".icns", ".pdf", ".zip", ".dmg",
  ".exe", ".woff", ".woff2", ".ttf", ".otf", ".mp4", ".webm", ".wasm",
]);

function git(args) {
  return execFileSync("git", args, { cwd: projectRoot, encoding: "utf8" });
}

function offendingLines(text) {
  return text
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => HAN.test(text));
}

function checkFiles() {
  const files = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const findings = [];
  for (const file of files) {
    if (LEGACY_FILES.has(file)) continue;
    if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    let buffer;
    try {
      buffer = readFileSync(path.join(projectRoot, file));
    } catch {
      continue; // tracked but missing from the working tree
    }
    if (buffer.includes(0)) continue; // binary
    for (const hit of offendingLines(buffer.toString("utf8"))) findings.push({ file, ...hit });
  }
  return findings;
}

function checkCommits(range) {
  if (!range) throw new Error("Usage: node scripts/check-english.mjs --commits <git range>");
  const entries = git(["log", range, "--format=%h%x00%B%x00"]).split("\0");
  const findings = [];
  for (let index = 0; index + 1 < entries.length; index += 2) {
    const sha = entries[index].trim();
    if (!sha) continue;
    for (const hit of offendingLines(entries[index + 1])) findings.push({ file: `commit ${sha}`, ...hit });
  }
  return findings;
}

const commitsFlag = process.argv.indexOf("--commits");
const findings = commitsFlag === -1 ? checkFiles() : checkCommits(process.argv[commitsFlag + 1]);

if (findings.length === 0) {
  console.log("English-only check passed.");
  process.exit(0);
}

console.error("Chinese text found. Files, commits and release notes must be English only (see CLAUDE.md):");
for (const finding of findings) console.error(`  ${finding.file}:${finding.line}: ${finding.text.slice(0, 120)}`);
console.error(`\n${findings.length} line(s) to translate.`);
process.exit(1);
