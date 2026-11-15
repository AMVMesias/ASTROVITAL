import type { NextRequest } from "next/server";
import { createAstronautAlerts } from "../../../../../backend/application/alerts/alerts";
import { services } from "../../../../../backend/composition/services";
import { handle, requestSession, respond } from "../../../../../backend/transport/http";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  return handle(async () => {
    const session = (await requestSession(request, "astronauta"));
    const alerts = createAstronautAlerts(services().alerts, {
      role: "astronauta", userId: session.id, missionId: session.missionId!, astronautId: session.astronautId!,
    })!;
    return respond({ alerts: (await alerts.list()) });
  });
}
