import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { collectPolicyIssues } from "../scripts/verify-repository-policy";

describe("repository instruction policy", () => {
  it("has no structural policy errors", () => {
    const errors = collectPolicyIssues().filter((issue) => issue.level === "error");
    expect(errors).toEqual([]);
  });

  it("detects missing mandatory files and policy sections", () => {
    const directory = mkdtempSync(join(tmpdir(), "metsanilo-policy-test-"));
    try {
      mkdirSync(join(directory, "src/domain"), { recursive: true });
      writeFileSync(join(directory, "AGENTS.md"), "# incomplete\n");
      writeFileSync(join(directory, ".gitignore"), "node_modules\n");

      const issues = collectPolicyIssues(directory);
      expect(issues.filter((issue) => issue.level === "error").map((issue) => issue.message)).toEqual(expect.arrayContaining([
        "scripts/AGENTS.md is missing",
        "src/app/api/AGENTS.md is missing",
        "src/db/AGENTS.md is missing",
        "AGENTS.md must state that local requirements are private and non-authoritative",
        "AGENTS.md must define a completion report contract",
        ".gitignore must keep /requirements private",
      ]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("detects broken source-of-truth links", () => {
    const directory = mkdtempSync(join(tmpdir(), "metsanilo-policy-links-"));
    try {
      for (const path of ["scripts", "src/domain", "src/app/api", "src/db"]) mkdirSync(join(directory, path), { recursive: true });
      writeFileSync(join(directory, "AGENTS.md"), "requirements are private and non-authoritative; completion report; [missing](docs/missing.md)\n");
      for (const path of ["scripts/AGENTS.md", "src/domain/AGENTS.md", "src/app/api/AGENTS.md", "src/db/AGENTS.md"]) writeFileSync(join(directory, path), "rules\n");
      writeFileSync(join(directory, ".gitignore"), "/requirements\n");

      const issues = collectPolicyIssues(directory);
      expect(issues).toEqual(expect.arrayContaining([
        { level: "error", message: "AGENTS.md references missing file docs/missing.md" },
      ]));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
