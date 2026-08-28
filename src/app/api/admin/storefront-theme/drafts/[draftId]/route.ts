import { DELETE as deleteDraft } from "../../route";
import { failure } from "../../../../response";

export async function DELETE(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  try {
    const { draftId } = await params;
    const url = new URL(request.url);
    url.searchParams.set("draftId", draftId);
    return deleteDraft(new Request(url, request));
  } catch (error) { return failure(error); }
}
