"use client";

import { useEffect } from "react";

/**
 * Zaznamená jedno zobrazení profilu za session (proti dvojímu počítání při
 * re-renderu). Fire-and-forget — neblokuje a tiše ignoruje chyby.
 */
export function ViewTracker({ animalId }: { animalId: string }) {
  useEffect(() => {
    const key = `viewed:${animalId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`/api/public/animals/${animalId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  }, [animalId]);
  return null;
}
