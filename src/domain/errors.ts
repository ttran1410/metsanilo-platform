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

export function fromZodError(error: z.ZodError, customMessage = "Validation failed. Please check your inputs."): DomainError {
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

  return new DomainError("VALIDATION_ERROR", customMessage, 422, fieldErrors, detail);
}
