import { methodNotAllowed } from "../../response";
import { resolveCorrelationId } from "@/lib/correlation-id";
import { recordLegacyAuthUsage } from "@/lib/auth-telemetry";

export const runtime = "nodejs";

function retiredResponse(request: Request) {
  const correlationId = resolveCorrelationId(request);
  recordLegacyAuthUsage(request, "login_endpoint", 410, correlationId);
  return Response.json(
    {
      error: {
        code: "ENDPOINT_RETIRED",
        message: "Legacy login endpoint is decommissioned. Use Better Auth.",
      },
      correlationId,
    },
    {
      status: 410,
      headers: {
        "x-correlation-id": correlationId,
      },
    },
  );
}

export async function POST(request: Request) {
  return retiredResponse(request);
}

export async function GET(request: Request) {
  return methodNotAllowed(["POST"], request);
}

export async function PUT(request: Request) {
  return methodNotAllowed(["POST"], request);
}

export async function PATCH(request: Request) {
  return methodNotAllowed(["POST"], request);
}

export async function DELETE(request: Request) {
  return methodNotAllowed(["POST"], request);
}

export async function OPTIONS(request: Request) {
  return methodNotAllowed(["POST"], request);
}
