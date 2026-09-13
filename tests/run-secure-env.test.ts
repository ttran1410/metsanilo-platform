import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseDotenvContent,
  parseCliArgs,
  buildMergedEnvironment,
  runSecureEnv,
} from "../scripts/run-secure-env";

describe("run-secure-env", () => {
  describe("parseDotenvContent", () => {
    it("parses simple unquoted, single-quoted, and double-quoted values", () => {
      const content = `
# Comment line
SIMPLE=hello
QUOTED_SINGLE='single value'
QUOTED_DOUBLE="double value"
WITH_SPACES=value with spaces # inline comment
`;
      const parsed = parseDotenvContent(content);
      expect(parsed).toEqual({
        SIMPLE: "hello",
        QUOTED_SINGLE: "single value",
        QUOTED_DOUBLE: "double value",
        WITH_SPACES: "value with spaces",
      });
    });

    it("handles escaped characters and multiline double-quoted strings", () => {
      const content = `
ESCAPED="hello\\nworld\\ttab\\"quote\\\\"
MULTILINE="line 1
line 2
line 3"
`;
      const parsed = parseDotenvContent(content);
      expect(parsed.ESCAPED).toBe('hello\nworld\ttab"quote\\');
      expect(parsed.MULTILINE).toBe("line 1\nline 2\nline 3");
    });

    it("strips UTF-8 BOM if present", () => {
      const content = "\uFEFFKEY=value\n";
      const parsed = parseDotenvContent(content);
      expect(parsed).toEqual({ KEY: "value" });
    });

    it("rejects duplicate keys", () => {
      const content = `
KEY=first
KEY=second
`;
      expect(() => parseDotenvContent(content)).toThrowError(/Duplicate key detected/);
    });

    it("rejects malformed lines", () => {
      const content = `INVALID_LINE_WITHOUT_EQUALS`;
      expect(() => parseDotenvContent(content)).toThrowError(/Malformed dotenv line/);
    });
  });

  describe("parseCliArgs", () => {
    it("parses CLI flags and separates child args after --", () => {
      const parsed = parseCliArgs([
        "--require",
        "AUTH_VAR_1",
        "--require=AUTH_VAR_2",
        "--env-file",
        ".env.test",
        "--set",
        "FOO=bar",
        "--set=BAZ=qux",
        "--allow-protected-override",
        "TURSO_DATABASE_URL",
        "--",
        "node",
        "script.js",
        "--target=prod",
      ]);

      expect(parsed.requiredVars).toEqual(["AUTH_VAR_1", "AUTH_VAR_2"]);
      expect(parsed.envFilePath).toBe(".env.test");
      expect(parsed.setOverrides).toEqual({ FOO: "bar", BAZ: "qux" });
      expect(parsed.allowedOverrides.has("TURSO_DATABASE_URL")).toBe(true);
      expect(parsed.childArgs).toEqual(["node", "script.js", "--target=prod"]);
    });

    it("throws if duplicate --set key is provided", () => {
      expect(() =>
        parseCliArgs(["--set", "FOO=bar", "--set", "FOO=baz", "--", "node", "script.js"])
      ).toThrowError(/Duplicate --set key detected: "FOO"/);
    });

    it("throws if no child args are provided after --", () => {
      expect(() => parseCliArgs(["--require", "FOO"])).toThrowError(/No target command/);
    });
  });

  describe("buildMergedEnvironment", () => {
    it("enforces precedence: base < env-file < --set", () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-env-test-"));
      const envFile = path.join(tmpDir, ".env");
      fs.writeFileSync(envFile, "OVERRIDDEN=from_file\nFILE_ONLY=file_val\n");

      try {
        const baseEnv = {
          BASE_ONLY: "base_val",
          OVERRIDDEN: "from_base",
          SET_OVERRIDDEN: "from_base",
        };

        const merged = buildMergedEnvironment(baseEnv, {
          envFilePath: envFile,
          setOverrides: {
            SET_OVERRIDDEN: "from_set",
            OVERRIDDEN: "from_set",
          },
        });

        expect(merged.BASE_ONLY).toBe("base_val");
        expect(merged.FILE_ONLY).toBe("file_val");
        expect(merged.SET_OVERRIDDEN).toBe("from_set");
        expect(merged.OVERRIDDEN).toBe("from_set");
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("fails closed when required variable is missing or empty", () => {
      expect(() =>
        buildMergedEnvironment({}, { requiredVars: ["MISSING_VAR"] }),
      ).toThrowError(/Required environment variable "MISSING_VAR" is missing/);

      expect(() =>
        buildMergedEnvironment({ EMPTY_VAR: "   " }, { requiredVars: ["EMPTY_VAR"] }),
      ).toThrowError(/Required environment variable "EMPTY_VAR" is missing or empty/);
    });

    it("guards protected database keys against unauthorized --set", () => {
      expect(() =>
        buildMergedEnvironment(
          {},
          { setOverrides: { TURSO_DATABASE_URL: "libsql://malicious" } },
        ),
      ).toThrowError(/Protected environment variable "TURSO_DATABASE_URL" cannot be overridden/);

      // Allowed override succeeds
      const merged = buildMergedEnvironment(
        {},
        {
          setOverrides: { TURSO_DATABASE_URL: "libsql://backup-db" },
          allowedOverrides: new Set(["TURSO_DATABASE_URL"]),
        },
      );
      expect(merged.TURSO_DATABASE_URL).toBe("libsql://backup-db");
    });
  });

  describe("runSecureEnv execution", () => {
    it("executes child command and preserves exit code", async () => {
      const exitCode = await runSecureEnv([
        "--set",
        "TEST_ECHO=running_securely",
        "--",
        "node",
        "-e",
        'process.exit(process.env.TEST_ECHO === "running_securely" ? 0 : 42)',
      ]);

      expect(exitCode).toBe(0);
    });

    it("preserves non-zero child exit codes", async () => {
      const exitCode = await runSecureEnv([
        "--",
        "node",
        "-e",
        "process.exit(6)",
      ]);

      expect(exitCode).toBe(6);
    });
  });
});
