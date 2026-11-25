"use client";

import { useState } from "react";
import { REGION_ORDER } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { CountPoint, TimePoint } from "@/lib/types";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];

export function EmptyChart({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {message}
    </div>
  );
}

function HiddenTable({ points }: { points: Array<{ label: string; clicks: number }> }) {
  return (
    <table className="sr-only">
      <caption>Dados do gráfico</caption>
      <thead><tr><th>Item</th><th>Cliques</th></tr></thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.label}><td>{point.label}</td><td>{point.clicks}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export function TimeSeries({ points }: { points: TimePoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0 || points.every((point) => point.clicks === 0)) {
    return <EmptyChart title="Sem cliques neste período" message="O gráfico aparece quando houver acessos reais." />;
  }
  const width = 640;
  const height = 230;
  const pad = { l: 36, r: 12, t: 18, b: 32 };
  const max = Math.max(1, ...points.map((point) => point.clicks));
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const coords = points.map((point, index) => {
    const x = pad.l + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const y = pad.t + innerH - (point.clicks / max) * innerH;
    return { ...point, x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${pad.t + innerH} L${coords[0].x},${pad.t + innerH} Z`;
  const current = active == null ? null : coords[active];
  const step = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="chart-box">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Evolução de cliques"
        onMouseLeave={() => setActive(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * width;
          let nearest = 0;
          let distance = Infinity;
          coords.forEach((point, index) => {
            const delta = Math.abs(point.x - x);
            if (delta < distance) {
              distance = delta;
              nearest = index;
            }
          });
          setActive(nearest);
        }}
      >
        {[0, 0.5, 1].map((mark) => {
          const y = pad.t + innerH - mark * innerH;
          return (
            <g key={mark}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="var(--line)" />
              <text x={0} y={y + 4} fill="var(--muted)" fontSize="11">{formatNumber(Math.round(max * mark))}</text>
            </g>
          );
        })}
        <path d={area} fill="var(--chart-1)" opacity="0.16" />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" />
        {coords.map((point, index) => (
          <g key={point.key}>
            {(index % step === 0 || index === coords.length - 1) && (
              <text x={point.x} y={height - 8} textAnchor="middle" fill="var(--muted)" fontSize="11">{point.label}</text>
            )}
            {active === index && <circle cx={point.x} cy={point.y} r="4.5" fill="var(--chart-2)" />}
          </g>
        ))}
      </svg>
      {current && (
        <div className="tooltip" style={{ left: `${(current.x / width) * 100}%`, top: `${(current.y / height) * 100}%` }}>
          {current.label}: {formatNumber(current.clicks)}
        </div>
      )}
      <HiddenTable points={points} />
    </div>
  );
}

export function Donut({ points, empty }: { points: CountPoint[]; empty: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = points.reduce((sum, point) => sum + point.clicks, 0);
  if (!total) return <EmptyChart title="Sem dados" message={empty} />;
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div>
      <div className="chart-box" style={{ minHeight: 180 }}>
        <svg viewBox="0 0 160 160" role="img" aria-label="Distribuição">
          <g transform="rotate(-90 80 80)">
            {points.map((point, index) => {
              const length = (point.clicks / total) * circ;
              const dash = `${length} ${circ - length}`;
              const node = (
                <circle
                  key={point.key}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={active === index ? 18 : 14}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                />
              );
              offset += length;
              return node;
            })}
          </g>
          <text x="80" y="76" textAnchor="middle" fill="var(--ink)" fontSize="18" fontWeight="700">{formatNumber(total)}</text>
          <text x="80" y="94" textAnchor="middle" fill="var(--muted)" fontSize="10">cliques</text>
        </svg>
      </div>
      <div className="legend">
        {points.map((point, index) => (
          <div key={point.key}>
            <span><i style={{ background: COLORS[index % COLORS.length], display: "inline-block", width: 8, height: 8, borderRadius: 99, marginRight: 6 }} />{point.label}</span>
            <strong>{formatNumber(point.clicks)} · {Math.round((point.clicks / total) * 100)}%</strong>
          </div>
        ))}
      </div>
      <HiddenTable points={points} />
    </div>
  );
}

export function Bars({ points, empty }: { points: CountPoint[]; empty: string }) {
  if (points.length === 0) return <EmptyChart title="Sem dados" message={empty} />;
  const max = Math.max(...points.map((point) => point.clicks));
  return (
    <div className="legend">
      {points.map((point, index) => (
        <div className="bar-row" key={point.key}>
          <span>{point.label}</span>
          <strong>{formatNumber(point.clicks)}</strong>
          <div className="bar"><span style={{ width: `${Math.max(4, (point.clicks / max) * 100)}%`, background: COLORS[index % COLORS.length] }} /></div>
        </div>
      ))}
      <HiddenTable points={points} />
    </div>
  );
}

export function RegionAtlas({ points }: { points: CountPoint[] }) {
  if (points.length === 0) {
    return <EmptyChart title="Sem país identificado" message="A localização só aparece quando a infraestrutura informa o país. O IP não é armazenado." />;
  }
  const max = Math.max(...points.map((point) => point.clicks));
  const byName = new Map(points.map((point) => [point.label, point]));
  return (
    <div className="atlas">
      {REGION_ORDER.filter((name) => byName.has(name)).map((name) => {
        const point = byName.get(name)!;
        return (
          <div key={name} className="atlas-cell" style={{ opacity: 0.45 + (point.clicks / max) * 0.55 }}>
            <strong>{name}</strong>
            <span>{formatNumber(point.clicks)} cliques</span>
          </div>
        );
      })}
    </div>
  );
}
