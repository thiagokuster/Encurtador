import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnlockForm } from "@/components/auth-forms";
import { getLinkBySlug } from "@/server/links";

export const metadata: Metadata = { title: "Link protegido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnlockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = getLinkBySlug(slug);
  if (!link) redirect("/aviso/inexistente");
  if (link.status !== "active") redirect(`/aviso/inativo?slug=${encodeURIComponent(link.slug)}`);
  if (link.expires_at && link.expires_at <= Date.now()) redirect(`/aviso/expirado?slug=${encodeURIComponent(link.slug)}`);
  if (!link.password_hash) redirect(`/${link.slug}`);
  return (
    <div className="public-page">
      <section className="card auth-card" style={{ maxWidth: 480, margin: "4rem auto" }}>
        <UnlockForm slug={link.slug} title={link.title} />
      </section>
    </div>
  );
}
