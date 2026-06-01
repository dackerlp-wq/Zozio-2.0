"use client";

import { useState, useTransition } from "react";
import { Check, PhoneOff, Sparkles, X } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import {
  APPLICATION_STATUS_FLOW,
  APPLICATION_STATUS_LABEL,
} from "@/lib/format";
import type { ApplicationStatus } from "@/types/database";

import {
  approveApplication,
  completeAdoption,
  confirmPhoneContact,
  markContractSigned,
  markPhoneIncomplete,
  moveToReview,
  rejectApplication,
  scheduleMeeting,
} from "../actions";
import { generateAdoptionRecommendations } from "../ai-actions";

type Result = { error: string } | { ok: true };

function dateTimeLocalDefault() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  // YYYY-MM-DDTHH:mm v lokálním čase
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StatusControls({
  id,
  status,
  meetingAt,
  meetingLocation,
}: {
  id: string;
  status: ApplicationStatus;
  meetingAt: string | null;
  meetingLocation: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  // Stavy formulářů jednotlivých kroků
  const [meetingDate, setMeetingDate] = useState(dateTimeLocalDefault);
  const [meetingPlace, setMeetingPlace] = useState(meetingLocation ?? "");
  const [phoneNote, setPhoneNote] = useState("");
  const [fee, setFee] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [aiPending, setAiPending] = useState(false);

  function suggestRecommendations() {
    setError(null);
    setAiPending(true);
    (async () => {
      const res = await generateAdoptionRecommendations(id);
      if ("error" in res) setError(res.error);
      else setRecommendations(res.text);
      setAiPending(false);
    })();
  }

  const isRejected = status === "rejected";
  const currentIndex = APPLICATION_STATUS_FLOW.indexOf(status);

  function run(fn: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setError(res.error);
      else onOk?.();
    });
  }

  return (
    <div className="mt-4 space-y-5">
      {/* Vizuální postup */}
      <div className="flex flex-wrap gap-2">
        {APPLICATION_STATUS_FLOW.map((s, i) => {
          const done = !isRejected && i < currentIndex;
          const active = !isRejected && i === currentIndex;
          return (
            <span
              key={s}
              className={
                active
                  ? "inline-flex items-center gap-1.5 rounded-full bg-meadow-500 px-3.5 py-1.5 text-sm font-semibold text-cream"
                  : done
                    ? "inline-flex items-center gap-1.5 rounded-full bg-meadow-100 px-3.5 py-1.5 text-sm font-semibold text-meadow-700"
                    : "inline-flex items-center gap-1.5 rounded-full bg-cream-warm px-3.5 py-1.5 text-sm font-semibold text-ink-400 ring-1 ring-ink-900/8"
              }
            >
              {done && <Check className="size-3.5" />}
              {APPLICATION_STATUS_LABEL[s]}
            </span>
          );
        })}
      </div>

      {/* Akční panel podle aktuálního kroku */}
      {!isRejected && (
        <div className="rounded-2xl bg-cream-warm p-4 ring-1 ring-ink-900/5">
          {status === "new" && (
            <StepBox
              title="Začít posuzování"
              hint="Žadatel dostane e-mail, že jeho žádost posuzujete."
            >
              <ZozioButton
                size="sm"
                disabled={isPending}
                onClick={() => run(() => moveToReview(id))}
              >
                Posoudit žádost
              </ZozioButton>
            </StepBox>
          )}

          {status === "review" && (
            <StepBox
              title="Telefonický kontakt"
              hint="Zavolejte zájemci. Když potvrdí zájem, rezervujte zvíře. Když se nedovoláte, pošlete výzvu k ozvání."
            >
              <div className="flex flex-wrap items-start gap-2">
                <ZozioButton
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => confirmPhoneContact(id))}
                >
                  <Check /> Zájem potvrzen — rezervovat
                </ZozioButton>
                <div className="flex flex-col gap-2">
                  <input
                    value={phoneNote}
                    onChange={(e) => setPhoneNote(e.target.value)}
                    placeholder="Poznámka (nezvedl, jiný problém)…"
                    className="w-64 rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
                  />
                  <ZozioButton
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      run(() => markPhoneIncomplete(id, phoneNote), () =>
                        setPhoneNote(""),
                      )
                    }
                  >
                    <PhoneOff /> Nepodařilo se dovolat
                  </ZozioButton>
                </div>
              </div>
            </StepBox>
          )}

          {status === "phone_contact" && (
            <StepBox
              title="Domluvit osobní schůzku"
              hint="Zadejte termín a místo. Zájemci odejde e-mail s detaily a den předem připomínka."
            >
              <div className="space-y-2">
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
                />
                <input
                  value={meetingPlace}
                  onChange={(e) => setMeetingPlace(e.target.value)}
                  placeholder="Místo schůzky (volitelné)…"
                  className="block w-72 rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
                />
                <ZozioButton
                  size="sm"
                  disabled={isPending || !meetingDate}
                  onClick={() =>
                    run(() =>
                      scheduleMeeting(
                        id,
                        new Date(meetingDate).toISOString(),
                        meetingPlace,
                      ),
                    )
                  }
                >
                  Naplánovat schůzku
                </ZozioButton>
              </div>
            </StepBox>
          )}

          {status === "in_person_meeting" && (
            <StepBox
              title="Schválit adopci"
              hint="Po schůzce schvalte adopci. Zájemci přijde e-mail se schválením a PDF smlouvou v příloze."
            >
              {meetingAt && (
                <p className="mb-3 text-sm text-ink-600">
                  Schůzka:{" "}
                  <strong>
                    {new Date(meetingAt).toLocaleString("cs-CZ", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  {meetingLocation ? ` · ${meetingLocation}` : ""}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="Příspěvek"
                    className="w-32 rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
                  />
                  <span className="text-sm text-ink-500">Kč</span>
                </div>
                <ZozioButton
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(() =>
                      approveApplication(
                        id,
                        fee.trim() === "" ? null : Number(fee),
                      ),
                    )
                  }
                >
                  <Check /> Schválit + odeslat smlouvu
                </ZozioButton>
              </div>
            </StepBox>
          )}

          {status === "approved" && (
            <StepBox
              title="Smlouva podepsána"
              hint="Až zájemce podepíše smlouvu, potvrďte to zde."
            >
              <ZozioButton
                size="sm"
                disabled={isPending}
                onClick={() => run(() => markContractSigned(id))}
              >
                <Check /> Smlouva podepsána
              </ZozioButton>
            </StepBox>
          )}

          {status === "contract_signed" && (
            <StepBox
              title="Dokončit adopci"
              hint="Po předání zvířete dokončete adopci. Zájemci přijde závěrečný e-mail s doporučeními."
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Doporučení pro adoptanta
                  </span>
                  <button
                    type="button"
                    disabled={aiPending || isPending}
                    onClick={suggestRecommendations}
                    className="inline-flex items-center gap-1.5 rounded-full bg-meadow-100 px-3 py-1 text-xs font-semibold text-meadow-700 hover:bg-meadow-200 disabled:opacity-50"
                  >
                    <Sparkles className="size-3.5" />
                    {aiPending ? "Generuji…" : "Návrh přes AI"}
                  </button>
                </div>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  rows={5}
                  placeholder="Doporučení pro první dny (krmení, aklimatizace, veterinář)…"
                  className="w-full rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
                />
                <p className="text-xs text-ink-400">
                  AI vytvoří návrh z údajů o zvířeti. Před odesláním si ho
                  zkontroluj a uprav.
                </p>
                <ZozioButton
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    run(() => completeAdoption(id, recommendations))
                  }
                >
                  <Check /> Dokončit — zvíře předáno
                </ZozioButton>
              </div>
            </StepBox>
          )}

          {status === "completed" && (
            <p className="text-sm font-semibold text-meadow-700">
              ✅ Adopce dokončena. Zvíře je označené jako adoptované.
            </p>
          )}
        </div>
      )}

      {/* Zamítnutí */}
      {isRejected ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900/5 px-4 py-3">
          <span className="text-sm font-semibold text-ink-600">
            Žádost zamítnuta
          </span>
        </div>
      ) : status !== "completed" ? (
        rejecting ? (
          <div className="space-y-2 rounded-2xl bg-terracotta-500/5 p-4">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Důvod zamítnutí (volitelné — objeví se v e-mailu žadateli)…"
              className="w-full rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-terracotta-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(() => rejectApplication(id, reason), () =>
                    setRejecting(false),
                  )
                }
                className="rounded-full bg-terracotta-500 px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-50"
              >
                {isPending ? "Zamítám…" : "Potvrdit zamítnutí"}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="rounded-full bg-cream-warm px-4 py-1.5 text-sm font-semibold text-ink-600"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <ZozioButton
            variant="outline"
            size="sm"
            onClick={() => setRejecting(true)}
            className="text-terracotta-600"
          >
            <X /> Zamítnout žádost
          </ZozioButton>
        )
      ) : null}

      {error && (
        <p className="text-sm font-medium text-terracotta-600">{error}</p>
      )}
    </div>
  );
}

function StepBox({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-display text-base font-bold text-ink-900">{title}</h4>
        <p className="text-sm text-ink-600">{hint}</p>
      </div>
      {children}
    </div>
  );
}
