import { DELETE as deleteDraft } from "../../route";

export async function DELETE(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const url = new URL(request.url);
  url.searchParams.set("draftId", draftId);
  return deleteDraft(new Request(url, request));
}
