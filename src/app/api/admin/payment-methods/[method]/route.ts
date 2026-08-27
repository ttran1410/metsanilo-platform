import { DELETE as deleteCollection, PUT as putCollection } from "../route";

export async function PUT(request: Request, { params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  const body = await request.json();
  return putCollection(new Request(request, { body: JSON.stringify({ ...body, method }), headers: { "content-type": "application/json" } }));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ method: string }> }) {
  const { method } = await params;
  const url = new URL(request.url);
  url.searchParams.set("method", method);
  return deleteCollection(new Request(url, request));
}
