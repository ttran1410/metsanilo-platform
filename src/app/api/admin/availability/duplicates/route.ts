import { findAvailabilityDuplicateGroups } from "@/domain/availability";
import { failure, success } from "../../../response";
import { executeAdmin } from "../../module";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return success(await executeAdmin(request, {
      permission: "availability.read",
      parse: async () => undefined,
      run: async (_input, { database }) => ({ groups: await findAvailabilityDuplicateGroups(database) }),
    }));
  } catch (error) {
    return failure(error);
  }
}
