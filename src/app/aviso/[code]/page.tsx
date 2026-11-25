import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/mark";

const COPY: Record<string, { title: string; body: string }> = {
  inexistente: {
    title: "Link não encontrado",
    body: "Esse endereço não existe ou foi removido.",
  },
  expirado: {
    title: "Link expirado",
    body: "O prazo deste link encerrou. O destino não será aberto.",
  },
  inativo: {
    title: "Link desativado",
    body: "Quem criou este link o desativou. O destino não será aberto.",
  },
};

export const metadata: Metadata = { title: "Aviso do link", robots: { index: false, follow: false } };

export default async function AvisoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ slug?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const copy = COPY[code] || COPY.inexistente;
  return (
    <div className="public-page">
      <Link className="brand" href="/"><Mark /><strong>Encurtador</strong></Link>
      <section className="card status-card" style={{ marginTop: "2rem", display: "grid" }}>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        {query.slug ? <p className="mono hint">/{query.slug}</p> : null}
        <Link className="btn btn-primary" href="/">Ir para o início</Link>
      </section>
    </div>
  );
}
