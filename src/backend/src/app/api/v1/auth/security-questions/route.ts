import { respond } from "../../../../../backend/transport/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
import { securityQuestions } from "../../../../../backend/application/auth/securityQuestions";
export function GET() { return respond({questions:securityQuestions}); }
