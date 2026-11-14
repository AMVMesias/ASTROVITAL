import type { NextRequest } from "next/server";
import { createAstronautAlerts } from "../../../../../backend/application/alerts/alerts";
import { localServices } from "../../../../../backend/composition/local";
import { handle, requestSession, respond } from "../../../../../backend/transport/http";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handle(() => {
    const session = requestSession(request, "astronauta");
    const alerts = createAstronautAlerts(localServices().alerts, {
      role: "astronauta", userId: session.id, missionId: session.missionId!, astronautId: session.astronautId!,
    })!;
    return respond({ alerts: alerts.list() });
  });
}
