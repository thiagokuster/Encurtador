"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BreakdownGrid } from "@/components/breakdown";
import { LinkForm } from "@/components/link-form";
import { useToast } from "@/components/providers";
import { Banner, ConfirmDialog, GrowthStat, PageSkeleton, Panel, RangePicker, Stat } from "@/components/widgets";
import { useRemote } from "@/components/use-remote";
import { apiSend, copyText, downloadUrl, rangeQuery } from "@/lib/client";
import { colorContrast, validateHexColor } from "@/lib/validators";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import type { LinkAnalytics } from "@/lib/types";

export function LinkDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [range, setRange] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = useMemo(() => {
    if (range === "custom" && (!from || !to || from > to)) return null;
    return `/api/analytics/links/${id}?${rangeQuery(range, from, to)}`;
  }, [id, range, from, to]);
  const remote = useRemote<LinkAnalytics>(query, 15000);
  const link = remote.data?.link;

  async function copy() {
    if (!link) return;
    const ok = await copyText(link.shortUrl);
    toast(ok ? "Link copiado." : "Não foi possível copiar.", ok ? "success" : "error");
  }

  async function toggle() {
    if (!link) return;
    try {
      await apiSend(`/api/links/${link.id}`, { method: "PATCH", body: JSON.stringify({ status: link.status === "active" ? "inactive" : "active" }) });
      toast(link.status === "active" ? "Link desativado." : "Link ativado.");
      await remote.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível alterar o status.", "error");
    }
  }

  async function remove() {
    if (!link) return;
    setBusy(true);
    try {
      await apiSend(`/api/links/${link.id}`, { method: "DELETE" });
      toast("Link excluído.");
      router.push("/links");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível excluir.", "error");
      setBusy(false);
    }
  }

  async function purge() {
    if (!link) return;
    setBusy(true);
    try {
      await apiSend(`/api/analytics?linkId=${link.id}`, { method: "DELETE" });
      toast("Analytics deste link excluídos.");
      setConfirmPurge(false);
      await remote.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível excluir os analytics.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    try {
      await downloadUrl(`/api/export?${rangeQuery(range, from, to, { linkId: id })}`, `encurtador-${id}.csv`);
      toast("Relatório exportado.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível exportar.", "error");
    }
  }

  return (
    <div className="stack">
      <Link href="/links">Voltar para meus links</Link>
      {remote.loading && !remote.data ? <PageSkeleton /> : null}
      {remote.error && !remote.data ? <Banner tone="error">{remote.error}</Banner> : null}
      {remote.data && link ? (
        <>
          <div className="page-head">
            <div>
              <h2>{link.title || link.slug}</h2>
              <p className="mono">{link.shortUrl}</p>
              <p className="hint">{link.originalUrl}</p>
            </div>
            <div className="filters">
              <span className="live-dot" aria-hidden />
              <span className="hint">{timeAgo(remote.data.generatedAt)}</span>
              <button className="btn btn-ghost" type="button" onClick={copy}>Copiar</button>
              <a className="btn btn-ghost" href={link.shortUrl} target="_blank" rel="noreferrer">Abrir</a>
              <button className="btn btn-ghost" type="button" onClick={toggle}>{link.status === "active" ? "Desativar" : "Ativar"}</button>
              <button className="btn btn-ghost" type="button" onClick={exportCsv}>Exportar CSV</button>
              <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}>Excluir</button>
            </div>
          </div>
          <RangePicker range={range} from={from} to={to} onChange={(next) => { setRange(next.range); setFrom(next.from); setTo(next.to); }} />
          {!remote.data.analyticsEnabled ? <Banner>A coleta está desligada. Este link continua redirecionando, sem novos eventos.</Banner> : null}
          {remote.data.truncatedByRetention ? <Banner>O período vai além da retenção de {remote.data.retentionDays} dias. Só os eventos ainda armazenados aparecem aqui.</Banner> : null}
          <div className="grid-stats">
            <Stat label="Cliques totais" value={formatNumber(remote.data.totals.clicks)} />
            <Stat label="No período" value={formatNumber(remote.data.totals.clicksInRange)} hint={remote.data.range.label} />
            <Stat label="Únicos estimados" value={formatNumber(remote.data.totals.uniqueInRange)} hint="Por dia, sem acompanhar a mesma pessoa entre datas." />
            <GrowthStat growth={remote.data.totals.growth} previous={remote.data.totals.previousClicks} />
          </div>
          <p className="hint">Último acesso: {remote.data.totals.lastClickAt ? formatDateTime(remote.data.totals.lastClickAt) : remote.data.totals.clicks > 0 ? "o último acesso saiu da janela de retenção." : "ainda não houve acessos."}</p>
          <BreakdownGrid
            series={remote.data.series}
            hours={remote.data.hours}
            devices={remote.data.devices}
            browsers={remote.data.browsers}
            operatingSystems={remote.data.operatingSystems}
            countries={remote.data.countries}
            continents={remote.data.continents}
            subdivisions={remote.data.subdivisions}
            cities={remote.data.cities}
            referrers={remote.data.referrers}
            referrerHosts={remote.data.referrerHosts}
          />
          <QrMini linkId={link.id} slug={link.slug} shortUrl={link.shortUrl} color={link.qrColor} background={link.qrBackground} />
          <Panel title="Editar link">
            <div id="editar">
              <LinkForm mode="edit" initial={link} onSuccess={() => remote.reload()} />
            </div>
          </Panel>
          <div>
            <button className="btn btn-danger" type="button" onClick={() => setConfirmPurge(true)}>Excluir analytics deste link</button>
          </div>
        </>
      ) : null}
      {confirmDelete ? <ConfirmDialog title="Excluir link" body="O link, as tags e os eventos de clique serão apagados." confirmLabel="Excluir" danger busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)} /> : null}
      {confirmPurge ? <ConfirmDialog title="Excluir analytics" body="Os eventos deste link serão apagados e o total de cliques volta a zero. O link continua existindo." confirmLabel="Apagar dados" danger busy={busy} onConfirm={purge} onClose={() => setConfirmPurge(false)} /> : null}
    </div>
  );
}

