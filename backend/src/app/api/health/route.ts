import { getHealth } from "../../../backend/application/health/getHealth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getHealth(), {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
