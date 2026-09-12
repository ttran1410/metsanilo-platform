const PRODUCTION_ORIGIN = "https://metsanilo.vercel.app";

export class SmokeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmokeConfigError";
  }
}

export function resolveSmokeTarget(rawUrl?: string, allowProduction = false): URL {
  const raw = rawUrl?.trim();
  if (!raw) {
    throw new SmokeConfigError("AUTH_SMOKE_BASE_URL is required");
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new SmokeConfigError("AUTH_SMOKE_BASE_URL must be a valid URL");
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw new SmokeConfigError("Unsupported smoke target protocol (must be http: or https:)");
  }

  if (target.username || target.password) {
    throw new SmokeConfigError("Credentials must not be embedded in target URL");
  }

  const targetOrigin = target.origin.toLowerCase();
  const productionOrigin = new URL(PRODUCTION_ORIGIN).origin.toLowerCase();

  if (targetOrigin === productionOrigin && !allowProduction) {
    throw new SmokeConfigError(
      "AUTH_SMOKE_BASE_URL targets production origin. Set AUTH_SMOKE_ALLOW_PRODUCTION=true to allow.",
    );
  }

  return target;
}

export class CookieJar {
  private cookies = new Map<string, string>();

  updateFromHeaders(headers: Headers) {
    const rawSetCookie = headers.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""].filter(Boolean);
    for (const cookieHeader of rawSetCookie) {
      if (!cookieHeader) continue;
      const parts = cookieHeader.split(";")[0]?.trim();
      if (!parts) continue;
      const equalIndex = parts.indexOf("=");
      if (equalIndex > 0) {
        const name = parts.slice(0, equalIndex).trim();
        const value = parts.slice(equalIndex + 1).trim();
        if (value) {
          this.cookies.set(name, value);
        } else {
          this.cookies.delete(name);
        }
      }
    }
  }

  getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  clear() {
    this.cookies.clear();
  }
}

export type SmokeTestOptions = {
  baseUrl: string;
  allowProduction?: boolean;
  adminEmail?: string;
  adminPassword?: string;
  managerEmail?: string;
  managerPassword?: string;
  fetchFn?: typeof fetch;
};

