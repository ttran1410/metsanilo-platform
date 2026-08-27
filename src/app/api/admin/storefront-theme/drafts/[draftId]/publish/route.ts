import { POST as lifecycle } from "../../../route";

export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  return lifecycle(new Request(request, { body: JSON.stringify({ action: "publish", draftId }), headers: { "content-type": "application/json" } }));
}
