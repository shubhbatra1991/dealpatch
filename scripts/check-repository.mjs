import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const files = [...new Set(execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\0"))].filter(file => file && existsSync(file));
const issues = [];
const junk = /(^|\/)(node_modules|\.next|coverage|playwright-report|test-results|\.vscode|\.idea)\/|\.(tsbuildinfo|log|db|sqlite3?|tmp|bak)$|(^|\/)\.env(?:\.|$)/;
// High-signal credential signatures; findings report filenames only, never values.
const credential = /(?:AKIA|ASIA)[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const machinePath = /[A-Za-z]:[\\/]Users[\\/]|\/(?:Users|home)\/[A-Za-z0-9_.-]+\//;
for (const file of files) {
  if (junk.test(file)) issues.push(`Generated/local artifact: ${file}`);
  if (!/\.(md|[cm]?[jt]sx?|json|ya?ml|svg|css)$/.test(file)) continue;
  const source = readFileSync(file, "utf8");
  if (credential.test(source)) issues.push(`Credential-like content: ${file}`);
  if (file.endsWith(".md") && machinePath.test(source)) issues.push(`Personal machine path: ${file}`);
  if (!file.endsWith(".md")) continue;
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].replace(/^<|>$/g, "").split("#")[0];
    if (!target || /^[a-z][a-z\d+.-]*:|^\//i.test(target)) continue;
    if (!existsSync(resolve(root, dirname(file), decodeURIComponent(target)))) issues.push(`Missing Markdown target: ${file} -> ${target}`);
  }
}
for (const name of ["README.md", "SECURITY.md", "LICENSE", "AGENTS.md", "CONTRIBUTING.md", ...["PRD", "ARCHITECTURE", "DATA_MODEL", "DESIGN_SYSTEM", "ENGINEERING_RULES", "PERFORMANCE", "ACCESSIBILITY", "THEMING", "ROADMAP", "DECISIONS", "RELEASE_READINESS"].map(name => `docs/${name}.md`)]) if (!files.includes(name)) issues.push(`Missing/ignored required file: ${name}`);
if (issues.length) { console.error(issues.join("\n")); process.exitCode = 1; }
else console.log(`Repository check passed: ${files.length} candidate files; Markdown targets, required docs, artifact and credential/path signatures checked.`);
