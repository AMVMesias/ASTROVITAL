import { openapi } from "../../../backend/transport/openapi";
export function GET() { return Response.json(openapi); }
