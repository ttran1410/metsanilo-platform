import { z } from "zod";
import { DomainError } from "@/domain/errors";

const querySchema = z.object({
  q: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminListQuery = z.infer<typeof querySchema> & { offset: number };

export function parseAdminListQuery(request: Request): AdminListQuery {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "Invalid list query", 422);
  return { ...parsed.data, offset: (parsed.data.page - 1) * parsed.data.pageSize };
}

export function paged<T>(items: T[], total: number, query: AdminListQuery) {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    hasNextPage: query.offset + items.length < total,
  };
}

export function hasListQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  return ["q", "page", "pageSize"].some((key) => params.has(key));
}

export function adminQueryParam(request: Request, name: string) {
  return new URL(request.url).searchParams.get(name) ?? undefined;
}
