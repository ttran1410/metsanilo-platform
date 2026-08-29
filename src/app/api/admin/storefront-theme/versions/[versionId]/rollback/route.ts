import { POST as lifecycle } from "../../../route";
import { failure } from "../../../../../response";

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    return lifecycle(new Request(request, { body: JSON.stringify({ action: "rollback", versionId }), headers: { "content-type": "application/json" } }));
  } catch (error) { return failure(error, request); }
}