export async function runAuthSmokeTests(options: SmokeTestOptions): Promise<{ ok: boolean; results: string[]; errors: string[] }> {
  const fetchImpl = options.fetchFn ?? fetch;
  const target = resolveSmokeTarget(options.baseUrl, options.allowProduction ?? false);
  const origin = target.origin;

  const results: string[] = [];
  const errors: string[] = [];

  const adminEmail = options.adminEmail ?? process.env.AUTH_SMOKE_ADMIN_EMAIL;
  const adminPassword = options.adminPassword ?? process.env.AUTH_SMOKE_ADMIN_PASSWORD;
  const managerEmail = options.managerEmail ?? process.env.AUTH_SMOKE_MANAGER_EMAIL;
  const managerPassword = options.managerPassword ?? process.env.AUTH_SMOKE_MANAGER_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new SmokeConfigError("Admin credentials (AUTH_SMOKE_ADMIN_EMAIL & AUTH_SMOKE_ADMIN_PASSWORD) are required");
  }

  async function testUserFlow(roleName: string, email: string, pass: string) {
    const jar = new CookieJar();
    const correlationId = crypto.randomUUID();

    // 1. Sign In
    const loginRes = await fetchImpl(`${origin}/api/auth/better/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify({ email, password: pass }),
    });

    jar.updateFromHeaders(loginRes.headers);

    if (loginRes.status !== 200) {
      errors.push(`[${roleName}] Sign-in failed with status ${loginRes.status}`);
      return;
    }

    const resCorrelation = loginRes.headers.get("x-correlation-id");
    if (!resCorrelation) {
      errors.push(`[${roleName}] Sign-in response missing x-correlation-id header`);
    }

    results.push(`[${roleName}] Sign-in succeeded (correlation: ${resCorrelation})`);

    // 2. Session verification
    const sessionRes = await fetchImpl(`${origin}/api/auth/session`, {
      headers: {
        cookie: jar.getCookieHeader(),
      },
    });

    if (sessionRes.status !== 200) {
      errors.push(`[${roleName}] Session retrieval failed with status ${sessionRes.status}`);
      return;
    }

    const sessionData = (await sessionRes.json()) as { data?: { user?: { email?: string; role?: string } } };
    if (sessionData.data?.user?.email?.toLowerCase() !== email.toLowerCase()) {
      errors.push(`[${roleName}] Session email mismatch: expected ${email}, got ${sessionData.data?.user?.email}`);
    } else {
      results.push(`[${roleName}] Session verified for ${email} (role: ${sessionData.data?.user?.role})`);
    }

    // 3. Sign Out
    const logoutRes = await fetchImpl(`${origin}/api/auth/better/sign-out`, {
      method: "POST",
      headers: {
        cookie: jar.getCookieHeader(),
      },
    });

    if (logoutRes.status !== 200) {
      errors.push(`[${roleName}] Sign-out failed with status ${logoutRes.status}`);
    } else {
      results.push(`[${roleName}] Sign-out succeeded`);
    }
  }

  // Run Admin Flow
  await testUserFlow("ADMIN", adminEmail, adminPassword);

  // Run Manager Flow if provided
  if (managerEmail && managerPassword) {
    await testUserFlow("MANAGER", managerEmail, managerPassword);
  }

  // Security / Negative checks
  const badLoginRes = await fetchImpl(`${origin}/api/auth/better/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: "definitely-wrong-password-123!" }),
  });
  if (badLoginRes.status === 401) {
    results.push("Negative test: Invalid password correctly returned 401");
  } else {
    errors.push(`Negative test: Invalid password returned ${badLoginRes.status} instead of 401`);
  }

  const disabledRes = await fetchImpl(`${origin}/api/auth/better/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "new@example.test", password: "password" }),
  });
  if (disabledRes.status === 404) {
    results.push("Negative test: Disabled Better Auth endpoint correctly returned 404");
  } else {
    errors.push(`Negative test: Disabled Better Auth endpoint returned ${disabledRes.status} instead of 404`);
  }

  const legacyLoginRes = await fetchImpl(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: adminEmail, password: adminPassword }),
  });
  if (legacyLoginRes.status === 410) {
    results.push("Negative test: Legacy login endpoint correctly returned 410");
  } else {
    errors.push(`Negative test: Legacy login endpoint returned ${legacyLoginRes.status} instead of 410`);
  }

  const legacyLogoutRes = await fetchImpl(`${origin}/api/auth/logout`, {
    method: "POST",
  });
  if (legacyLogoutRes.status === 410) {
    results.push("Negative test: Legacy logout endpoint correctly returned 410");
  } else {
    errors.push(`Negative test: Legacy logout endpoint returned ${legacyLogoutRes.status} instead of 410`);
  }

  return {
    ok: errors.length === 0,
    results,
    errors,
  };
}

async function main() {
  const baseUrl = process.env.AUTH_SMOKE_BASE_URL;
  const allowProd = process.env.AUTH_SMOKE_ALLOW_PRODUCTION === "true";

  try {
    const outcome = await runAuthSmokeTests({
      baseUrl: baseUrl ?? "",
      allowProduction: allowProd,
    });

    console.log("--- Better Auth Live Smoke Test ---");
    for (const r of outcome.results) console.log(`  [✓] ${r}`);

    if (outcome.ok) {
      console.log("Status: PASSED - All smoke tests passed successfully.");
      process.exit(0);
    } else {
      console.error(`Status: FAILED - ${outcome.errors.length} test(s) failed:`);
      for (const e of outcome.errors) console.error(`  [!] ${e}`);
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof SmokeConfigError) {
      console.error(`Configuration error: ${error.message}`);
      process.exit(2);
    }
    console.error("Unexpected smoke runner error:", error);
    process.exit(2);
  }
}

if (process.argv[1]?.endsWith("auth-readiness-smoke.ts") || process.argv[1]?.endsWith("auth-readiness-smoke.js")) {
  main();
}
