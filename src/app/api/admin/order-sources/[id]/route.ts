import { DELETE as deleteCollection, PATCH as patchCollection } from "../route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const forwarded = new Request(request, { body: JSON.stringify({ ...body, id }), headers: { "content-type": "application/json" } });
  return patchCollection(forwarded);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  url.searchParams.set("id", id);
  return deleteCollection(new Request(url, request));
}
