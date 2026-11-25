import { signOut } from "@/auth";
import { clearSessionCookie, logoutAccount } from "@/server/auth";
import { json, withApi } from "@/server/http";
import { logError } from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(async () => {
  await logoutAccount();
  await clearSessionCookie();
  try {
    await signOut({ redirect: false });
  } catch (error) {
    logError("logout", error);
  }
  return json({ ok: true });
});
