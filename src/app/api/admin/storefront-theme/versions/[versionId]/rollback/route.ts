import { POST as lifecycle } from "../../../route";

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  return lifecycle(new Request(request, { body: JSON.stringify({ action: "rollback", versionId }), headers: { "content-type": "application/json" } }));
}
