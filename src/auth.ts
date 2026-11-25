import { cookies } from "next/headers";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { getSecret } from "@/server/crypto";
import { SESSION_COOKIE, loginWithGoogle, sessionCookieOptions } from "@/server/auth";
import { logError } from "@/server/security";

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.trim().length < 32) {
  process.env.AUTH_SECRET = getSecret();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      const email = typeof profile?.email === "string" ? profile.email : "";
      const verified = profile?.email_verified === true;
      if (!email || !verified) return false;
      try {
        const token = loginWithGoogle(email, typeof profile?.name === "string" ? profile.name : "");
        const jar = await cookies();
        jar.set(SESSION_COOKIE, token, sessionCookieOptions());
        return true;
      } catch (error) {
        logError("google-signin", error);
        return false;
      }
    },
  },
});
