import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const imports: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
    }
  });

  return imports;
}

function resolveModulePath(importingFile: string, specifier: string): string | null {
  const dir = path.dirname(importingFile);
  let resolved: string;
  if (specifier.startsWith("@/")) {
    resolved = path.resolve(process.cwd(), "src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    resolved = path.resolve(dir, specifier);
  } else {
    // External dependency
    return null;
  }

  const extensions = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function buildDependencyGraph(entryFiles: string[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  const queue = [...entryFiles];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const deps = new Set<string>();
    const imports = extractImports(file);
    for (const imp of imports) {
      const resolved = resolveModulePath(file, imp);
      if (resolved && resolved.includes(path.resolve(process.cwd(), "src"))) {
        deps.add(resolved);
        if (!visited.has(resolved)) {
          queue.push(resolved);
        }
      }
    }
    graph.set(file, deps);
  }

  return graph;
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const inStack = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    stack.push(node);
    inStack.add(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        const cycleStartIndex = stack.indexOf(neighbor);
        cycles.push([...stack.slice(cycleStartIndex), neighbor]);
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

describe("Auth Subsystem Dependency Graph & Architecture Invariants", () => {
  const betterAuthFile = path.resolve(process.cwd(), "src/lib/better-auth.ts");
  const authIntegrationFile = path.resolve(process.cwd(), "src/lib/auth-integration.ts");
  const credentialPolicyFile = path.resolve(process.cwd(), "src/lib/credential-policy.ts");
  const credentialAuditFile = path.resolve(process.cwd(), "src/lib/credential-audit.ts");
  const adminUserActionsFile = path.resolve(process.cwd(), "src/domain/admin-user-actions.ts");
  const accessFile = path.resolve(process.cwd(), "src/domain/access.ts");

  it("better-auth.ts must NOT directly or indirectly import auth-integration.ts", () => {
    const betterAuthImports = extractImports(betterAuthFile);
    const resolvedImports = betterAuthImports
      .map((imp) => resolveModulePath(betterAuthFile, imp))
      .filter((p): p is string => p !== null);

    expect(resolvedImports).not.toContain(authIntegrationFile);
  });

  it("credential-policy.ts must be strictly pure (0 imports of db, env, runtime or domain modules)", () => {
    const rawImports = extractImports(credentialPolicyFile);
    expect(rawImports).toHaveLength(0);
    const forbiddenPatterns = ["@/db", "@/lib/env", "@/lib", "@/domain", "drizzle", "better-auth", "node:"];
    for (const pattern of forbiddenPatterns) {
      expect(rawImports.some((imp) => imp.includes(pattern))).toBe(false);
    }
  });

  it("admin-user-actions.ts must NOT import access.ts or legacy adapter", () => {
    const rawImports = extractImports(adminUserActionsFile);
    const resolvedImports = rawImports
      .map((imp) => resolveModulePath(adminUserActionsFile, imp))
      .filter((p): p is string => p !== null);

    expect(resolvedImports).not.toContain(accessFile);
    expect(rawImports.some((imp) => imp.includes("admin-users-actions"))).toBe(false);
  });

  it("Auth & Identity subsystem dependency graph must have zero cycles", () => {
    const graph = buildDependencyGraph([
      betterAuthFile,
      authIntegrationFile,
      credentialPolicyFile,
      credentialAuditFile,
      adminUserActionsFile,
      accessFile,
    ]);
    const cycles = findCycles(graph);
    expect(cycles).toEqual([]);
  });
});
