"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BreakdownGrid } from "@/components/breakdown";
import { LinkForm } from "@/components/link-form";
import { Button } from "@/components/ui/button";
import { Banner, GrowthStat, PageSkeleton, Panel, RangePicker, Stat, formatAverage } from "@/components/widgets";
import { useRemote } from "@/components/use-remote";
import { copyText, rangeQuery } from "@/lib/client";
import { useToast } from "@/components/providers";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import type { LinkDTO, Overview } from "@/lib/types";

export function DashboardView() {
  const toast = useToast();
  const [range, setRange] = useState("7d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [created, setCreated] = useState<LinkDTO | null>(null);
  const query = useMemo(() => {
    if (range === "custom" && (!from || !to || from > to)) return null;
    return `/api/analytics/overview?${rangeQuery(range, from, to)}`;
  }, [range, from, to]);
  const remote = useRemote<Overview>(query, 15000);

  async function copy(value: string) {
    const ok = await copyText(value);
    toast(ok ? "Link copiado." : "Não foi possível copiar.", ok ? "success" : "error");
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Visão geral</h2>
          <p>Os números vêm dos acessos registrados. Onde não há dado, o painel fica vazio.</p>
        </div>
        <div className="filters">
          <span className="live-dot" aria-hidden />
          <span className="hint">{remote.data ? `Atualizado ${timeAgo(remote.data.generatedAt)}` : "Carregando"}</span>
          <Button variant="outline" type="button" onClick={() => remote.reload()}>Atualizar</Button>
        </div>
      </div>
      <RangePicker range={range} from={from} to={to} onChange={(next) => { setRange(next.range); setFrom(next.from); setTo(next.to); }} />
      {range === "custom" && from && to && from > to ? <Banner tone="error">A data inicial precisa ser anterior à final.</Banner> : null}

      <Panel title="Encurtar uma URL" subtitle="A URL curta aponta para o destino depois das validações de segurança.">
        <LinkForm onSuccess={(link) => { setCreated(link); void remote.reload(); }} />
        {created ? (
          <div className="banner banner-ok" style={{ marginTop: "1rem" }}>
            <strong>{created.title || created.slug}</strong>
            <p className="mono">{created.shortUrl}</p>
            <div className="filters" style={{ marginTop: "0.7rem" }}>
              <Button type="button" onClick={() => copy(created.shortUrl)}>Copiar</Button>
              <Button variant="outline" render={<a href={created.shortUrl} target="_blank" rel="noreferrer" />}>Abrir</Button>
              <Button variant="outline" render={<Link href={`/links/${created.id}`} />}>Ver analytics</Button>
              <Button variant="outline" render={<Link href={`/qr?link=${created.id}`} />}>QR Code</Button>
            </div>
          </div>
        ) : null}
      </Panel>

      {remote.loading && !remote.data ? <PageSkeleton /> : null}
      {remote.error && !remote.data ? <Banner tone="error">{remote.error} <button className="btn btn-ghost" type="button" onClick={() => remote.reload()}>Tentar de novo</button></Banner> : null}
      {remote.data ? <DashboardData data={remote.data} /> : null}
    </div>
  );
}

function DashboardData({ data }: { data: Overview }) {
  return (
    <>
      {!data.analyticsEnabled ? <Banner>A coleta de analytics está desligada. Os redirecionamentos continuam, mas novos cliques não entram nos gráficos.</Banner> : null}
      {data.truncatedByRetention ? <Banner>Parte do período pedido já passou da retenção de {data.retentionDays} dias. O gráfico mostra só o que ainda está guardado. O total acumulado não é apagado por essa limpeza.</Banner> : null}
      <div className="grid-stats">
        <Stat label="Links criados" value={formatNumber(data.totals.links)} />
        <Stat label="Cliques totais" value={formatNumber(data.totals.clicks)} hint="Acumulado de todos os links." />
        <Stat label="Últimos 7 dias" value={formatNumber(data.totals.clicks7d)} />
        <Stat label="Últimos 30 dias" value={formatNumber(data.totals.clicks30d)} />
      </div>
      <div className="grid-stats">
        <Stat label="Cliques no período" value={formatNumber(data.totals.clicksInRange)} hint={data.range.label} />
        <Stat label="Únicos estimados" value={formatNumber(data.totals.uniqueInRange)} hint="Estimativa por dia, sem identificar a pessoa entre datas." />
        <Stat label="Média por link" value={formatAverage(data.totals.avgPerLink)} hint="Total acumulado dividido pelos links." />
        <GrowthStat growth={data.totals.growth} previous={data.totals.previousClicks} />
      </div>
      <p className="hint">Último acesso registrado: {data.totals.lastClickAt ? formatDateTime(data.totals.lastClickAt) : "ainda não houve, ou ele saiu da retenção."}</p>
      <BreakdownGrid
        series={data.series}
        devices={data.devices}
        browsers={data.browsers}
        operatingSystems={data.operatingSystems}
        countries={data.countries}
        continents={data.continents}
        subdivisions={data.subdivisions}
        referrers={data.referrers}
        referrerHosts={data.referrerHosts}
      />
      <div className="grid-2">
        <Panel title="Links mais acessados" subtitle="No período selecionado.">
          {data.topLinks.length === 0 ? <p className="hint">Nenhum clique no período.</p> : (
            <ul className="legend">
              {data.topLinks.slice(0, 5).map((link) => (
                <li key={link.id} className="row-between">
                  <Link href={`/links/${link.id}`}>{link.title || link.slug}</Link>
                  <strong>{formatNumber(link.clicks)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Criados recentemente">
          {data.recentLinks.length === 0 ? <p className="hint">Nenhum link criado ainda.</p> : (
            <ul className="legend">
              {data.recentLinks.map((link) => (
                <li key={link.id}>
                  <Link href={`/links/${link.id}`}>{link.title || link.slug}</Link>
                  <span className="hint">{formatDateTime(link.createdAt)} · {formatNumber(link.clicks)} cliques</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
