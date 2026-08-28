import { POST as lifecycle } from "../../../route";
import { failure } from "../../../../../response";

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params;
    return lifecycle(new Request(request, { body: JSON.stringify({ action: "publish", draftId }), headers: { "content-type": "application/json" } }));
  } catch (error) { return failure(error); }
}
