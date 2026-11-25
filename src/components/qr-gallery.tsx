"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/providers";
import { Banner, PageSkeleton } from "@/components/widgets";
import { useRemote } from "@/components/use-remote";
import { apiSend, copyText, downloadUrl } from "@/lib/client";
import { colorContrast, validateHexColor } from "@/lib/validators";
import type { LinkDTO, LinksPage } from "@/lib/types";

export function QrGallery() {
  const params = useSearchParams();
  const focus = params.get("link");
  const [page, setPage] = useState(1);
  const remote = useRemote<LinksPage>(`/api/links?page=${page}&sort=created&dir=desc`);
  const pages = Math.max(1, Math.ceil((remote.data?.total || 0) / 10));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>QR Codes</h2>
          <p>Cada código abre o link curto. Para imprimir, configure o domínio público em Configurações. Um QR feito em localhost só funciona nesta máquina.</p>
        </div>
      </div>
      {remote.loading && !remote.data ? <PageSkeleton /> : null}
      {remote.error && !remote.data ? <Banner tone="error">{remote.error}</Banner> : null}
      {remote.data && remote.data.links.length === 0 ? <div className="card panel"><p className="hint">Crie um link para gerar o primeiro QR Code.</p></div> : null}
      <div className="qr-grid">
        {remote.data?.links.map((link) => <QrCard key={`${link.id}-${link.updatedAt}`} link={link} highlight={focus === link.id} onSaved={() => remote.reload()} />)}
      </div>
      {remote.data && remote.data.total > 10 ? (
        <div className="pager">
          <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button className="btn btn-ghost" type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</button>
        </div>
      ) : null}
    </div>
  );
}

function QrCard({ link, highlight, onSaved }: { link: LinkDTO; highlight: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [fg, setFg] = useState(link.qrColor);
  const [bg, setBg] = useState(link.qrBackground);
  const [busy, setBusy] = useState(false);
  const foreground = validateHexColor(fg);
  const background = validateHexColor(bg);
  const contrast = foreground && background ? colorContrast(foreground, background) : 0;
  const safe = Boolean(foreground && background && contrast >= 3);
  const preview = useMemo(() => (safe ? `/api/qr/${link.id}?format=png&fg=${foreground}&bg=${background}` : ""), [safe, link.id, foreground, background]);

  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`qr-${link.id}`)?.scrollIntoView({ block: "center" });
  }, [highlight, link.id]);

  async function save() {
    if (!foreground || !background) return toast("Use cores em hexadecimal.", "error");
    if (contrast < 3) return toast("Aumente o contraste para o QR continuar legível.", "error");
    setBusy(true);
    try {
      await apiSend(`/api/links/${link.id}`, { method: "PATCH", body: JSON.stringify({ qrColor: foreground, qrBackground: background }) });
      toast("Cores salvas.");
      onSaved();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível salvar as cores.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const ok = await copyText(link.shortUrl);
    toast(ok ? "Link copiado." : "Não foi possível copiar.", ok ? "success" : "error");
  }

  return (
    <article id={`qr-${link.id}`} className="card panel" style={highlight ? { outline: "2px solid var(--accent)" } : undefined}>
      <h3>{link.title || link.slug}</h3>
      <p className="mono hint">{link.shortUrl}</p>
      <div className="qr-frame">
        {preview ? (
          <img src={preview} alt={`QR Code de ${link.slug}`} />
        ) : <p>Ajuste as cores para visualizar o código.</p>}
      </div>
      <div className="color-row" style={{ marginTop: "0.8rem" }}>
        <label className="lbl">Frente<input type="color" value={`#${foreground || "1C1915"}`} onChange={(event) => setFg(event.target.value.slice(1))} /></label>
        <label className="lbl">Fundo<input type="color" value={`#${background || "FFFCF8"}`} onChange={(event) => setBg(event.target.value.slice(1))} /></label>
      </div>
      <div className="filters" style={{ marginTop: "0.8rem" }}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>{busy ? "Salvando..." : "Salvar cores"}</button>
        <button className="btn btn-ghost" type="button" disabled={!safe} onClick={() => downloadUrl(preview, `qr-${link.slug}.png`).then(() => toast("PNG baixado.")).catch((error) => toast(error.message, "error"))}>PNG</button>
        <button className="btn btn-ghost" type="button" disabled={!safe} onClick={() => downloadUrl(`/api/qr/${link.id}?format=svg&fg=${foreground}&bg=${background}`, `qr-${link.slug}.svg`).then(() => toast("SVG baixado.")).catch((error) => toast(error.message, "error"))}>SVG</button>
        <button className="btn btn-ghost" type="button" onClick={copy}>Copiar link</button>
      </div>
    </article>
  );
}
