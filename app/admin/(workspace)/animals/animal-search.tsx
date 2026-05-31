"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SearchItem {
  id: string;
  name: string;
  subtitle: string;
  photo: string | null;
  /** Předpočítané normalizované pole, ve kterých hledáme. */
  haystack: string;
  /** Volitelný štítek, proč se záznam shoduje (kotec, čip…). */
  badge: string | null;
}

/** Bez diakritiky, malá písmena, ořezané. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function AnimalSearch({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = norm(query);

  const matches = useMemo(() => {
    if (q.length < 1) return [];
    return items.filter((it) => it.haystack.includes(q)).slice(0, 8);
  }, [items, q]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/admin/animals/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = matches[active] ?? matches[0];
      if (sel) go(sel.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Hledat podle jména, čísla čipu, tetování, evidenčního čísla nebo kotce…"
          className="w-full rounded-pill bg-cream py-2.5 pl-10 pr-10 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
          aria-label="Vyhledat zvíře"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Vymazat"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && q.length >= 1 && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-cream shadow-soft-lg ring-1 ring-ink-900/10">
          {matches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-ink-500">
              Nic nenalezeno pro „{query}".
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-ink-900/8 overflow-auto">
              {matches.map((it, i) => (
                <li key={it.id}>
                  <button
                    type="button"
                    // onMouseDown místo onClick, aby se neztratil focus dřív (blur)
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(it.id);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                      i === active ? "bg-sage-50" : "hover:bg-sage-50",
                    )}
                  >
                    <span className="size-9 shrink-0 overflow-hidden rounded-lg bg-cream-warm">
                      {it.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.photo}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-base">
                          🐾
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900">
                        {it.name}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {it.subtitle}
                      </span>
                    </span>
                    {it.badge && (
                      <span className="shrink-0 rounded-full bg-cream-warm px-2 py-0.5 text-xs font-medium text-ink-500">
                        {it.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
