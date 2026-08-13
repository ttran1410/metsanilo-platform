import { db } from "@/db/client";
import { validateRuntimeEnvironment } from "@/lib/env";
import { release } from "@/lib/release";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configuration = validateRuntimeEnvironment();
  if (!configuration.ok) {
    return Response.json({ status: "not_ready", release, checks: { configuration } }, { status: 503 });
  }

  try {
    await db().run(sql`select 1`);
    return Response.json({ status: "ok", release, checks: { configuration: { ok: true }, database: { ok: true } } });
  } catch {
    return Response.json(
      { status: "not_ready", release, checks: { configuration: { ok: true }, database: { ok: false } } },
      { status: 503 },
    );
  }
}
