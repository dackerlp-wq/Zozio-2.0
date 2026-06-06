"use client";

import { useEffect } from "react";

/** Zaznamená jedno zobrazení obsahu za session (fire-and-forget). */
export function ContentViewTracker({ contentId }: { contentId: string }) {
  useEffect(() => {
    const key = `content-viewed:${contentId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`/api/public/content/${contentId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [contentId]);
  return null;
}
