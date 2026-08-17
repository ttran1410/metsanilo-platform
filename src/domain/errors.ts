import { z } from "zod";

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors?: Record<string, string>,
    public readonly detail?: unknown,
  ) {
    super(message);
  }
}

export function fromZodError(error: z.ZodError, customMessage = "Validation failed"): DomainError {
  const fieldErrors: Record<string, string> = {};
  const detail = error.issues.map((issue) => ({
    field: issue.path.join(".") || "root",
    code: issue.code,
    message: issue.message,
  }));
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  const summaryMessage = detail.length > 0
    ? `${customMessage}: ${detail.map((d) => `${d.field} (${d.message})`).join("; ")}`
    : customMessage;

  return new DomainError("VALIDATION_ERROR", summaryMessage, 422, fieldErrors, detail);
}
