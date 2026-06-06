"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { NameValue, PeriodKind, StatsData } from "@/lib/stats";

export type StatsSection =
  | "prehled"
  | "zvirata"
  | "adopce"
  | "pestouni"
  | "obsazenost"
  | "finance"
  | "web";

const C = {
  coral: "#E8634A",
  success: "#1A7A45",
  amber: "#F0A500",
  sand2: "#C9A87C",
  brownMid: "#9B5E35",
  grayLight: "#D4C4B0",
};
const SERIES = [C.coral, C.amber, C.sand2, C.brownMid, C.grayLight];

const SECTION_TITLE: Record<StatsSection, string> = {
  prehled: "Přehled",
  zvirata: "🐾 Zvířata — detail",
  adopce: "🤝 Adopce — detail",
  pestouni: "🏡 Pěstouni — detail",
  obsazenost: "🏘️ Obsazenost — detail",
  finance: "💰 Finance — detail",
  web: "🌐 Web & zájem — detail",
};

const fmt = (n: number) => n.toLocaleString("cs-CZ");
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)} tis.` : fmt(n));
const fmtCzk = (n: number) => `${fmt(n)} Kč`;

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + [headers, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StatsView({
  section,
  data,
  prev,
  periodKind,
  periodLabel,
  prevLabel,
  from,
  to,
  compare,
  canExport,
}: {
  section: StatsSection;
  data: StatsData;
  prev: StatsData | null;
  periodKind: PeriodKind;
  periodLabel: string;
  prevLabel: string;
  from: string;
  to: string;
  compare: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, val: string | null) {
    const p = new URLSearchParams(params.toString());
    if (val === null) p.delete(key);
    else p.set(key, val);
    router.push(`/admin/stats?${p.toString()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Statistiky</h2>
          <p className="mt-1 text-ink-600">Vyber oblast vlevo. Filtr období platí pro všechny.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/15">
            {(["month", "year", "custom"] as PeriodKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setParam("obdobi", k)}
                className={cn(
                  "px-3 py-2 text-xs font-bold",
                  periodKind === k ? "bg-ink-900 text-cream" : "bg-cream text-ink-600",
                )}
              >
                {k === "month" ? "Měsíc" : k === "year" ? "Rok" : "Vlastní"}
              </button>
            ))}
          </div>
          {periodKind === "custom" && (
            <div className="flex items-center gap-1">
              <input type="date" defaultValue={from} onChange={(e) => setParam("from", e.target.value)} className="rounded-pill bg-cream-warm px-2 py-1.5 text-xs ring-1 ring-ink-900/10" />
              <input type="date" defaultValue={to} onChange={(e) => setParam("to", e.target.value)} className="rounded-pill bg-cream-warm px-2 py-1.5 text-xs ring-1 ring-ink-900/10" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setParam("srovnat", compare ? null : "1")}
            className={cn(
              "rounded-pill border-[1.5px] px-3 py-2 text-xs font-bold transition-colors",
              compare ? "border-meadow-500 bg-meadow-50 text-meadow-700" : "border-ink-900/15 bg-cream text-ink-700",
            )}
          >
            ⇄ Srovnat: {prevLabel}
          </button>
          {canExport && (
            <a
              href={`/api/admin/exports/annual?from=${from}&to=${to}`}
              className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-3 py-2 text-xs font-bold text-ink-700 hover:border-ink-900/30"
            >
              <FileText className="size-3.5" /> Výroční zpráva
            </a>
          )}
        </div>
      </div>

      {section !== "prehled" && (
        <h3 className="font-display text-xl font-bold text-brown">{SECTION_TITLE[section]}</h3>
      )}

      {section === "prehled" && <Overview data={data} prev={prev} canExport={canExport} />}
      {section === "zvirata" && <AnimalsPanel data={data} prev={prev} canExport={canExport} />}
      {section === "adopce" && <AdoptionPanel data={data} prev={prev} canExport={canExport} />}
      {section === "pestouni" && <FosterPanel data={data} prev={prev} canExport={canExport} />}
      {section === "obsazenost" && <OccupancyPanel data={data} prev={prev} canExport={canExport} />}
      {section === "finance" && <FinancePanel data={data} prev={prev} canExport={canExport} />}
      {section === "web" && <WebPanel data={data} canExport={canExport} />}
    </div>
  );
}

// --- KPI ---------------------------------------------------------------------

