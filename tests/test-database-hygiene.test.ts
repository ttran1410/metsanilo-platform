import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const testsDirectory = join(process.cwd(), "tests");

function testFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? testFiles(path) : entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("test database hygiene", () => {
  it("does not let integration tests depend on the developer's local.db", () => {
    const violations = testFiles(testsDirectory).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /createDatabase\(\s*[`\"']file:local\.db|DB_URL\s*=\s*[`\"']file:local\.db/.test(source);
    });

    expect(violations).toEqual([]);
  });
});
