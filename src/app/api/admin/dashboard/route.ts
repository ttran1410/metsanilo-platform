import { getDashboard } from "@/domain/dashboard";
import { failure, success } from "../../response";
import { executeAdmin } from "../module";
export const runtime = "nodejs";
export async function GET(request: Request) { try { const result = await executeAdmin(request, { permission: "dashboard.read", parse: async () => undefined, run: async (_input, { database }) => getDashboard(database) }); return success(result); } catch (error) { return failure(error); } }
