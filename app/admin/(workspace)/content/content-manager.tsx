"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CATEGORY_BADGE,
  CATEGORY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  SEGMENT_LABEL,
  buildEmbedCode,
  type WidgetConfig,
} from "@/lib/content";
import type {
  CampaignStatus,
  ContentStatus,
  ContentType,
  NewsletterSegment,
} from "@/types/database";

import {
  createContent,
  createStoryFromAnimal,
  deleteContent,
  loadContentAnimals,
  saveWidgetConfig,
  setContentStatus,
  updateContent,
  type ContentInput,
} from "./actions";
import {
  createCampaign,
  deleteCampaign,
  scheduleCampaign,
  sendCampaign,
  updateCampaign,
} from "./newsletter-actions";
import { generateArticle, improveText } from "./ai-actions";
import {
  listPendingComments,
  moderateComment,
  type PendingComment,
} from "./comments-actions";
import { RichEditor } from "./rich-editor";

export interface ContentVM {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  status: ContentStatus;
  published_at: string | null;
  updated_at: string;
  view_count: number;
  animal_id: string | null;
  event_date: string | null;
  event_location: string | null;
}

export interface CampaignVM {
  id: string;
  subject: string;
  segment: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  opens: number;
}

export interface TaggableAnimal {
  id: string;
  name: string;
  species: string;
  adoption_status: string;
  primary_photo_url: string | null;
}

type Tab = "clanky" | "pribehy" | "akce" | "komentare" | "newsletter" | "widget";

const TABS: { id: Tab; label: string }[] = [
  { id: "clanky", label: "Články" },
  { id: "pribehy", label: "Příběhy 🎉" },
  { id: "akce", label: "Akce" },
  { id: "komentare", label: "Komentáře" },
  { id: "newsletter", label: "Newsletter" },
  { id: "widget", label: "Embed widget" },
];

const MONTHS_SHORT = ["led", "úno", "bře", "dub", "kvě", "čer", "čvc", "srp", "zář", "říj", "lis", "pro"];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}
const EMPTY_FORM: ContentInput = {
  type: "article",
  title: "",
  category: "news",
  excerpt: "",
  body: "",
  cover_url: "",
  status: "draft",
  scheduled_at: "",
  animal_id: null,
  animal_ids: [],
  event_date: "",
  event_location: "",
};

// ---------------------------------------------------------------------------

