import { POST as markState } from "../../route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return markState(new Request(request, { body: JSON.stringify({ action: "unread", id }), headers: { "content-type": "application/json" } }));
}
