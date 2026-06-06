"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ASSIGNABLE_ROLES,
  PERMISSION_MATRIX,
  PERMISSIONS,
  ROLE_BADGE,
  ROLE_CARDS,
  ROLE_LABEL,
  ROLE_ORDER,
  can,
} from "@/lib/permissions";
import type { MemberRole } from "@/types/database";

import {
  cancelInvite,
  changeMemberRole,
  inviteMember,
  removeMember,
  resendInvite,
} from "./actions";

export interface MemberRow {
  userId: string;
  email: string;
  name: string | null;
  role: MemberRole;
  lastSignInAt: string | null;
  isYou: boolean;
}

export interface InviteRow {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  createdAt: string;
}

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return email.slice(0, 2).toUpperCase();
}

function lastActive(iso: string | null): string {
  if (!iso) return "zatím nepřihlášen";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "naposledy dnes";
  if (days === 1) return "naposledy včera";
  if (days < 7) return `naposledy před ${days} dny`;
  return `naposledy ${new Date(iso).toLocaleDateString("cs-CZ")}`;
}

function expiresIn(iso: string): string {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "vypršela";
  if (days === 0) return "vyprší dnes";
  return `vyprší za ${days} ${days === 1 ? "den" : days < 5 ? "dny" : "dní"}`;
}