function QrMini({ linkId, slug, shortUrl, color, background }: { linkId: string; slug: string; shortUrl: string; color: string; background: string }) {
  const toast = useToast();
  const fg = validateHexColor(color);
  const bg = validateHexColor(background);
  const safe = fg && bg && colorContrast(fg, bg) >= 3;
  return (
    <Panel title="QR Code" subtitle="Ele abre o link curto, não o destino original.">
      {safe ? (
        <img src={`/api/qr/${linkId}?format=png&fg=${fg}&bg=${bg}`} alt={`QR Code de ${slug}`} width={180} height={180} />
      ) : <p className="hint">As cores salvas não têm contraste suficiente.</p>}
      <div className="filters" style={{ marginTop: "0.8rem" }}>
        <button className="btn btn-ghost" type="button" onClick={() => downloadUrl(`/api/qr/${linkId}?format=png&fg=${fg}&bg=${bg}`, `qr-${slug}.png`).then(() => toast("PNG baixado.")).catch((error) => toast(error.message, "error"))}>Baixar PNG</button>
        <button className="btn btn-ghost" type="button" onClick={() => downloadUrl(`/api/qr/${linkId}?format=svg&fg=${fg}&bg=${bg}`, `qr-${slug}.svg`).then(() => toast("SVG baixado.")).catch((error) => toast(error.message, "error"))}>Baixar SVG</button>
        <Link className="btn btn-ghost" href={`/qr?link=${linkId}`}>Personalizar</Link>
      </div>
      <p className="hint mono">{shortUrl}</p>
    </Panel>
  );
}
