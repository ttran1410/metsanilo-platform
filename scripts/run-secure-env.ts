import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";

export const PROTECTED_KEYS = new Set([
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "DATABASE_AUTH_TOKEN",
]);

export function parseDotenvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const seenKeys = new Set<string>();

  // Strip UTF-8 BOM if present
  let sanitized = content;
  if (sanitized.charCodeAt(0) === 0xfeff) {
    sanitized = sanitized.slice(1);
  }

  const lines = sanitized.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const match = rawLine.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      throw new Error(`Malformed dotenv line at line ${i + 1}: "${rawLine}"`);
    }

    const key = match[1];
    const valPart = match[2];

    if (seenKeys.has(key)) {
      throw new Error(`Duplicate key detected in dotenv: "${key}" at line ${i + 1}`);
    }
    seenKeys.add(key);

    // Check if value is double-quoted or single-quoted
    if (valPart.startsWith('"')) {
      // Double quoted - handle multiline or escaped quotes
      let acc = valPart.slice(1);
      let closed = false;
      let lineIdx = i;

      while (!closed) {
        // Search for closing unescaped quote
        let isEscaped = false;
        let quotePos = -1;
        for (let charIdx = 0; charIdx < acc.length; charIdx++) {
          if (isEscaped) {
            isEscaped = false;
            continue;
          }
          if (acc[charIdx] === "\\") {
            isEscaped = true;
            continue;
          }
          if (acc[charIdx] === '"') {
            quotePos = charIdx;
            break;
          }
        }

        if (quotePos !== -1) {
          // Found closing quote
          const valueContent = acc.slice(0, quotePos);
          // Unescape characters
          result[key] = valueContent
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");
          closed = true;
        } else {
          // Multiline
          lineIdx++;
          if (lineIdx >= lines.length) {
            throw new Error(`Unterminated double-quoted string for key "${key}"`);
          }
          acc += "\n" + lines[lineIdx];
        }
      }
      i = lineIdx + 1;
    } else if (valPart.startsWith("'")) {
      // Single quoted
      let acc = valPart.slice(1);
      let closed = false;
      let lineIdx = i;

      while (!closed) {
        const quotePos = acc.indexOf("'");
        if (quotePos !== -1) {
          result[key] = acc.slice(0, quotePos);
          closed = true;
        } else {
          lineIdx++;
          if (lineIdx >= lines.length) {
            throw new Error(`Unterminated single-quoted string for key "${key}"`);
          }
          acc += "\n" + lines[lineIdx];
        }
      }
      i = lineIdx + 1;
    } else {
      // Unquoted - strip inline comment if present
      let value = valPart;
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx);
      }
      result[key] = value.trim();
      i++;
    }
  }

  return result;
}

export function parseCliArgs(argv: string[]) {
  const requiredVars: string[] = [];
  let envFilePath: string | undefined;
  const setOverrides: Record<string, string> = {};
  const allowedOverrides = new Set<string>();
  const childArgs: string[] = [];

  let inChildArgs = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (inChildArgs) {
      childArgs.push(arg);
      continue;
    }

    if (arg === "--") {
      inChildArgs = true;
      continue;
    }

    if (arg === "--require" || arg === "-r") {
      i++;
      if (i >= argv.length) throw new Error("Missing variable name for --require");
      requiredVars.push(argv[i]);
    } else if (arg.startsWith("--require=")) {
      requiredVars.push(arg.slice("--require=".length));
    } else if (arg === "--env-file") {
      i++;
      if (i >= argv.length) throw new Error("Missing file path for --env-file");
      envFilePath = argv[i];
    } else if (arg.startsWith("--env-file=")) {
      envFilePath = arg.slice("--env-file=".length);
    } else if (arg === "--allow-protected-override") {
      i++;
      if (i >= argv.length) throw new Error("Missing key name for --allow-protected-override");
      allowedOverrides.add(argv[i]);
    } else if (arg.startsWith("--allow-protected-override=")) {
      allowedOverrides.add(arg.slice("--allow-protected-override=".length));
    } else if (arg === "--set") {
      i++;
      if (i >= argv.length) throw new Error("Missing KEY=VALUE for --set");
      const kv = argv[i];
      const eqIdx = kv.indexOf("=");
      if (eqIdx === -1) throw new Error(`Invalid --set format: "${kv}", expected KEY=VALUE`);
      const setKey = kv.slice(0, eqIdx);
      if (setKey in setOverrides) {
        throw new Error(`Duplicate --set key detected: "${setKey}"`);
      }
      setOverrides[setKey] = kv.slice(eqIdx + 1);
    } else if (arg.startsWith("--set=")) {
      const kv = arg.slice("--set=".length);
      const eqIdx = kv.indexOf("=");
      if (eqIdx === -1) throw new Error(`Invalid --set format: "${kv}", expected KEY=VALUE`);
      const setKey = kv.slice(0, eqIdx);
      if (setKey in setOverrides) {
        throw new Error(`Duplicate --set key detected: "${setKey}"`);
      }
      setOverrides[setKey] = kv.slice(eqIdx + 1);
    } else {
      throw new Error(`Unknown argument before "--": ${arg}`);
    }
  }

  if (childArgs.length === 0) {
    throw new Error("No target command provided after --");
  }

  return {
    requiredVars,
    envFilePath,
    setOverrides,
    allowedOverrides,
    childArgs,
  };
}

