"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addAdoptionCheckin, addAdoptionCommunication } from "./adoption-actions";
import type { CheckinVM, CommunicationVM } from "./adoption-sections";

const METHOD_LABEL: Record<string, string> = {
  phone: "📞 telefonicky",
  visit: "🏠 osobní návštěva",
  message: "💬 zpráva",
};
const COMM_ICON: Record<string, string> = { call: "📞", message: "💬", email: "✉️" };

function czDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ");
}
function czDateTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const inputCls =
  "rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

export function AdoptionMonitoring({
  animalId,
  adoptionId,
  kind,
  readOnly,
  checkins,
  communications,
  showCommunications = true,
}: {
  animalId: string;
  adoptionId: string;
  kind: "trial" | "post_adoption";
  readOnly: boolean;
  checkins: CheckinVM[];
  communications?: CommunicationVM[];
  showCommunications?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [method, setMethod] = useState<"phone" | "visit" | "message">("phone");
  const [note, setNote] = useState("");

  const [commKind, setCommKind] = useState<"call" | "message" | "email">("call");
  const [commNote, setCommNote] = useState("");

  function addCheck() {
    setErr(null);
    startTransition(async () => {
      const res = await addAdoptionCheckin(animalId, adoptionId, { kind, method, note, photos: [] });
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setNote("");
      router.refresh();
    });
  }

  function addComm() {
    setErr(null);
    startTransition(async () => {
      const res = await addAdoptionCommunication(animalId, adoptionId, commKind, commNote);
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setCommNote("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-ink-900/8 pt-4">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {kind === "trial" ? "🔍 Sledování zkušební doby" : "📅 Kontroly po adopci"}
      </p>
      {err && <p className="mb-2 text-sm font-semibold text-meadow-700">{err}</p>}

      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            className={`${inputCls} w-44`}
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          >
            <option value="phone">📞 Telefonicky</option>
            <option value="visit">🏠 Osobní návštěva</option>
            <option value="message">💬 Zpráva</option>
          </select>
          <input
            className={`${inputCls} min-w-0 flex-1`}
            placeholder={kind === "trial" ? "Jak se daří? Zápis kontroly…" : "Jak se daří v novém domově…"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !note.trim()}
            onClick={addCheck}
            className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            Zaznamenat
          </button>
        </div>
      )}

      {checkins.length === 0 ? (
        <p className="py-1 text-sm text-ink-500">Zatím žádné kontroly.</p>
      ) : (
        <div>
          {checkins.map((c) => (
            <div key={c.id} className="flex gap-3 border-b border-ink-900/5 py-2.5 last:border-none">
              <span className="w-14 shrink-0 text-xs font-bold text-ink-500">{czDate(c.date)}</span>
              <div className="min-w-0 flex-1">
                {c.note && <p className="text-sm text-ink-800">{c.note}</p>}
                {c.method && (
                  <p className="mt-0.5 text-xs font-semibold text-ink-500">{METHOD_LABEL[c.method]}</p>
                )}
                {c.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.photos.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={p} alt="" className="size-12 rounded-md object-cover ring-1 ring-ink-900/8" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCommunications && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">
            💬 Komunikace s adoptantem
          </p>
          {!readOnly && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                className={`${inputCls} w-32`}
                value={commKind}
                onChange={(e) => setCommKind(e.target.value as typeof commKind)}
              >
                <option value="call">📞 Hovor</option>
                <option value="message">💬 Zpráva</option>
                <option value="email">✉️ E-mail</option>
              </select>
              <input
                className={`${inputCls} min-w-0 flex-1`}
                placeholder="Text komunikace…"
                value={commNote}
                onChange={(e) => setCommNote(e.target.value)}
              />
              <button
                type="button"
                disabled={pending || !commNote.trim()}
                onClick={addComm}
                className="rounded-pill bg-meadow-500 px-4 py-2 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
              >
                Přidat
              </button>
            </div>
          )}
          {(communications ?? []).length === 0 ? (
            <p className="py-1 text-sm text-ink-500">Zatím žádná komunikace.</p>
          ) : (
            (communications ?? []).map((c) => (
              <div key={c.id} className="flex gap-3 border-b border-ink-900/5 py-2 last:border-none">
                <span className="w-6 shrink-0 text-center">{c.kind ? COMM_ICON[c.kind] : "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800">{c.note}</p>
                  <p className="text-xs text-ink-500">{czDateTime(c.at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
