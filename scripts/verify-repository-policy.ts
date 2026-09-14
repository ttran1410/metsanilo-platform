import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PolicyIssue = { level: "error" | "warning"; message: string };

const canonical = "AGENTS.md";
const nested = ["scripts/AGENTS.md", "src/domain/AGENTS.md", "src/app/api/AGENTS.md", "src/db/AGENTS.md"];

function read(rootDir: string, path: string): string {
  return readFileSync(join(rootDir, path), "utf8");
}

export function collectPolicyIssues(rootDir = dirname(dirname(fileURLToPath(import.meta.url)))): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  const required = [canonical, ...nested];

  for (const path of required) {
    if (!existsSync(join(rootDir, path))) issues.push({ level: "error", message: `${path} is missing` });
  }

  if (existsSync(join(rootDir, canonical))) {
    const content = read(rootDir, canonical);
    const references = [...content.matchAll(/\]\(([^)]+\.md)(?::\d+)?\)/g)].map((match) => match[1]);
    for (const reference of references) {
      if (!existsSync(join(rootDir, reference))) issues.push({ level: "error", message: `${canonical} references missing file ${reference}` });
    }
    if (!/requirements[\s\S]{0,120}(ignored|private|non-authoritative)/i.test(content)) {
      issues.push({ level: "error", message: `${canonical} must state that local requirements are private and non-authoritative` });
    }
    if (!/Required completion report|completion report|completion contract/i.test(content)) {
      issues.push({ level: "error", message: `${canonical} must define a completion report contract` });
    }
  }

  const ignoredRequirements = existsSync(join(rootDir, ".gitignore")) && read(rootDir, ".gitignore").split("\n").some((line) => line.trim() === "/requirements");
  if (!ignoredRequirements) issues.push({ level: "error", message: ".gitignore must keep /requirements private" });

  return issues;
}

export function main(): void {
  const issues = collectPolicyIssues();
  console.info("POLICY CHECK");
  for (const issue of issues) console.info(`[${issue.level.toUpperCase()}] ${issue.message}`);
  if (issues.some((issue) => issue.level === "error")) process.exitCode = 1;
  else console.info("[PASS] Repository instruction policy is structurally valid.");
}

if (process.argv[1] && process.argv[1].endsWith("/scripts/verify-repository-policy.ts")) main();
