"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDecimal, formatGrowth, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Panel({ title, subtitle, children, action, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("overflow-visible shadow-[var(--shadow)]", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" }) {
  return (
    <Card className="shadow-[var(--shadow)]">
      <CardContent className="grid gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("text-3xl tracking-tight tabular-nums", tone === "positive" && "text-[var(--ok)]", tone === "negative" && "text-destructive")}>{value}</p>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function GrowthStat({ growth, previous }: { growth: number | null; previous: number | null }) {
  const text = formatGrowth(growth);
  return (
    <Stat
      label="Crescimento"
      value={text || "—"}
      tone={growth == null ? undefined : growth >= 0 ? "positive" : "negative"}
      hint={growth == null || previous == null ? "Sem período anterior com dados para comparar." : `${formatNumber(previous)} cliques no período anterior.`}
    />
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  return (
    <Alert variant={tone === "error" ? "destructive" : "default"} className={tone === "ok" ? "border-[var(--ok)] bg-[var(--ok-soft)] text-foreground" : undefined}>
      <AlertDescription className={tone === "error" ? undefined : "text-foreground"}>{children}</AlertDescription>
    </Alert>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? "destructive" : "default"} type="button" disabled={busy} onClick={onConfirm}>{busy ? "Aguarde..." : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SkeletonBlock({ height = 120 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

export function PageSkeleton() {
  return (
    <div className="stack">
      <SkeletonBlock height={42} />
      <div className="grid-stats">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} height={112} />)}</div>
      <SkeletonBlock height={320} />
    </div>
  );
}

const RANGES = [
  ["today", "Hoje"],
  ["7d", "7 dias"],
  ["30d", "30 dias"],
  ["90d", "90 dias"],
  ["custom", "Personalizado"],
] as const;

export function RangePicker({
  range,
  from,
  to,
  onChange,
}: {
  range: string;
  from: string;
  to: string;
  onChange: (next: { range: string; from: string; to: string }) => void;
}) {
  return (
    <div className="filters">
      <div className="seg" role="group" aria-label="Período">
        {RANGES.map(([key, label]) => (
          <Button key={key} variant={range === key ? "default" : "outline"} size="sm" type="button" aria-pressed={range === key} onClick={() => onChange({ range: key, from, to })}>
            {label}
          </Button>
        ))}
      </div>
      {range === "custom" && (
        <>
          <Input className="h-9 w-40" type="date" aria-label="Data inicial" value={from} onChange={(event) => onChange({ range, from: event.target.value, to })} />
          <Input className="h-9 w-40" type="date" aria-label="Data final" value={to} onChange={(event) => onChange({ range, from, to: event.target.value })} />
        </>
      )}
    </div>
  );
}

export function formatAverage(value: number | null) {
  if (value == null) return "—";
  return formatDecimal(value);
}