function Kpi({
  label,
  value,
  cur,
  prev,
  lowerBetter,
  unit,
}: {
  label: string;
  value: string;
  cur?: number | null;
  prev?: number | null;
  lowerBetter?: boolean;
  unit?: string;
}) {
  let delta: { txt: string; cls: string } | null = null;
  if (cur != null && prev != null) {
    const diff = cur - prev;
    if (Math.abs(diff) < 0.0001) delta = { txt: "≈", cls: "text-ink-400" };
    else {
      const good = lowerBetter ? diff < 0 : diff > 0;
      const arrow = diff > 0 ? "▲" : "▼";
      const pct = prev !== 0 ? Math.round((diff / Math.abs(prev)) * 100) : null;
      const mag = pct != null ? `${Math.abs(pct)} %` : `${Math.abs(Math.round(diff))}${unit ? ` ${unit}` : ""}`;
      delta = { txt: `${arrow} ${mag}`, cls: good ? "text-fern-600" : "text-terracotta-600" };
    }
  }
  return (
    <div className="rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8">
      <div className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-ink-900">{value}</div>
      {delta && <div className={cn("mt-1 text-xs font-bold", delta.cls)}>{delta.txt}</div>}
    </div>
  );
}

function ChartCard({
  title,
  sub,
  onExport,
  children,
  empty,
}: {
  title: string;
  sub?: string;
  onExport?: () => void;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
      <div className="mb-3 flex items-start gap-2">
        <div>
          <h4 className="font-display text-base font-bold text-ink-900">{title}</h4>
          {sub && <p className="text-xs text-ink-400">{sub}</p>}
        </div>
        {onExport && !empty && (
          <button
            type="button"
            onClick={onExport}
            aria-label="Stáhnout CSV"
            className="ml-auto grid size-8 place-items-center rounded-lg text-ink-400 ring-1 ring-ink-900/10 hover:text-meadow-600"
          >
            <Download className="size-4" />
          </button>
        )}
      </div>
      {empty ? <EmptyState /> : children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center py-10 text-center">
      <div className="text-2xl">📭</div>
      <p className="mt-2 text-sm text-ink-400">Zatím nemáme dost dat za toto období.</p>
    </div>
  );
}

// --- Charts ------------------------------------------------------------------

function MonthlyBars({ data, keys, colors, labels }: { data: { label: string }[]; keys: string[]; colors: string[]; labels: string[] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8B7355" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8B7355" }} width={36} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0E8DC", fontSize: 12 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} name={labels[i]} fill={colors[i]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <Legend items={labels.map((l, i) => ({ label: l, color: colors[i] }))} />
    </>
  );
}

function Donut({ data }: { data: NameValue[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-5">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i % SERIES.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0E8DC", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="min-w-32 flex-1">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 py-1 text-sm font-semibold">
            <span className="size-3 rounded" style={{ background: SERIES[i % SERIES.length] }} />
            {d.name}
            <span className="ml-auto text-ink-400">
              {total > 0 ? `${Math.round((d.value / total) * 100)} %` : d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBars({ data, suffix }: { data: { name: string; value: number; display?: string }[]; suffix?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-right text-xs font-bold text-brown-mid">{d.name}</span>
          <span className="h-4 flex-1 overflow-hidden rounded-pill bg-ink-900/8">
            <span className="block h-full rounded-pill" style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: SERIES[i % SERIES.length] }} />
          </span>
          <span className="w-14 text-xs font-bold text-brown">{d.display ?? (suffix ? `${d.value}${suffix}` : fmt(d.value))}</span>
        </div>
      ))}
    </div>
  );
}

