/**
 * Jednoduchý CSV builder pro exporty (KVS výkazy apod.).
 * Používá středník jako oddělovač (české Excel locale) a přidává UTF-8 BOM,
 * aby se diakritika ve Wordu/Excelu zobrazila správně.
 */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCell).join(";"),
  );
  // BOM + CRLF řádky (Excel friendly)
  return "﻿" + lines.join("\r\n");
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
