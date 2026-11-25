"use client";

import { Bars, Donut, RegionAtlas, TimeSeries } from "@/components/charts";
import { Panel } from "@/components/widgets";
import type { CountPoint, TimePoint } from "@/lib/types";

export function BreakdownGrid({
  series,
  hours,
  devices,
  browsers,
  operatingSystems,
  countries,
  continents,
  subdivisions,
  cities,
  referrers,
  referrerHosts,
}: {
  series: TimePoint[];
  hours?: TimePoint[];
  devices: CountPoint[];
  browsers: CountPoint[];
  operatingSystems: CountPoint[];
  countries: CountPoint[];
  continents: CountPoint[];
  subdivisions: CountPoint[];
  cities?: CountPoint[];
  referrers: CountPoint[];
  referrerHosts: CountPoint[];
}) {
  return (
    <div className="stack">
      <div className="grid-charts">
        <Panel className="span-2" title="Evolução dos cliques" subtitle="Cada ponto é um dia ou uma hora, conforme o período.">
          <TimeSeries points={series} />
        </Panel>
        <Panel title="Dispositivos" subtitle="Desktop, celular e tablet.">
          <Donut points={devices} empty="Nenhum dispositivo identificado neste período." />
        </Panel>
      </div>
      <div className="grid-charts">
        <Panel title="Navegadores">
          <Bars points={browsers} empty="Nenhum navegador identificado neste período." />
        </Panel>
        <Panel title="Sistemas operacionais">
          <Bars points={operatingSystems} empty="Nenhum sistema identificado neste período." />
        </Panel>
      </div>
      {hours ? (
        <Panel title="Cliques por hora" subtitle="Soma das horas do dia dentro do período selecionado.">
          <TimeSeries points={hours} />
        </Panel>
      ) : null}
      <div className="grid-charts">
        <Panel title="Mapa por região" subtitle="Agrupamento do país informado. Não usamos coordenadas do visitante.">
          <RegionAtlas points={continents} />
          <div style={{ marginTop: "1rem" }}>
            <Bars points={countries} empty="Nenhum país identificado. A cidade e o estado também ficam vazios quando o proxy não os envia." />
          </div>
        </Panel>
        <Panel title="Origem do tráfego">
          <Donut points={referrers} empty="Nenhuma origem registrada neste período." />
          <div style={{ marginTop: "1rem" }}>
            <Bars points={referrerHosts} empty="Nenhum site de origem além de acessos diretos." />
          </div>
        </Panel>
      </div>
      {subdivisions.length > 0 || (cities && cities.length > 0) ? (
        <div className="grid-charts">
          <Panel title="Estados ou regiões" subtitle="Mostrado apenas quando essa informação chega no acesso. Pode ser uma sigla.">
            <Bars points={subdivisions} empty="Nenhuma região informada." />
          </Panel>
          {cities ? (
            <Panel title="Cidades" subtitle="Só entram cidades recebidas de forma explícita. O sistema não estima cidade.">
              <Bars points={cities} empty="Nenhuma cidade disponível nestes acessos." />
            </Panel>
          ) : null}
        </div>
      ) : (
        <p className="hint">Estado e cidade não foram informados nestes acessos. Isso é esperado em execução local, sem um proxy que envie o país.</p>
      )}
    </div>
  );
}