export function buildMergedEnvironment(
  baseEnv: NodeJS.ProcessEnv | Record<string, string | undefined>,
  options: {
    envFilePath?: string;
    setOverrides?: Record<string, string>;
    allowedOverrides?: Set<string>;
    requiredVars?: string[];
  },
): Record<string, string> {
  const merged: Record<string, string> = {};

  // 1. Inherited base process.env (clean string values only)
  for (const [k, v] of Object.entries(baseEnv)) {
    if (v !== undefined) {
      merged[k] = v;
    }
  }

  // 2. Overlay 1: --env-file
  if (options.envFilePath) {
    if (!fs.existsSync(options.envFilePath)) {
      throw new Error(`Env file not found: ${options.envFilePath}`);
    }
    const content = fs.readFileSync(options.envFilePath, "utf8");
    const parsed = parseDotenvContent(content);
    for (const [k, v] of Object.entries(parsed)) {
      merged[k] = v;
    }
  }

  // 3. Overlay 2: --set overrides
  if (options.setOverrides) {
    for (const [k, v] of Object.entries(options.setOverrides)) {
      if (PROTECTED_KEYS.has(k) && !options.allowedOverrides?.has(k)) {
        throw new Error(
          `Protected environment variable "${k}" cannot be overridden via --set without explicit --allow-protected-override`,
        );
      }
      merged[k] = v;
    }
  }

  // 4. Validate --require assertions against final merged dictionary
  if (options.requiredVars) {
    for (const reqKey of options.requiredVars) {
      const val = merged[reqKey];
      if (!val || val.trim() === "") {
        throw new Error(`Required environment variable "${reqKey}" is missing or empty`);
      }
    }
  }

  return merged;
}

export async function runSecureEnv(argv: string[]): Promise<number> {
  const parsed = parseCliArgs(argv);
  const mergedEnv = buildMergedEnvironment(process.env, {
    envFilePath: parsed.envFilePath,
    setOverrides: parsed.setOverrides,
    allowedOverrides: parsed.allowedOverrides,
    requiredVars: parsed.requiredVars,
  });

  const [cmd, ...args] = parsed.childArgs;

  return new Promise<number>((resolve) => {
    const child: ChildProcess = spawn(cmd, args, {
      env: mergedEnv as NodeJS.ProcessEnv,
      stdio: "inherit",
    });

    const onSigint = () => {
      if (child.pid) child.kill("SIGINT");
    };
    const onSigterm = () => {
      if (child.pid) child.kill("SIGTERM");
    };
    const onSighup = () => {
      if (child.pid) child.kill("SIGHUP");
    };

    const cleanupListeners = () => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      process.off("SIGHUP", onSighup);
    };

    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);
    process.on("SIGHUP", onSighup);

    child.on("error", (err: Error) => {
      cleanupListeners();
      console.error(`Failed to start child process: ${err.message}`);
      resolve(1);
    });

    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      cleanupListeners();
      if (signal === "SIGINT") resolve(130);
      else if (signal === "SIGTERM") resolve(143);
      else if (signal === "SIGHUP") resolve(129);
      else resolve(code ?? 0);
    });
  });
}

// Entrypoint when executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecureEnv(process.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error(`run-secure-env error: ${err.message}`);
      process.exit(1);
    });
}
