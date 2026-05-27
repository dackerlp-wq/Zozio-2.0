"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface AnimalShareProps {
  animal: { id: string; name: string };
  className?: string;
}

export function AnimalShare({ animal, className }: AnimalShareProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `https://zozio.cz/animals/${animal.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop — clipboard API not available
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !("share" in navigator)) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: `${animal.name} hledá domov · Zozio`,
        url: window.location.href,
      });
    } catch {
      // user cancelled or unsupported
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        onClick={handleNativeShare}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cream/15 px-3 py-2 text-sm font-semibold text-cream backdrop-blur transition hover:bg-cream/25"
      >
        <Share2 className="size-4" /> Sdílet
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cream/15 px-3 py-2 text-sm font-semibold text-cream backdrop-blur transition hover:bg-cream/25"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Zkopírováno" : "Kopírovat odkaz"}
      </button>
    </div>
  );
}
