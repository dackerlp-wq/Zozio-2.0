"use client";

import { useState } from "react";
import { ChevronDown, Download, Printer, QrCode } from "lucide-react";

import { cn } from "@/lib/utils";

interface QrCardProps {
  animalId: string;
  animalName: string;
}

export function QrCard({ animalId, animalName }: QrCardProps) {
  const [open, setOpen] = useState(false);

  const qrUrl = `/api/qr/${animalId}`;
  const printUrl = `${qrUrl}?size=1024`;

  return (
    <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-meadow-100 text-meadow-700">
            <QrCode className="size-5" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold text-ink-900">
              QR kód
            </span>
            <span className="block text-xs text-ink-600">
              Vytiskni a dej na kotec
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-ink-600 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-5 space-y-4">
          <div className="overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-ink-900/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR kód pro ${animalName}`}
              className="block h-auto w-full"
              width={512}
              height={512}
            />
          </div>
          <div className="flex gap-2">
            <a
              href={printUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-meadow-100 px-3 py-2 text-sm font-semibold text-meadow-700 transition hover:bg-meadow-300/40"
            >
              <Printer className="size-4" /> Pro tisk
            </a>
            <a
              href={printUrl}
              download={`zozio-${animalName}.svg`}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cream-warm px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-meadow-100"
            >
              <Download className="size-4" /> Stáhnout
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
