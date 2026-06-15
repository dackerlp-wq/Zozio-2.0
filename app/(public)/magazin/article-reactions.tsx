"use client";

import { useState, useTransition } from "react";
import { Heart, Link2, Share2 } from "lucide-react";

import { toggleArticleLike } from "./actions";

interface Props {
  source: "shelter" | "zozio";
  id: string;
  initialLiked: boolean;
  initialCount: number;
}

export function ArticleReactions({ source, id, initialLiked, initialCount }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const onLike = () => {
    // Optimistický update, server je zdroj pravdy.
    setLiked((p) => !p);
    setCount((c) => c + (liked ? -1 : 1));
    start(async () => {
      const res = await toggleArticleLike({ source, id });
      setLiked(res.liked);
      setCount(res.count);
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const fbHref =
    typeof window !== "undefined"
      ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`
      : "#";

  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-ink-900/8 py-5">
      <button
        type="button"
        onClick={onLike}
        disabled={pending}
        aria-pressed={liked}
        className={
          liked
            ? "inline-flex items-center gap-2 rounded-pill bg-peach-200 px-5 py-2.5 text-sm font-bold text-terracotta-600 ring-1 ring-terracotta-400 transition disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-pill bg-card px-5 py-2.5 text-sm font-bold text-ink-700 ring-1 ring-ink-900/12 transition hover:ring-ink-900/25 disabled:opacity-60"
        }
      >
        <Heart className={liked ? "size-4 fill-terracotta-500 text-terracotta-500" : "size-4 text-terracotta-500"} />
        Líbí se mi · {count}
      </button>

      <div className="ml-auto flex gap-2">
        <a
          href={fbHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-pill bg-card px-4 py-2.5 text-[13px] font-bold text-ink-700 ring-1 ring-ink-900/12 transition hover:ring-ink-900/25"
        >
          <Share2 className="size-3.5" /> Facebook
        </a>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-pill bg-card px-4 py-2.5 text-[13px] font-bold text-ink-700 ring-1 ring-ink-900/12 transition hover:ring-ink-900/25"
        >
          <Link2 className="size-3.5" /> {copied ? "Zkopírováno!" : "Kopírovat odkaz"}
        </button>
      </div>
    </div>
  );
}
