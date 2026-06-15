"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, ShieldCheck } from "lucide-react";

import type { PublicComment } from "@/lib/magazine";
import { submitComment, toggleCommentLike } from "./actions";

interface Props {
  source: "shelter" | "zozio";
  id: string;
  revalidate: string;
  isLoggedIn: boolean;
  viewerName: string | null;
  comments: PublicComment[];
  total: number;
}

export function ArticleComments({
  source,
  id,
  revalidate,
  isLoggedIn,
  viewerName,
  comments,
  total,
}: Props) {
  return (
    <section className="mx-auto max-w-[760px] px-4 py-2 sm:px-6">
      <h2 className="mb-5 font-display text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
        Komentáře ({total})
      </h2>

      <CommentForm source={source} id={id} revalidate={revalidate} isLoggedIn={isLoggedIn} viewerName={viewerName} />

      {comments.length === 0 ? (
        <p className="mt-6 text-sm text-ink-500">Zatím bez komentářů — buď první.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-5">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              source={source}
              id={id}
              revalidate={revalidate}
              isLoggedIn={isLoggedIn}
              viewerName={viewerName}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeDate(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const day = 86_400_000;
  if (diff < 3_600_000) return "právě teď";
  if (diff < day) return `před ${Math.max(1, Math.round(diff / 3_600_000))} h`;
  const days = Math.round(diff / day);
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  return new Date(iso).toLocaleDateString("cs-CZ");
}

function CommentForm({
  source,
  id,
  revalidate,
  isLoggedIn,
  viewerName,
  parentId,
  onDone,
}: {
  source: "shelter" | "zozio";
  id: string;
  revalidate: string;
  isLoggedIn: boolean;
  viewerName: string | null;
  parentId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState<string | null>(null);
  const [pendingNote, setPendingNote] = useState(false);
  const [submitting, start] = useTransition();

  const send = () => {
    setError(null);
    start(async () => {
      const res = await submitComment({
        source,
        id,
        parentId: parentId ?? null,
        body,
        guestName: isLoggedIn ? undefined : guestName,
        website,
        revalidate,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setBody("");
      setGuestName("");
      if (res.status === "pending") {
        setPendingNote(true);
      } else {
        router.refresh();
        onDone?.();
      }
    });
  };

  return (
    <div className="rounded-3xl bg-card p-4 ring-1 ring-ink-900/8 sm:p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cream-warm text-lg">
          {isLoggedIn ? "🙂" : "🙂"}
        </span>
        <div className="text-sm">
          {isLoggedIn ? (
            <span className="font-bold text-ink-900">
              Komentuješ jako {viewerName ?? "přihlášený uživatel"}
            </span>
          ) : (
            <>
              <span className="font-bold text-ink-900">Komentuješ jako host</span>
              <span className="block text-xs font-semibold text-ink-500">
                Přihlas se a komentář se zobrazí hned.
              </span>
            </>
          )}
        </div>
      </div>

      {!isLoggedIn && (
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          placeholder="Tvoje jméno"
          className="mb-2.5 w-full rounded-xl bg-cream-warm px-3.5 py-2.5 text-sm font-semibold text-ink-900 ring-1 ring-ink-900/10 outline-none placeholder:text-ink-400 focus:ring-terracotta-400"
        />
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        placeholder={parentId ? "Napiš odpověď…" : "Napiš komentář…"}
        className="w-full resize-y rounded-xl bg-cream-warm px-3.5 py-2.5 text-sm text-ink-900 ring-1 ring-ink-900/10 outline-none placeholder:text-ink-400 focus:ring-terracotta-400"
      />

      {/* honeypot */}
      <input
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px]"
        placeholder="Nevyplňuj"
      />

      {error && <p className="mt-2 text-sm font-semibold text-terracotta-600">{error}</p>}
      {pendingNote && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-sunshine-200/60 px-3 py-2 text-xs font-bold text-sunshine-600">
          ⏳ Tvůj komentář čeká na schválení.
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <span className="flex-1 text-xs font-semibold text-ink-500">
          {isLoggedIn ? "Buď k ostatním ohleduplný." : "🛡️ Komentáře hostů zveřejníme po schválení."}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={submitting}
          className="rounded-pill bg-terracotta-500 px-5 py-2.5 text-sm font-bold text-cream transition hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Odesílám…" : parentId ? "Odpovědět" : "Odeslat"}
        </button>
      </div>

      {!isLoggedIn && !parentId && (
        <p className="mt-2.5 text-xs font-semibold text-ink-500">
          Máš účet?{" "}
          <Link href="/auth/login" className="font-bold text-terracotta-600">
            Přihlas se
          </Link>{" "}
          a komentuj pod svým jménem rovnou.
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  source,
  id,
  revalidate,
  isLoggedIn,
  viewerName,
}: {
  comment: PublicComment;
  source: "shelter" | "zozio";
  id: string;
  revalidate: string;
  isLoggedIn: boolean;
  viewerName: string | null;
}) {
  const [liked, setLiked] = useState(comment.liked);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [, start] = useTransition();

  const onLike = () => {
    setLiked((p) => !p);
    setLikeCount((c) => c + (liked ? -1 : 1));
    start(async () => {
      const res = await toggleCommentLike(comment.id);
      setLiked(res.liked);
      setLikeCount(res.count);
    });
  };

  const avatarClass =
    comment.badge === "author"
      ? "bg-fern-100 text-fern-700"
      : comment.badge === "member"
        ? "bg-peach-200 text-terracotta-600"
        : "bg-cream-warm text-ink-600";

  return (
    <div className="flex gap-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarClass}`}>
        {comment.badge === null ? "🙂" : initials(comment.authorName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-ink-900">{comment.authorName}</span>
          {comment.badge === "author" && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-fern-100 px-2 py-0.5 text-[10px] font-bold text-fern-700">
              <ShieldCheck className="size-2.5" /> autor
            </span>
          )}
          {comment.badge === "member" && (
            <span className="rounded-pill bg-peach-200 px-2 py-0.5 text-[10px] font-bold text-terracotta-600">
              přihlášený
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-ink-400">{relativeDate(comment.createdAt)}</div>
        <p className="mt-1 whitespace-pre-line text-[15px] text-ink-700">{comment.body}</p>
        <div className="mt-1.5 flex items-center gap-4 text-xs font-bold text-ink-500">
          <button type="button" onClick={onLike} className="inline-flex items-center gap-1 hover:text-terracotta-600">
            <Heart className={liked ? "size-3.5 fill-terracotta-500 text-terracotta-500" : "size-3.5"} /> Líbí ({likeCount})
          </button>
          <button type="button" onClick={() => setReplying((p) => !p)} className="hover:text-terracotta-600">
            Odpovědět
          </button>
        </div>

        {replying && (
          <div className="mt-3">
            <CommentForm
              source={source}
              id={id}
              revalidate={revalidate}
              isLoggedIn={isLoggedIn}
              viewerName={viewerName}
              parentId={comment.id}
              onDone={() => setReplying(false)}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-4 flex flex-col gap-4 border-l-2 border-ink-900/8 pl-4">
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                source={source}
                id={id}
                revalidate={revalidate}
                isLoggedIn={isLoggedIn}
                viewerName={viewerName}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
