import { DELETE as deleteCollection, PATCH as patchCollection } from "../route";
import { failure } from "../../../response";
import { parseJson } from "../../module";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await parseJson<Record<string, unknown>>(request);
    return patchCollection(new Request(request, { body: JSON.stringify({ ...body, id }), headers: { "content-type": "application/json" } }));
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    url.searchParams.set("id", id);
    return deleteCollection(new Request(url, request));
  } catch (error) { return failure(error); }
}
