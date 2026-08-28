import { DELETE as deleteCollection, PUT as putCollection } from "../route";
import { failure } from "../../../response";
import { authenticateAdminAny, parseJson } from "../../module";

export async function PUT(request: Request, { params }: { params: Promise<{ method: string }> }) {
  try {
    const { method } = await params;
    await authenticateAdminAny(request, ["settings.operational"]);
    const body = await parseJson<Record<string, unknown>>(request);
    return putCollection(new Request(request, { body: JSON.stringify({ ...body, method }), headers: { "content-type": "application/json" } }));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ method: string }> }) {
  try {
    const { method } = await params;
    const url = new URL(request.url);
    url.searchParams.set("method", method);
    return deleteCollection(new Request(url, request));
  } catch (error) { return failure(error); }
}
