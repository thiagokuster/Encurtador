import { json, withApi } from "@/server/http";
import { isRegistrationOpen } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(async () => json({ registrationOpen: isRegistrationOpen() }));