export function ContentManager(props: {
  initialTab?: string;
  content: ContentVM[];
  campaigns: CampaignVM[];
  adoptedAnimals: { id: string; name: string; primary_photo_url: string | null }[];
  taggableAnimals: TaggableAnimal[];
  institutionId: string;
  institutionName: string;
  slug: string;
  baseUrl: string;
  widgetConfig: WidgetConfig;
  newsletter: {
    subscribers: number;
    avgOpenRate: number | null;
    campaignsThisYear: number;
    segmentCounts: Record<string, number>;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = TABS.some((t) => t.id === props.initialTab) ? (props.initialTab as Tab) : "clanky";
  const [tab, setTab] = useState<Tab>(initial);

  // Editor obsahu (článek/příběh/akce).
  const [editor, setEditor] = useState<{ id: string | null; input: ContentInput } | null>(null);
  // Editor kampaně.
  const [campaignEditor, setCampaignEditor] = useState<{
    id: string | null;
    subject: string;
    body: string;
    segment: string;
  } | null>(null);

  function run(fn: () => Promise<{ error: string } | { ok: true } | { ok: true; id: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setEditor(null);
      setCampaignEditor(null);
      router.refresh();
    });
  }

  const articles = props.content.filter((c) => c.type === "article");
  const stories = props.content.filter((c) => c.type === "story");
  const events = props.content.filter((c) => c.type === "event");

  function openNew(type: ContentType) {
    setError(null);
    setEditor({
      id: null,
      input: {
        ...EMPTY_FORM,
        type,
        category: type === "story" ? "story" : type === "event" ? "event" : "news",
      },
    });
  }

  function openEdit(c: ContentVM) {
    setError(null);
    setEditor({
      id: c.id,
      input: {
        type: c.type,
        title: c.title,
        category: c.category ?? "news",
        excerpt: c.excerpt ?? "",
        body: c.body ?? "",
        cover_url: c.cover_url ?? "",
        status: c.status,
        scheduled_at: "",
        animal_id: c.animal_id,
        animal_ids: [],
        event_date: c.event_date ?? "",
        event_location: c.event_location ?? "",
      },
    });
  }

  const primaryLabel =
    tab === "clanky"
      ? "＋ Nový článek"
      : tab === "pribehy"
        ? "＋ Nový příběh"
        : tab === "akce"
          ? "＋ Nová akce"
          : tab === "newsletter"
            ? "＋ Napsat newsletter"
            : null;

  function onPrimary() {
    if (tab === "clanky") openNew("article");
    else if (tab === "pribehy") openNew("story");
    else if (tab === "akce") openNew("event");
    else if (tab === "newsletter")
      setCampaignEditor({ id: null, subject: "", body: "", segment: "all" });
  }

  // Editor obsahu má přednost.
  if (editor) {
    return (
      <ContentEditor
        state={editor}
        setState={setEditor}
        institutionName={props.institutionName}
        animals={props.taggableAnimals}
        onCancel={() => setEditor(null)}
        onSave={(input) =>
          run(() => (editor.id ? updateContent(editor.id, input) : createContent(input)))
        }
        pending={pending}
        error={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Web &amp; obsah</h2>
          <p className="mt-1 text-sm text-ink-500">
            Novinky, příběhy, akce, newsletter a zobrazení zvířat na vašem webu.
          </p>
        </div>
        {primaryLabel && (
          <button
            type="button"
            onClick={onPrimary}
            className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-5 py-3 text-sm font-bold text-cream shadow-soft-md hover:bg-meadow-600"
          >
            {primaryLabel}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-peach-100 px-4 py-2 text-sm font-semibold text-terracotta-600 ring-1 ring-terracotta-400/30">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-ink-900/8">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-[3px] px-4 py-2.5 text-sm font-bold",
              tab === t.id
                ? "border-meadow-500 text-meadow-700"
                : "border-transparent text-ink-400 hover:text-ink-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "clanky" && (
        <ArticleList items={articles} onEdit={openEdit} run={run} />
      )}
      {tab === "pribehy" && (
        <StoryList
          stories={stories}
          adoptedAnimals={props.adoptedAnimals}
          onEdit={openEdit}
          run={run}
        />
      )}
      {tab === "akce" && <EventList events={events} onEdit={openEdit} run={run} />}
      {tab === "komentare" && <CommentModeration />}
      {tab === "newsletter" && (
        <NewsletterPanel
          campaigns={props.campaigns}
          stats={props.newsletter}
          slug={props.slug}
          baseUrl={props.baseUrl}
          institutionName={props.institutionName}
          editor={campaignEditor}
          setEditor={setCampaignEditor}
          run={run}
          pending={pending}
        />
      )}
      {tab === "widget" && (
        <WidgetPanel slug={props.slug} baseUrl={props.baseUrl} config={props.widgetConfig} run={run} />
      )}
    </div>
  );
}

type Run = (
  fn: () => Promise<{ error: string } | { ok: true } | { ok: true; id: string }>,
) => void;

// --- Články ----------------------------------------------------------------

function ArticleList({
  items,
  onEdit,
  run,
}: {
  items: ContentVM[];
  onEdit: (c: ContentVM) => void;
  run: Run;
}) {
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [q, setQ] = useState("");

  const counts = {
    all: items.length,
    published: items.filter((c) => c.status === "published").length,
    draft: items.filter((c) => c.status !== "published").length,
  };
  const filtered = items.filter((c) => {
    if (filter === "published" && c.status !== "published") return false;
    if (filter === "draft" && c.status === "published") return false;
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3.5">
      <Toolbar
        filters={[
          { id: "all", label: "Vše", count: counts.all },
          { id: "published", label: "Publikované", count: counts.published },
          { id: "draft", label: "Koncepty", count: counts.draft },
        ]}
        active={filter}
        onFilter={(f) => setFilter(f as typeof filter)}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Hledat článek…"
      />
      {filtered.length === 0 ? (
        <Empty>Žádné články. Vytvoř první kliknutím na „Nový článek".</Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          {filtered.map((c) => (
            <ContentRow key={c.id} c={c} onEdit={onEdit} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentRow({ c, onEdit, run }: { c: ContentVM; onEdit: (c: ContentVM) => void; run: Run }) {
  const cat = c.category ?? "news";
  const emoji = cat === "story" ? "🎉" : cat === "event" ? "📅" : "📰";
  return (
    <div className="flex items-center gap-3.5 border-b border-ink-900/6 px-4 py-3 last:border-0 hover:bg-cream-warm">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sand text-lg">
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-ink-900">{c.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-400">
          <span className={cn("rounded-pill px-2 py-0.5 text-[10px]", CATEGORY_BADGE[cat])}>
            {CATEGORY_LABEL[cat] ?? cat}
          </span>
          {c.published_at ? (
            <span>publikováno {fmtDate(c.published_at)}</span>
          ) : (
            <span>upraveno {fmtDate(c.updated_at)}</span>
          )}
          {c.view_count > 0 && <span>· {c.view_count} zobrazení</span>}
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-bold",
          STATUS_BADGE[c.status],
        )}
      >
        {STATUS_LABEL[c.status]}
      </span>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(c)}
          className="rounded-pill border border-meadow-500 px-3 py-1.5 text-xs font-bold text-meadow-700 hover:bg-meadow-50"
        >
          Upravit
        </button>
        {c.status !== "published" ? (
          <button
            type="button"
            onClick={() => run(() => setContentStatus(c.id, "published"))}
            className="rounded-pill border border-sand2 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-cream-warm"
          >
            Publikovat
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(() => setContentStatus(c.id, "draft"))}
            className="rounded-pill border border-sand2 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-cream-warm"
          >
            Skrýt
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm(`Smazat „${c.title}"?`)) run(() => deleteContent(c.id));
          }}
          className="rounded-pill border border-sand2 px-2.5 py-1.5 text-xs font-bold text-terracotta-600 hover:bg-peach-100"
          aria-label="Smazat"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Příběhy ---------------------------------------------------------------

function StoryList({
  stories,
  adoptedAnimals,
  onEdit,
  run,
}: {
  stories: ContentVM[];
  adoptedAnimals: { id: string; name: string; primary_photo_url: string | null }[];
  onEdit: (c: ContentVM) => void;
  run: Run;
}) {
  const usedAnimalIds = new Set(stories.map((s) => s.animal_id).filter(Boolean));
  const available = adoptedAnimals.filter((a) => !usedAnimalIds.has(a.id));

  return (
    <div className="space-y-4">
      {stories.length === 0 ? (
        <Empty>Zatím žádné příběhy. Založ příběh z karty adoptovaného zvířete.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onEdit(s)}
              className="overflow-hidden rounded-3xl bg-cream text-left ring-1 ring-ink-900/8 transition hover:shadow-soft-md"
            >
              <div className="flex h-24 items-center justify-center bg-sand text-3xl">
                {s.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  "🎉"
                )}
              </div>
              <div className="p-3.5">
                <div className="font-display text-[15px] font-bold text-ink-900">{s.title}</div>
                <div className="mt-0.5 text-xs font-semibold text-ink-400">
                  {s.status === "published"
                    ? `publikováno ${fmtDate(s.published_at)}`
                    : "koncept"}
                  {s.view_count > 0 && ` · ${s.view_count} zobrazení`}
                </div>
                {s.excerpt && (
                  <p className="mt-2 line-clamp-2 text-[13px] text-ink-600">{s.excerpt}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">
            Adoptovaná zvířata bez příběhu
          </h3>
          <div className="flex flex-wrap gap-2">
            {available.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => run(() => createStoryFromAnimal(a.id))}
                className="inline-flex items-center gap-1.5 rounded-pill border border-meadow-500 px-3.5 py-2 text-sm font-bold text-meadow-700 hover:bg-meadow-50"
              >
                <Plus className="size-3.5" /> {a.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[13px] font-semibold text-ink-400">
        💡 Nový příběh založíš jedním klikem z adoptovaného zvířete — předvyplní jméno i foto.
      </p>
    </div>
  );
}

// --- Akce ------------------------------------------------------------------

function EventList({
  events,
  onEdit,
  run,
}: {
  events: ContentVM[];
  onEdit: (c: ContentVM) => void;
  run: Run;
}) {
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => !e.event_date || e.event_date >= today);
  const past = events.filter((e) => e.event_date && e.event_date < today);
  const list = filter === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-3.5">
      <Toolbar
        filters={[
          { id: "upcoming", label: "Nadcházející", count: upcoming.length },
          { id: "past", label: "Proběhlé", count: past.length },
        ]}
        active={filter}
        onFilter={(f) => setFilter(f as typeof filter)}
      />
      {list.length === 0 ? (
        <Empty>Žádné akce.</Empty>
      ) : (
        <div className="space-y-3">
          {list.map((e) => {
            const d = e.event_date ? new Date(e.event_date) : null;
            const isPast = filter === "past";
            return (
              <div
                key={e.id}
                className={cn(
                  "flex items-center gap-4 rounded-3xl bg-cream px-4 py-3.5 ring-1 ring-ink-900/8",
                  isPast && "opacity-70",
                )}
              >
                <div
                  className={cn(
                    "flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl",
                    isPast ? "bg-cream-warm text-ink-400" : "bg-meadow-50 text-meadow-700",
                  )}
                >
                  <span className="font-display text-xl font-bold leading-none">
                    {d ? d.getDate() : "–"}
                  </span>
                  <span className="text-[11px] font-bold uppercase">
                    {d ? MONTHS_SHORT[d.getMonth()] : ""}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold text-ink-900">{e.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-ink-400">
                    {e.event_location && <span>📍 {e.event_location}</span>}
                    {e.status === "published" && (
                      <span className="rounded-pill bg-fern-50 px-2 py-0.5 text-[10.5px] text-fern-700">
                        🌐 na profilu
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(e)}
                  className="rounded-pill border border-sand2 px-3 py-1.5 text-xs font-bold text-ink-600 hover:bg-cream-warm"
                >
                  Upravit
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Newsletter ------------------------------------------------------------

function NewsletterPanel({
  campaigns,
  stats,
  slug,
  baseUrl,
  institutionName,
  editor,
  setEditor,
  run,
  pending,
}: {
  campaigns: CampaignVM[];
  stats: {
    subscribers: number;
    avgOpenRate: number | null;
    campaignsThisYear: number;
    segmentCounts: Record<string, number>;
  };
  slug: string;
  baseUrl: string;
  institutionName: string;
  editor: { id: string | null; subject: string; body: string; segment: string } | null;
  setEditor: (e: { id: string | null; subject: string; body: string; segment: string } | null) => void;
  run: Run;
  pending: boolean;
}) {
  const [scheduleFor, setScheduleFor] = useState("");

  if (editor) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="inline-flex items-center gap-1 text-sm font-bold text-ink-500 hover:text-ink-700"
            >
              <ArrowLeft className="size-4" /> Zpět
            </button>
          </div>
          <Field label="Předmět">
            <input
              value={editor.subject}
              onChange={(e) => setEditor({ ...editor, subject: e.target.value })}
              className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
              placeholder="Jarní zpravodaj…"
            />
          </Field>
          <Field label="Segment">
            <div className="flex flex-wrap gap-1.5">
              {(["all", "donor", "adopter", "supporter"] as const).map((seg) => (
                <Chip
                  key={seg}
                  on={editor.segment === seg}
                  onClick={() => setEditor({ ...editor, segment: seg })}
                >
                  {SEGMENT_LABEL[seg]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Text">
            <RichEditor
              value={editor.body}
              onChange={(html) => setEditor({ ...editor, body: html })}
              onImproveSelection={async (text) => {
                const res = await improveText(text);
                if ("error" in res) {
                  alert(res.error);
                  return null;
                }
                return res.text;
              }}
              placeholder="Milí příznivci, máme pro vás novinky…"
            />
            <p className="mt-1 text-xs text-ink-400">
              Piš jako ve Wordu. Označ text a klikni „Vylepšit výběr" pro úpravu AI.
            </p>
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => {
                  const input = { subject: editor.subject, body: editor.body, segment: editor.segment };
                  return editor.id ? updateCampaign(editor.id, input) : createCampaign(input);
                })
              }
              className="rounded-pill bg-ink-900 px-4 py-2.5 text-sm font-bold text-cream hover:bg-ink-700 disabled:opacity-50"
            >
              Uložit koncept
            </button>
            {editor.id && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Opravdu rozeslat kampaň všem příjemcům segmentu?"))
                      run(() => sendCampaign(editor.id!));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-4 py-2.5 text-sm font-bold text-cream hover:bg-meadow-600 disabled:opacity-50"
                >
                  <Send className="size-4" /> Rozeslat teď
                </button>
                <input
                  type="datetime-local"
                  value={scheduleFor}
                  onChange={(e) => setScheduleFor(e.target.value)}
                  className="rounded-pill border border-sand2 bg-warm px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={pending || !scheduleFor}
                  onClick={() => run(() => scheduleCampaign(editor.id!, scheduleFor))}
                  className="rounded-pill border border-sand2 px-4 py-2.5 text-sm font-bold text-ink-600 hover:bg-cream-warm disabled:opacity-50"
                >
                  Naplánovat
                </button>
              </>
            )}
          </div>
        </div>

        <EmailPreview
          institutionName={institutionName}
          subject={editor.subject}
          bodyHtml={editor.body}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat n={String(stats.subscribers)} l="Odběratelů" />
        <Stat n={stats.avgOpenRate != null ? `${stats.avgOpenRate} %` : "—"} l="Ø míra otevření" />
        <Stat n={String(stats.campaignsThisYear)} l="Kampaní letos" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip on>Vše {stats.subscribers > 0 && <span className="opacity-60">{stats.subscribers}</span>}</Chip>
        {(["donor", "adopter", "supporter"] as NewsletterSegment[]).map((seg) => (
          <Chip key={seg}>
            {SEGMENT_LABEL[seg]} <span className="opacity-60">{stats.segmentCounts[seg] ?? 0}</span>
          </Chip>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <Empty>Žádné kampaně. Napiš první newsletter.</Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3.5 border-b border-ink-900/6 px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-ink-900">{c.subject}</div>
                <div className="mt-0.5 text-xs font-semibold text-ink-400">
                  {c.status === "sent" &&
                    `odesláno ${fmtDate(c.sentAt)} · ${c.recipients} příjemců`}
                  {c.status === "scheduled" &&
                    `naplánováno na ${fmtDate(c.scheduledAt)} · segment ${SEGMENT_LABEL[(c.segment as NewsletterSegment) ?? "all"] ?? c.segment}`}
                  {c.status === "draft" && "koncept"}
                </div>
              </div>
              {c.status === "sent" ? (
                <span className="text-xs font-bold text-fern-700">
                  {c.recipients > 0 ? Math.round((c.opens / c.recipients) * 100) : 0} % otevřeno
                </span>
              ) : (
                <span className={cn("rounded-pill px-2.5 py-1 text-[11px] font-bold", STATUS_BADGE[c.status])}>
                  {STATUS_LABEL[c.status]}
                </span>
              )}
              {c.status !== "sent" && (
                <button
                  type="button"
                  onClick={() =>
                    setEditor({
                      id: c.id,
                      subject: c.subject,
                      body: "",
                      segment: c.segment || "all",
                    })
                  }
                  className="rounded-pill border border-meadow-500 px-3 py-1.5 text-xs font-bold text-meadow-700 hover:bg-meadow-50"
                >
                  Upravit
                </button>
              )}
              {c.status !== "sent" && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Smazat kampaň?")) run(() => deleteCampaign(c.id));
                  }}
                  className="rounded-pill border border-sand2 px-2.5 py-1.5 text-xs font-bold text-terracotta-600 hover:bg-peach-100"
                  aria-label="Smazat"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <SignupSnippet baseUrl={baseUrl} slug={slug} />
    </div>
  );
}

function SignupSnippet({ baseUrl, slug }: { baseUrl: string; slug: string }) {
  const code = `<form action="${baseUrl}/api/newsletter/subscribe" method="post">
  <input type="hidden" name="slug" value="${slug}" />
  <input type="email" name="email" placeholder="vas@email.cz" required />
  <button type="submit">Odebírat novinky</button>
</form>`;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400">
        Přihlašovací formulář na web
      </h3>
      <CodeBox code={code} />
      <p className="text-[13px] font-semibold text-ink-400">
        📨 Noví odběratelé padají rovnou sem. Rozesílá se přes Resend, každý e-mail má odhlašovací odkaz.
      </p>
    </div>
  );
}

/** Živá ukázka, jak bude newsletter vypadat v e-mailu příjemce. */
function EmailPreview({
  institutionName,
  subject,
  bodyHtml,
}: {
  institutionName: string;
  subject: string;
  bodyHtml: string;
}) {
  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-400">
        <Mail className="size-3.5" /> Ukázka e-mailu
      </div>
      <div className="overflow-hidden rounded-3xl bg-cream-warm p-4 ring-1 ring-ink-900/8">
        {/* Hlavička jako v poštovním klientu */}
        <div className="mb-3 rounded-2xl bg-warm px-4 py-2.5 text-xs text-ink-400 ring-1 ring-ink-900/6">
          <div>
            <span className="font-semibold text-ink-600">Od:</span> {institutionName}
          </div>
          <div className="truncate">
            <span className="font-semibold text-ink-600">Předmět:</span>{" "}
            {subject || <span className="italic text-ink-400">(bez předmětu)</span>}
          </div>
        </div>
        {/* Tělo e-mailu */}
        <div className="rounded-2xl bg-white px-5 py-5 ring-1 ring-ink-900/6">
          <div className="text-lg font-bold text-ink-900">
            {subject || "Předmět newsletteru"}
          </div>
          <div className="mt-1 text-xs text-ink-400">{institutionName}</div>
          {bodyHtml ? (
            <div
              className="mt-3 text-sm leading-relaxed text-ink-800 [&_a]:font-semibold [&_a]:text-meadow-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-meadow-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-bold [&_li]:ml-5 [&_ol_li]:list-decimal [&_p]:my-2 [&_ul_li]:list-disc"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <p className="mt-3 text-sm italic text-ink-400">
              Začni psát text vlevo — ukázka se aktualizuje sama.
            </p>
          )}
          <hr className="my-4 border-cream-warm" />
          <p className="text-[11px] text-ink-400">
            Tento e-mail jsi dostal(a) jako odběratel novinek útulku {institutionName}.{" "}
            <span className="font-semibold text-terracotta-600">Odhlásit odběr</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Widget ----------------------------------------------------------------

function WidgetPanel({
  slug,
  baseUrl,
  config,
  run,
}: {
  slug: string;
  baseUrl: string;
  config: WidgetConfig;
  run: Run;
}) {
  const [cfg, setCfg] = useState<WidgetConfig>(config);
  const [preview, setPreview] = useState<{ name: string; species: string; age: string }[]>([]);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(config);

  useEffect(() => {
    let alive = true;
    fetch(`${baseUrl}/api/widget/${encodeURIComponent(slug)}?druh=${cfg.species}&pocet=${cfg.count}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setPreview((d?.animals ?? []).slice(0, cfg.count));
      })
      .catch(() => {
        if (alive) setPreview([]);
      });
    return () => {
      alive = false;
    };
  }, [baseUrl, slug, cfg.species, cfg.count]);

  const code = buildEmbedCode(slug, cfg, baseUrl);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3.5 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
          <h3 className="font-display text-[15px] font-bold text-ink-900">Nastavení widgetu</h3>
          <WidgetOpt label="Co zobrazit">
            <Chip on={cfg.scope === "adoptable"} onClick={() => setCfg({ ...cfg, scope: "adoptable" })}>
              Jen k adopci
            </Chip>
            <Chip on={cfg.scope === "with_found"} onClick={() => setCfg({ ...cfg, scope: "with_found" })}>
              Vč. nalezenců
            </Chip>
          </WidgetOpt>
          <WidgetOpt label="Druh">
            {(["all", "dog", "cat"] as const).map((s) => (
              <Chip key={s} on={cfg.species === s} onClick={() => setCfg({ ...cfg, species: s })}>
                {s === "all" ? "Vše" : s === "dog" ? "Psi" : "Kočky"}
              </Chip>
            ))}
          </WidgetOpt>
          <WidgetOpt label="Rozložení">
            <Chip on={cfg.layout === "grid"} onClick={() => setCfg({ ...cfg, layout: "grid" })}>
              Mřížka
            </Chip>
            <Chip on={cfg.layout === "list"} onClick={() => setCfg({ ...cfg, layout: "list" })}>
              Seznam
            </Chip>
          </WidgetOpt>
          <WidgetOpt label="Počet">
            {([3, 6, 9] as const).map((n) => (
              <Chip key={n} on={cfg.count === n} onClick={() => setCfg({ ...cfg, count: n })}>
                {n}
              </Chip>
            ))}
          </WidgetOpt>
          <WidgetOpt label="Motiv">
            <Chip on={cfg.theme === "light"} onClick={() => setCfg({ ...cfg, theme: "light" })}>
              Světlý
            </Chip>
            <Chip on={cfg.theme === "dark"} onClick={() => setCfg({ ...cfg, theme: "dark" })}>
              Tmavý
            </Chip>
          </WidgetOpt>
          {dirty && (
            <button
              type="button"
              onClick={() => run(() => saveWidgetConfig(cfg))}
              className="rounded-pill bg-meadow-500 px-4 py-2.5 text-sm font-bold text-cream hover:bg-meadow-600"
            >
              Uložit nastavení
            </button>
          )}
        </div>

        <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
          <h3 className="mb-3 font-display text-[15px] font-bold text-ink-900">Náhled</h3>
          {preview.length === 0 ? (
            <p className="text-sm font-semibold text-ink-400">
              Aktuálně tu nejsou žádná zvířata k zobrazení.
            </p>
          ) : (
            <div className={cn("grid gap-2.5", cfg.layout === "list" ? "grid-cols-1" : "grid-cols-2")}>
              {preview.map((a, i) => (
                <div key={i} className="overflow-hidden rounded-2xl bg-warm ring-1 ring-ink-900/8">
                  <div className="flex h-16 items-center justify-center bg-sand text-2xl">
                    {a.species?.toLowerCase().includes("koč") ? "🐈" : "🐕"}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-[12.5px] font-bold text-ink-900">{a.name}</div>
                    <div className="text-[10.5px] font-semibold text-ink-400">
                      {[a.species, a.age].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
        <h3 className="mb-3 font-display text-[15px] font-bold text-ink-900">Vložit na web</h3>
        <CodeBox code={code} />
        <p className="mt-2.5 text-[12.5px] font-semibold text-ink-400">
          Vlož kód na svůj web. Zvířata se načtou izolovaně (Shadow DOM), bez zásahu do vašeho stylu,
          a aktualizují se automaticky.
        </p>
      </div>
    </div>
  );
}

// --- Editor obsahu ---------------------------------------------------------

function ContentEditor({
  state,
  setState,
  institutionName,
  animals,
  onCancel,
  onSave,
  pending,
  error,
}: {
  state: { id: string | null; input: ContentInput };
  setState: (s: { id: string | null; input: ContentInput }) => void;
  institutionName: string;
  animals: TaggableAnimal[];
  onCancel: () => void;
  onSave: (input: ContentInput) => void;
  pending: boolean;
  error: string | null;
}) {
  const { input } = state;
  const set = (patch: Partial<ContentInput>) => setState({ ...state, input: { ...input, ...patch } });
  const isEvent = input.type === "event";
  const typeLabel = input.type === "story" ? "příběh" : isEvent ? "akce" : "článek";
  const taggedAnimal = animals.find((a) => a.id === input.animal_id) ?? null;

  // Předvyplnění „Zvířat v článku" (M:N) při editaci existujícího článku.
  const [animalsLoaded, setAnimalsLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (state.id && animalsLoaded !== state.id) {
      setAnimalsLoaded(state.id);
      loadContentAnimals(state.id).then((list) => {
        setState({ ...state, input: { ...state.input, animal_ids: list.map((a) => a.id) } });
      });
    }
  }, [state, animalsLoaded, setState]);

  // AI generování celého návrhu.
  const [aiOpen, setAiOpen] = useState(!state.id && !input.body);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("warm");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function runGenerate() {
    if (!topic.trim()) {
      setAiError("Zadej téma článku.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    const res = await generateArticle({
      topic,
      type: input.type,
      tone,
      institutionName,
      animalId: input.animal_id,
    });
    setAiBusy(false);
    if ("error" in res) {
      setAiError(res.error);
      return;
    }
    setState({
      ...state,
      input: {
        ...input,
        title: input.title.trim() || res.data.title,
        excerpt: input.excerpt.trim() || res.data.excerpt,
        body: res.data.body_html,
      },
    });
    setAiOpen(false);
  }

  async function improveSelection(text: string): Promise<string | null> {
    const res = await improveText(text);
    if ("error" in res) {
      alert(res.error);
      return null;
    }
    return res.text;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-sm font-bold text-ink-500 hover:text-ink-700"
        >
          <ArrowLeft className="size-4" /> Zpět
        </button>
        <h2 className="font-display text-2xl font-bold text-ink-900">
          {state.id ? `Upravit ${typeLabel}` : `Nový ${typeLabel}`}
        </h2>
        {!aiOpen && (
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-meadow-500 px-4 py-2 text-sm font-bold text-meadow-700 hover:bg-meadow-50"
          >
            <Sparkles className="size-4" /> Napsat s AI
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-peach-100 px-4 py-2 text-sm font-semibold text-terracotta-600 ring-1 ring-terracotta-400/30">
          {error}
        </div>
      )}

      {aiOpen && (
        <div className="space-y-3 rounded-3xl bg-meadow-50 p-5 ring-1 ring-meadow-500/20">
          <div className="flex items-center gap-2 font-display font-bold text-meadow-700">
            <Sparkles className="size-4" /> Napsat {typeLabel} pomocí AI
          </div>
          <p className="text-[13px] font-semibold text-ink-500">
            Napiš téma nebo pár bodů — AI připraví návrh nadpisu, perexu a textu. Vše pak v klidu upravíš.
          </p>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-meadow-500/30 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
            placeholder={
              input.type === "event"
                ? "Den otevřených dveří 15. 6., 10–16 h, prohlídka útulku, občerstvení…"
                : input.type === "story"
                  ? "Pejsek Rocky, senior, po půl roce u nás našel domov u rodiny se zahradou…"
                  : "Spouštíme zimní sbírku krmiva a dek pro naše zvířata…"
            }
          />
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-400">
              Zvíře v článku (nepovinné)
            </span>
            <AnimalPicker
              animals={animals}
              selectedId={input.animal_id}
              onChange={(id) => set({ animal_id: id })}
            />
            <p className="mt-1.5 text-xs font-semibold text-ink-500">
              {taggedAnimal
                ? `AI použije skutečné údaje o „${taggedAnimal.name}" a přidá odkaz na jeho profil na Zozio.cz.`
                : "Vyber zvíře a AI postaví článek kolem jeho skutečných údajů + přidá odkaz na Zozio.cz."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-400">
                Tón
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "warm", label: "Vřelý" },
                  { id: "informative", label: "Věcný" },
                  { id: "urgent", label: "Naléhavý" },
                  { id: "celebratory", label: "Oslavný" },
                ].map((t) => (
                  <Chip key={t.id} on={tone === t.id} onClick={() => setTone(t.id)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                className="rounded-pill border border-sand2 px-4 py-2.5 text-sm font-bold text-ink-600 hover:bg-cream-warm"
              >
                Zavřít
              </button>
              <button
                type="button"
                disabled={aiBusy}
                onClick={runGenerate}
                className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-500 px-5 py-2.5 text-sm font-bold text-cream shadow-soft-md hover:bg-meadow-600 disabled:opacity-50"
              >
                <Sparkles className="size-4" /> {aiBusy ? "Generuji…" : input.body ? "Přegenerovat" : "Vygenerovat návrh"}
              </button>
            </div>
          </div>
          {aiError && (
            <div className="rounded-2xl bg-peach-100 px-4 py-2 text-sm font-semibold text-terracotta-600 ring-1 ring-terracotta-400/30">
              {aiError}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Field label="Název">
            <input
              value={input.title}
              onChange={(e) => set({ title: e.target.value })}
              className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
              placeholder="Název…"
            />
          </Field>
          <Field label="Perex (krátký úvod)">
            <textarea
              value={input.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
              rows={2}
              className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
            />
          </Field>
          <Field label="Text">
            <RichEditor
              value={input.body}
              onChange={(html) => set({ body: html })}
              onImproveSelection={improveSelection}
              placeholder={'Začni psát text… nebo nech AI připravit návrh tlačítkem „Napsat s AI".'}
            />
            <p className="mt-1 text-xs text-ink-400">
              Piš jako ve Wordu — formátování zařídí lišta nahoře. Označ text a klikni „Vylepšit výběr" pro úpravu AI.
            </p>
          </Field>
        </div>

        <div className="space-y-4">
          <Field label="Stav">
            <div className="flex flex-wrap gap-1.5">
              {(["draft", "published", "scheduled"] as ContentStatus[]).map((s) => (
                <Chip key={s} on={input.status === s} onClick={() => set({ status: s })}>
                  {STATUS_LABEL[s]}
                </Chip>
              ))}
            </div>
          </Field>
          {input.status === "scheduled" && (
            <Field label="Naplánovat na">
              <input
                type="datetime-local"
                value={input.scheduled_at}
                onChange={(e) => set({ scheduled_at: e.target.value })}
                className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm"
              />
            </Field>
          )}
          {!isEvent && (
            <Field label="Kategorie">
              <div className="flex flex-wrap gap-1.5">
                {(["news", "story", "event"] as const).map((cat) => (
                  <Chip key={cat} on={input.category === cat} onClick={() => set({ category: cat })}>
                    {CATEGORY_LABEL[cat]}
                  </Chip>
                ))}
              </div>
            </Field>
          )}
          {isEvent && (
            <>
              <Field label="Datum akce">
                <input
                  type="date"
                  value={input.event_date}
                  onChange={(e) => set({ event_date: e.target.value })}
                  className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm"
                />
              </Field>
              <Field label="Místo / čas">
                <input
                  value={input.event_location}
                  onChange={(e) => set({ event_location: e.target.value })}
                  className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
                  placeholder="areál útulku · 10–16 h"
                />
              </Field>
            </>
          )}
          <Field label="Zvíře v článku">
            <AnimalPicker
              animals={animals}
              selectedId={input.animal_id}
              onChange={(id) => set({ animal_id: id })}
            />
            {taggedAnimal && (
              <p className="mt-1.5 text-xs text-ink-400">
                Provázáno s profilem zvířete na Zozio.cz. AI ho použije při generování.
              </p>
            )}
          </Field>
          <Field label="Další zvířata v článku">
            <MultiAnimalPicker
              animals={animals}
              selectedIds={input.animal_ids}
              onChange={(ids) => set({ animal_ids: ids })}
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Zobrazí se na webu jako „Zvířata v článku" a na profilu zvířete jako „Píše se o mně".
            </p>
          </Field>
          <Field label="Obrázek (URL)">
            <input
              value={input.cover_url}
              onChange={(e) => set({ cover_url: e.target.value })}
              className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
              placeholder="https://…"
            />
          </Field>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave(input)}
          className="rounded-pill bg-meadow-500 px-5 py-3 text-sm font-bold text-cream shadow-soft-md hover:bg-meadow-600 disabled:opacity-50"
        >
          {state.id ? "Uložit změny" : "Vytvořit"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-pill border border-sand2 px-5 py-3 text-sm font-bold text-ink-600 hover:bg-cream-warm"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}

// --- Sdílené UI ------------------------------------------------------------

function Toolbar({
  filters,
  active,
  onFilter,
  search,
  onSearch,
  searchPlaceholder,
}: {
  filters: { id: string; label: string; count: number }[];
  active: string;
  onFilter: (id: string) => void;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id)}
            className={cn(
              "rounded-pill border px-3 py-1.5 text-[12.5px] font-bold",
              active === f.id
                ? "border-ink-900 bg-ink-900 text-cream"
                : "border-sand2 bg-warm text-ink-600 hover:bg-cream-warm",
            )}
          >
            {f.label} <span className="opacity-60">{f.count}</span>
          </button>
        ))}
      </div>
      {onSearch && (
        <div className="ml-auto flex min-w-[200px] items-center gap-2 rounded-pill border border-sand2 bg-warm px-3.5 py-2 text-sm text-ink-400">
          <Search className="size-4" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent font-semibold text-ink-700 placeholder:text-ink-400 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-2xl bg-cream px-4 py-3.5 ring-1 ring-ink-900/8">
      <div className="font-display text-2xl font-bold text-ink-700">{n}</div>
      <div className="mt-0.5 text-xs font-bold text-ink-400">{l}</div>
    </div>
  );
}

function Chip({
  children,
  on,
  onClick,
}: {
  children: React.ReactNode;
  on?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill border px-3 py-1.5 text-xs font-bold transition",
        on
          ? "border-meadow-500 bg-meadow-50 text-meadow-700"
          : "border-sand2 bg-warm text-ink-600 hover:bg-cream-warm",
        !onClick && "cursor-default",
      )}
    >
      {children}
    </button>
  );
}

function WidgetOpt({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Vyhledávací výběr zvířete (combobox) pro provázání obsahu s konkrétním zvířetem. */
function CommentModeration() {
  const [items, setItems] = useState<PendingComment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listPendingComments().then(setItems);
  }, []);

  async function act(id: string, action: "approve" | "hide" | "spam") {
    setBusy(id);
    const res = await moderateComment(id, action);
    setBusy(null);
    if ("ok" in res) setItems((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    else alert(res.error);
  }

  if (items === null) {
    return <div className="rounded-2xl bg-cream-warm p-8 text-center text-sm text-ink-500">Načítám…</div>;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-cream-warm p-8 text-center text-sm text-ink-500">
        🎉 Žádné komentáře nečekají na schválení.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        Komentáře hostů u tvých článků čekají na schválení. Přihlášení uživatelé se zobrazují rovnou.
      </p>
      {items.map((c) => (
        <div key={c.id} className="rounded-2xl border border-sand2 bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-400">
            <span className="font-bold text-ink-900">{c.authorName}</span>
            {c.isGuest && <span className="rounded-pill bg-cream-warm px-2 py-0.5">host</span>}
            <span>· {c.articleTitle}</span>
            <span>· {new Date(c.createdAt).toLocaleDateString("cs-CZ")}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{c.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => act(c.id, "approve")}
              className="rounded-pill bg-meadow-500 px-4 py-2 text-xs font-bold text-cream hover:bg-meadow-600 disabled:opacity-50"
            >
              Schválit
            </button>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => act(c.id, "hide")}
              className="rounded-pill border border-sand2 px-4 py-2 text-xs font-bold text-ink-600 hover:bg-cream-warm disabled:opacity-50"
            >
              Skrýt
            </button>
            <button
              type="button"
              disabled={busy === c.id}
              onClick={() => act(c.id, "spam")}
              className="rounded-pill border border-sand2 px-4 py-2 text-xs font-bold text-terracotta-600 hover:bg-peach-100 disabled:opacity-50"
            >
              Spam
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MultiAnimalPicker({
  animals,
  selectedIds,
  onChange,
}: {
  animals: TaggableAnimal[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const selected = animals.filter((a) => selectedIds.includes(a.id));
  const filtered = q
    ? animals.filter(
        (a) => !selectedIds.includes(a.id) && a.name.toLowerCase().includes(q.toLowerCase()),
      )
    : [];

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-50 px-2.5 py-1 text-xs font-bold text-ink-900 ring-1 ring-meadow-500/30"
            >
              {a.name}
              <button
                type="button"
                onClick={() => onChange(selectedIds.filter((id) => id !== a.id))}
                className="text-ink-400 hover:text-terracotta-600"
                aria-label={`Odebrat ${a.name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-2xl border border-sand2 bg-warm px-3 py-2 focus-within:border-meadow-500">
        <Search className="size-4 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Najdi a přidej zvíře…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
      </div>
      {filtered.length > 0 && (
        <div className="max-h-44 overflow-auto rounded-2xl border border-sand2 bg-card">
          {filtered.slice(0, 8).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange([...selectedIds, a.id]);
                setQ("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream-warm"
            >
              <span className="font-semibold text-ink-900">{a.name}</span>
              <span className="text-xs text-ink-400">· {a.species === "cat" ? "kočka" : a.species === "dog" ? "pes" : "zvíře"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnimalPicker({
  animals,
  selectedId,
  onChange,
}: {
  animals: TaggableAnimal[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = animals.find((a) => a.id === selectedId) ?? null;

  const filtered = q
    ? animals.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))
    : animals;

  const statusLabel: Record<string, string> = {
    available: "k adopci",
    reserved: "rezervováno",
    adopted: "adoptováno",
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-meadow-500/40 bg-meadow-50 px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand text-sm">
          {selected.primary_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.primary_photo_url} alt="" className="size-full object-cover" />
          ) : selected.species === "cat" ? (
            "🐈"
          ) : (
            "🐕"
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-ink-900">{selected.name}</div>
          <div className="text-[11px] font-semibold text-ink-400">
            {statusLabel[selected.adoption_status] ?? selected.adoption_status}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ("");
          }}
          className="shrink-0 rounded-pill border border-sand2 px-2.5 py-1 text-xs font-bold text-ink-500 hover:bg-cream-warm"
        >
          Zrušit
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-sand2 bg-warm px-3 py-2 focus-within:border-meadow-500">
        <Search className="size-4 text-ink-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Hledat zvíře podle jména…"
          className="w-full bg-transparent text-sm font-semibold text-ink-700 placeholder:font-normal placeholder:text-ink-400 focus:outline-none"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-sand2 bg-warm py-1 shadow-soft-md">
          {filtered.slice(0, 30).map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(a.id);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-cream-warm"
            >
              <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand text-xs">
                {a.primary_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.primary_photo_url} alt="" className="size-full object-cover" />
                ) : a.species === "cat" ? (
                  "🐈"
                ) : (
                  "🐕"
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink-800">{a.name}</span>
                <span className="block text-[11px] text-ink-400">
                  {statusLabel[a.adoption_status] ?? a.adoption_status}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-2xl border border-sand2 bg-warm px-3 py-2.5 text-sm text-ink-400 shadow-soft-md">
          Nic nenalezeno.
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-sand2 bg-cream px-6 py-10 text-center text-sm font-semibold text-ink-400">
      {children}
    </div>
  );
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative overflow-x-auto rounded-2xl bg-ink-900 p-4">
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-pill bg-meadow-500 px-3 py-1 text-[11px] font-bold text-cream hover:bg-meadow-600"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Zkopírováno" : "Kopírovat"}
      </button>
      <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-cream/90">
        {code}
      </pre>
    </div>
  );
}
