import { getDashboard } from "@/domain/dashboard";
import { executeAdminRoute } from "../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return executeAdminRoute(request, {
    permission: "dashboard.read",
    parse: async () => undefined,
    run: async (_input, { database }) => getDashboard(database),
  });
}