function Funnel({ data }: { data: NameValue[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs font-bold text-brown-mid">{d.name}</span>
          <span
            className="flex h-8 items-center rounded-lg bg-meadow-500 pl-3 text-sm font-bold text-cream"
            style={{ width: `${Math.max(12, (d.value / max) * 100)}%` }}
          >
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function AreaLine({ data }: { data: { label: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.coral} stopOpacity={0.25} />
            <stop offset="100%" stopColor={C.coral} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8B7355" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8B7355" }} width={36} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0E8DC", fontSize: 12 }} />
        <Area type="monotone" dataKey="value" stroke={C.coral} strokeWidth={2.5} fill="url(#g)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs font-bold text-brown-mid">
          <span className="size-3 rounded" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={h} className={cn("border-b border-ink-900/8 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-400", i === 0 ? "text-left" : "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="hover:bg-cream-warm/60">
              {r.map((c, ci) => (
                <td key={ci} className={cn("border-b border-ink-900/8 px-2 py-1.5", ci === 0 ? "text-left font-bold text-ink-900" : "text-right font-semibold text-brown-mid")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Panels ------------------------------------------------------------------

function Overview({ data, prev, canExport }: { data: StatsData; prev: StatsData | null; canExport: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Přijato" value={fmt(data.intake)} cur={data.intake} prev={prev?.intake} />
        <Kpi label="Adoptováno" value={fmt(data.adopted)} cur={data.adopted} prev={prev?.adopted} />
        <Kpi label="Ø délka pobytu" value={data.avgStayDays != null ? `${data.avgStayDays} dní` : "—"} cur={data.avgStayDays} prev={prev?.avgStayDays} lowerBetter unit="dní" />
        <Kpi label="Míra adopce" value={data.adoptionRate != null ? `${data.adoptionRate} %` : "—"} cur={data.adoptionRate} prev={prev?.adoptionRate} />
        <Kpi label="Náklady" value={fmtK(data.costs)} cur={data.costs} prev={prev?.costs} lowerBetter />
        <Kpi label="Dary" value={fmtK(data.donations)} cur={data.donations} prev={prev?.donations} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Příjmy vs. výdeje" sub="Po měsících." empty={data.monthly.every((m) => !m.intake && !m.out)} onExport={canExport ? () => downloadCsv("prijmy-vydeje.csv", ["Měsíc", "Přijato", "Vydáno"], data.monthly.map((m) => [m.label, m.intake, m.out])) : undefined}>
          <MonthlyBars data={data.monthly} keys={["intake", "out"]} colors={[C.coral, C.success]} labels={["Přijato", "Vydáno"]} />
        </ChartCard>
        <ChartCard title="Skladba výdejů" sub="Jak odcházejí." empty={data.exitBreakdown.length === 0} onExport={canExport ? () => downloadCsv("skladba-vydeju.csv", ["Typ", "Počet"], data.exitBreakdown.map((d) => [d.name, d.value])) : undefined}>
          <Donut data={data.exitBreakdown} />
        </ChartCard>
      </div>
    </>
  );
}

function AnimalsPanel({ data, prev, canExport }: { data: StatsData; prev: StatsData | null; canExport: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Přijato" value={fmt(data.intake)} cur={data.intake} prev={prev?.intake} />
        <Kpi label="Vydáno" value={fmt(data.outTotal)} cur={data.outTotal} prev={prev?.outTotal} />
        <Kpi label="Aktuálně v útulku" value={fmt(data.inShelter)} />
        <Kpi label="Ø délka pobytu" value={data.avgStayDays != null ? `${data.avgStayDays} dní` : "—"} cur={data.avgStayDays} prev={prev?.avgStayDays} lowerBetter unit="dní" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Délka pobytu" sub="Jak dlouho čekají na domov." empty={data.stayDistribution.every((d) => !d.value)} onExport={canExport ? () => downloadCsv("delka-pobytu.csv", ["Pásmo", "Počet"], data.stayDistribution.map((d) => [d.name, d.value])) : undefined}>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data.stayDistribution} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#8B7355" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8B7355" }} width={30} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F0E8DC", fontSize: 12 }} />
              <Bar dataKey="value" name="Zvířat" fill={C.amber} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Druhové složení" sub="Co máme." empty={data.speciesBreakdown.length === 0} onExport={canExport ? () => downloadCsv("druhy.csv", ["Druh", "Počet"], data.speciesBreakdown.map((d) => [d.name, d.value])) : undefined}>
          <Donut data={data.speciesBreakdown} />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Důvody příjmu" sub="Odkud přicházejí." empty={data.intakeReasons.length === 0} onExport={canExport ? () => downloadCsv("duvody-prijmu.csv", ["Důvod", "Počet"], data.intakeReasons.map((d) => [d.name, d.value])) : undefined}>
          <HBars data={data.intakeReasons} />
        </ChartCard>
        <ChartCard title="Měsíční přehled" sub="Pohyb stavu." empty={data.monthlyTable.every((m) => !m.intake && !m.out)} onExport={canExport ? () => downloadCsv("mesicni-prehled.csv", ["Měsíc", "Přijato", "Vydáno"], data.monthlyTable.map((m) => [m.label, m.intake, m.out])) : undefined}>
          <Table headers={["Měsíc", "Přijato", "Vydáno"]} rows={data.monthlyTable.map((m) => [m.label, m.intake, m.out])} />
        </ChartCard>
      </div>
    </>
  );
}

function AdoptionPanel({ data, prev, canExport }: { data: StatsData; prev: StatsData | null; canExport: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Adopcí" value={fmt(data.adopted)} cur={data.adopted} prev={prev?.adopted} />
        <Kpi label="Míra adopce" value={data.adoptionRate != null ? `${data.adoptionRate} %` : "—"} cur={data.adoptionRate} prev={prev?.adoptionRate} />
        <Kpi label="Ø doba do adopce" value={data.avgDaysToAdopt != null ? `${data.avgDaysToAdopt} dní` : "—"} cur={data.avgDaysToAdopt} prev={prev?.avgDaysToAdopt} lowerBetter unit="dní" />
        <Kpi label="Míra vrácení" value={data.returnRate != null ? `${data.returnRate} %` : "—"} cur={data.returnRate} prev={prev?.returnRate} lowerBetter />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Adopční trychtýř" sub="Od žádosti po domov." empty={data.adoptionFunnel.every((d) => !d.value)} onExport={canExport ? () => downloadCsv("trychtyr.csv", ["Krok", "Počet"], data.adoptionFunnel.map((d) => [d.name, d.value])) : undefined}>
          <Funnel data={data.adoptionFunnel} />
        </ChartCard>
        <ChartCard title="Adopce dle druhu" sub="Kdo nachází domov." empty={data.adoptionsBySpecies.length === 0} onExport={canExport ? () => downloadCsv("adopce-druh.csv", ["Druh", "Počet"], data.adoptionsBySpecies.map((d) => [d.name, d.value])) : undefined}>
          <Donut data={data.adoptionsBySpecies} />
        </ChartCard>
      </div>
      <ChartCard title="Důvody zamítnutí / vrácení" sub="Kde to drhne." empty={data.rejectionReasons.length === 0} onExport={canExport ? () => downloadCsv("duvody-zamitnuti.csv", ["Důvod", "Počet"], data.rejectionReasons.map((d) => [d.name, d.value])) : undefined}>
        <HBars data={data.rejectionReasons} />
      </ChartCard>
    </>
  );
}

function FosterPanel({ data, prev, canExport }: { data: StatsData; prev: StatsData | null; canExport: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pěstounů" value={fmt(data.fosterCount)} cur={data.fosterCount} prev={prev?.fosterCount} />
        <Kpi label="Aktuálně v péči" value={fmt(data.inFosterCare)} />
        <Kpi label="Ø délka u pěstouna" value={data.avgFosterDays != null ? `${data.avgFosterDays} dní` : "—"} cur={data.avgFosterDays} prev={prev?.avgFosterDays} unit="dní" />
        <Kpi label="Foster-to-adopt" value={data.fosterToAdopt != null ? `${data.fosterToAdopt} %` : "—"} cur={data.fosterToAdopt} prev={prev?.fosterToAdopt} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Využití kapacity" sub="Obsazená místa u pěstounů." empty={data.fosterCapacity.length === 0} onExport={canExport ? () => downloadCsv("kapacita-pestouni.csv", ["Pěstoun", "Obsazeno", "Kapacita"], data.fosterCapacity.map((d) => [d.name, d.used, d.cap])) : undefined}>
          <HBars data={data.fosterCapacity.map((d) => ({ name: d.name, value: d.cap ? Math.round((d.used / d.cap) * 100) : 0, display: `${d.used}/${d.cap}` }))} />
        </ChartCard>
        <ChartCard title="Top pěstouni" sub="Nejvíc odchovaných." empty={data.topFosters.length === 0} onExport={canExport ? () => downloadCsv("top-pestouni.csv", ["Pěstoun", "Celkem", "Teď", "Ø dní"], data.topFosters.map((d) => [d.name, d.total, d.now, d.avg ?? ""])) : undefined}>
          <Table headers={["Pěstoun", "Celkem", "Teď", "Ø dní"]} rows={data.topFosters.map((d) => [d.name, d.total, d.now, d.avg ?? "—"])} />
        </ChartCard>
      </div>
    </>
  );
}

function OccupancyPanel({ data, prev, canExport }: { data: StatsData; prev: StatsData | null; canExport: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Kapacita" value={fmt(data.capacity)} />
        <Kpi label="Ø obsazenost" value={data.avgOccupancy != null ? `${data.avgOccupancy} %` : "—"} cur={data.avgOccupancy} prev={prev?.avgOccupancy} />
        <Kpi label="Volno teď" value={fmt(data.freeNow)} />
        <Kpi label="Obsazeno teď" value={fmt(Math.max(0, data.capacity - data.freeNow))} />
      </div>
      <ChartCard title="Dle budovy / zóny" sub="Aktuální využití." empty={data.occupancyByZone.length === 0} onExport={canExport ? () => downloadCsv("obsazenost-zona.csv", ["Zóna", "Využití %"], data.occupancyByZone.map((d) => [d.name, d.pct])) : undefined}>
        <HBars data={data.occupancyByZone.map((d) => ({ name: d.name, value: d.pct, display: `${d.pct} %` }))} />
      </ChartCard>
    </>
  );
}

function FinancePanel({ data, prev, canExport }: { data: StatsData; prev: StatsData | null; canExport: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Náklady" value={fmtK(data.costs)} cur={data.costs} prev={prev?.costs} lowerBetter />
        <Kpi label="Dary & sbírky" value={fmtK(data.donations)} cur={data.donations} prev={prev?.donations} />
        <Kpi label="Bilance" value={fmtK(data.balance)} cur={data.balance} prev={prev?.balance} />
        <Kpi label="Ø náklad / zvíře" value={data.avgCostPerAnimal != null ? fmtCzk(data.avgCostPerAnimal) : "—"} cur={data.avgCostPerAnimal} prev={prev?.avgCostPerAnimal} lowerBetter />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Náklady vs. dary" sub="Po měsících." empty={data.costsVsDonations.every((m) => !m.costs && !m.donations)} onExport={canExport ? () => downloadCsv("naklady-dary.csv", ["Měsíc", "Náklady", "Dary"], data.costsVsDonations.map((m) => [m.label, m.costs, m.donations])) : undefined}>
          <MonthlyBars data={data.costsVsDonations} keys={["costs", "donations"]} colors={[C.coral, C.success]} labels={["Náklady", "Dary"]} />
        </ChartCard>
        <ChartCard title="Náklady dle kategorie" sub="Kam jdou peníze." empty={data.costsByCategory.length === 0} onExport={canExport ? () => downloadCsv("naklady-kategorie.csv", ["Kategorie", "Kč"], data.costsByCategory.map((d) => [d.name, d.value])) : undefined}>
          <HBars data={data.costsByCategory} suffix=" Kč" />
        </ChartCard>
      </div>
      <ChartCard title="Nejnákladnější zvířata" sub="Včetně pokrytí z darů." empty={data.topCostAnimals.length === 0} onExport={canExport ? () => downloadCsv("nejnakladnejsi.csv", ["Zvíře", "Náklady", "Pokryto dary", "Bilance"], data.topCostAnimals.map((d) => [d.name, d.costs, d.covered, d.balance])) : undefined}>
        <Table headers={["Zvíře", "Náklady", "Pokryto dary", "Bilance"]} rows={data.topCostAnimals.map((d) => [d.name, fmtCzk(d.costs), fmtCzk(d.covered), fmtCzk(d.balance)])} />
      </ChartCard>
    </>
  );
}

function WebPanel({ data, canExport }: { data: StatsData; canExport: boolean }) {
  if (!data.hasWebData) {
    return (
      <div className="rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
        <div className="text-3xl">🌐</div>
        <p className="mt-3 font-display text-lg font-bold text-ink-900">Zatím nemáme dost dat</p>
        <p className="mt-1 text-sm text-ink-500">
          Zobrazení profilů se začínají počítat od zveřejnění zvířat. Brzy tu uvidíš zájem návštěvníků.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Návštěvy profilů" value={fmt(data.webVisits)} />
        <Kpi label="Žádostí z webu" value={fmt(data.webApplications)} />
        <Kpi label="Konverze" value={data.webConversion != null ? `${data.webConversion} %` : "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Návštěvy v čase" sub="Zájem o profily." empty={data.visitsOverTime.every((m) => !m.value)} onExport={canExport ? () => downloadCsv("navstevy.csv", ["Měsíc", "Návštěvy"], data.visitsOverTime.map((m) => [m.label, m.value])) : undefined}>
          <AreaLine data={data.visitsOverTime} />
        </ChartCard>
        <ChartCard title="Nejžádanější zvířata" sub="Podle zobrazení profilu." empty={data.topAnimalsByViews.length === 0} onExport={canExport ? () => downloadCsv("nejzadanejsi.csv", ["Zvíře", "Zobrazení"], data.topAnimalsByViews.map((d) => [d.name, d.value])) : undefined}>
          <HBars data={data.topAnimalsByViews.map((d) => ({ name: d.name, value: d.value, display: `${fmt(d.value)}×` }))} />
        </ChartCard>
      </div>
    </>
  );
}
