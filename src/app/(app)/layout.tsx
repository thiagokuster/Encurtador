import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeBoot } from "@/components/providers";
import { Shell } from "@/components/shell";
import { getSession } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const settings = getSettings(session.user.id);
  return (
    <>
      <ThemeBoot theme={settings.theme} />
      <Shell user={{ name: session.user.name, email: session.user.email }}>{children}</Shell>
    </>
  );
}