export function TeamManager({
  members,
  invites,
  myRole,
  institutionName,
}: {
  members: MemberRow[];
  invites: InviteRow[];
  myRole: MemberRole;
  institutionName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const canManage = can(myRole, "team");

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Tým</h2>
          <p className="mt-1 text-ink-600">Kdo má přístup do útulku a co může dělat.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-5 py-3 text-sm font-bold text-cream shadow-soft-md hover:bg-meadow-600"
          >
            <Plus className="size-4" /> Pozvat člena
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-peach-100 px-4 py-2 text-sm font-semibold text-terracotta-600 ring-1 ring-terracotta-400/30">
          {error}
        </div>
      )}

      {/* Členové */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
          Členové týmu · {members.length}
        </h3>
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          {members.map((m) => (
            <MemberRowView
              key={m.userId}
              m={m}
              myRole={myRole}
              canManage={canManage}
              pending={pending}
              run={run}
            />
          ))}
        </div>
      </section>

      {/* Pozvánky */}
      {invites.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
            Čekající pozvánky · {invites.length}
          </h3>
          <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
            {invites.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 border-b border-ink-900/8 px-4 py-3 last:border-b-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand text-ink-500">
                  <Mail className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-900">{i.email}</div>
                  <div className="text-xs text-ink-500">
                    pozváno {new Date(i.createdAt).toLocaleDateString("cs-CZ")} · {expiresIn(i.expiresAt)}
                  </div>
                </div>
                <RoleBadge role={i.role} />
                <span className="text-xs font-semibold text-sunshine-600">pozvánka odeslána</span>
                {canManage && (
                  <div className="flex gap-1.5">
                    <button type="button" disabled={pending} onClick={() => run(() => resendInvite(i.id))} className="rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1 text-xs font-bold text-ink-700 hover:border-ink-900/30 disabled:opacity-50">
                      Znovu odeslat
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => cancelInvite(i.id))} className="rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1 text-xs font-bold text-ink-700 hover:border-ink-900/30 disabled:opacity-50">
                      Zrušit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Role karty */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Co která role může</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_ORDER.map((r) => (
            <div key={r} className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
              <RoleBadge role={r} />
              <ul className="mt-3 space-y-1.5">
                {ROLE_CARDS[r].map((line, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className={cn("mt-0.5", line.ok ? "text-fern-600" : "text-ink-300")}>
                      {line.ok ? "✓" : "✕"}
                    </span>
                    <span className="text-ink-600">{line.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Detailní matice */}
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Detailní přehled oprávnění</h3>
        <div className="overflow-x-auto rounded-3xl ring-1 ring-ink-900/8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-ink-900 text-cream">
                <th className="px-3 py-2 text-left text-xs font-bold">Oblast</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className="px-3 py-2 text-center text-xs font-bold">{ROLE_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((grp) => (
                <Fragment key={grp.group}>
                  <tr className="bg-sand">
                    <td colSpan={5} className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-700">
                      {grp.group}
                    </td>
                  </tr>
                  {grp.rows.map((row) => (
                    <tr key={row.area} className="border-b border-ink-900/8 last:border-b-0">
                      <td className="px-3 py-2 font-medium text-ink-700">{row.label}</td>
                      {ROLE_ORDER.map((r) => {
                        const lvl = PERMISSIONS[row.area][r];
                        return (
                          <td key={r} className="px-3 py-2 text-center">
                            {lvl === "full" ? (
                              <span className="font-bold text-fern-600">✓</span>
                            ) : lvl === "view" ? (
                              <span className="rounded-pill bg-sunshine-200 px-2 py-0.5 text-[10px] font-bold text-sunshine-600">náhled</span>
                            ) : (
                              <span className="font-bold text-ink-300">✕</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {inviting && (
        <InviteModal
          institutionName={institutionName}
          onClose={() => setInviting(false)}
          onInvited={() => {
            setInviting(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: MemberRole }) {
  return (
    <span className={cn("inline-block rounded-pill px-3 py-0.5 text-xs font-bold", ROLE_BADGE[role])}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function MemberRowView({
  m,
  myRole,
  canManage,
  pending,
  run,
}: {
  m: MemberRow;
  myRole: MemberRole;
  canManage: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ error: string } | { ok: true }>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Vlastníka mění jen vlastník; sebe needituješ z řádku.
  const editable =
    canManage && !m.isYou && (m.role !== "owner" || myRole === "owner");
  // Které role lze přidělit (owner jen pokud jsem owner).
  const roleOptions: MemberRole[] = myRole === "owner" ? ["owner", ...ASSIGNABLE_ROLES] : ASSIGNABLE_ROLES;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-ink-900/8 px-4 py-3 last:border-b-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sand text-sm font-bold text-ink-600">
        {initials(m.name, m.email)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold text-ink-900">{m.name ?? m.email}</span>
          {m.isYou && (
            <span className="rounded-pill bg-meadow-50 px-2 py-0.5 text-[10px] font-bold text-meadow-700">to jsi ty</span>
          )}
        </div>
        <div className="truncate text-xs text-ink-500">
          {m.name ? `${m.email} · ` : ""}{lastActive(m.lastSignInAt)}
        </div>
      </div>
      <RoleBadge role={m.role} />
      <span className="text-xs font-semibold text-ink-400">aktivní</span>
      <div className="relative">
        <button
          type="button"
          disabled={!editable}
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "grid size-8 place-items-center rounded-lg ring-1 ring-ink-900/10",
            editable ? "text-ink-500 hover:bg-cream-warm" : "cursor-not-allowed text-ink-300 opacity-40",
          )}
          title={editable ? "Změnit roli / odebrat" : m.isYou ? "Sebe nelze měnit zde" : "Vlastníka může měnit jen vlastník"}
        >
          ⋯
        </button>
        {menuOpen && editable && (
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl bg-cream p-2 shadow-soft-md ring-1 ring-ink-900/10">
            <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Změnit roli</p>
            {roleOptions.map((r) => (
              <button
                key={r}
                type="button"
                disabled={pending || r === m.role}
                onClick={() => {
                  setMenuOpen(false);
                  run(() => changeMemberRole(m.userId, r));
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-cream-warm disabled:opacity-50",
                  r === m.role ? "text-meadow-700" : "text-ink-700",
                )}
              >
                {ROLE_LABEL[r]}
                {r === m.role && <Check className="size-3.5" />}
              </button>
            ))}
            <div className="my-1 border-t border-ink-900/8" />
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setMenuOpen(false);
                if (confirm(`Odebrat ${m.email} z týmu?`)) run(() => removeMember(m.userId));
              }}
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-berry hover:bg-peach-100 disabled:opacity-50"
            >
              Odebrat z týmu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InviteModal({
  institutionName,
  onClose,
  onInvited,
}: {
  institutionName: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("staff");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-cream p-6 ring-1 ring-ink-900/10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-900">Pozvat člena</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm">
            <X className="size-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink-500">
          Pošleme pozvánku e-mailem. Po přijetí se připojí k útulku „{institutionName}".
        </p>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">E-mail</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jmeno@email.cz"
          className="mb-4 w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">Role</label>
        <div className="flex flex-wrap gap-2">
          {ASSIGNABLE_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={cn(
                "rounded-pill border-[1.5px] px-4 py-2 text-sm font-bold transition-colors",
                role === r ? "border-meadow-500 bg-meadow-50 text-meadow-700" : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
              )}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-terracotta-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={pending || !email.trim()}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await inviteMember(email, role);
                if ("error" in res) setError(res.error);
                else onInvited();
              })
            }
            className="rounded-pill bg-meadow-500 px-5 py-2.5 text-sm font-bold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            {pending ? "Odesílám…" : "Odeslat pozvánku"}
          </button>
          <button type="button" onClick={onClose} className="rounded-pill px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm">
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
