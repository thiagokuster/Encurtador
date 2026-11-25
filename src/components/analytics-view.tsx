"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BreakdownGrid } from "@/components/breakdown";
import { useToast } from "@/components/providers";
import { Banner, GrowthStat, PageSkeleton, Panel, RangePicker, Stat } from "@/components/widgets";
import { useRemote } from "@/components/use-remote";
import { downloadUrl, rangeQuery } from "@/lib/client";
import { formatNumber, timeAgo } from "@/lib/format";
import type { Overview } from "@/lib/types";

export function AnalyticsView() {
  const toast = useToast();
  const [range, setRange] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useMemo(() => {
    if (range === "custom" && (!from || !to || from > to)) return null;
    return `/api/analytics/overview?${rangeQuery(range, from, to)}`;
  }, [range, from, to]);
  const remote = useRemote<Overview>(query, 15000);

  async function exportCsv() {
    try {
      await downloadUrl(`/api/export?${rangeQuery(range, from, to)}`, "encurtador-analytics.csv");
      toast("Relatório exportado.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Não foi possível exportar.", "error");
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2>Analytics</h2>
          <p>Filtros e exportação usam os eventos reais do período. Células vazias no CSV significam dado indisponível.</p>
        </div>
        <div className="filters">
          <span className="live-dot" aria-hidden />
          <span className="hint">{remote.data ? timeAgo(remote.data.generatedAt) : ""}</span>
          <button className="btn btn-ghost" type="button" onClick={() => remote.reload()}>Atualizar</button>
          <button className="btn btn-primary" type="button" onClick={exportCsv} disabled={!query}>Exportar CSV</button>
        </div>
      </div>
      <RangePicker range={range} from={from} to={to} onChange={(next) => { setRange(next.range); setFrom(next.from); setTo(next.to); }} />
      {remote.loading && !remote.data ? <PageSkeleton /> : null}
      {remote.error && !remote.data ? <Banner tone="error">{remote.error}</Banner> : null}
      {remote.data ? (
        <>
          {!remote.data.analyticsEnabled ? <Banner>A coleta está desligada nas configurações.</Banner> : null}
          {remote.data.truncatedByRetention ? <Banner>A retenção de {remote.data.retentionDays} dias limita este período.</Banner> : null}
          <div className="grid-stats">
            <Stat label="Cliques no período" value={formatNumber(remote.data.totals.clicksInRange)} hint={remote.data.range.label} />
            <Stat label="Únicos estimados" value={formatNumber(remote.data.totals.uniqueInRange)} hint="Estimativa diária, sem fingerprint." />
            <GrowthStat growth={remote.data.totals.growth} previous={remote.data.totals.previousClicks} />
            <Stat label="Links" value={formatNumber(remote.data.totals.links)} />
          </div>
          <BreakdownGrid
            series={remote.data.series}
            devices={remote.data.devices}
            browsers={remote.data.browsers}
            operatingSystems={remote.data.operatingSystems}
            countries={remote.data.countries}
            continents={remote.data.continents}
            subdivisions={remote.data.subdivisions}
            referrers={remote.data.referrers}
            referrerHosts={remote.data.referrerHosts}
          />
          <Panel title="Desempenho por link" subtitle="Relatório do período. Abra um link para o detalhe e para exportar só ele.">
            {remote.data.topLinks.length === 0 ? <p className="hint">Nenhum clique no período.</p> : (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Link</th><th>Endereço</th><th>Cliques</th></tr></thead>
                  <tbody>
                    {remote.data.topLinks.map((link) => (
                      <tr key={link.id}>
                        <td><Link href={`/links/${link.id}`}>{link.title || link.slug}</Link></td>
                        <td className="mono">{link.shortUrl}</td>
                        <td>{formatNumber(link.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
