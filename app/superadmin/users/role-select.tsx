"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { setUserRole } from "./actions";

const ROLES: { value: string; label: string }[] = [
  { value: "superadmin", label: "Superadmin" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "visitor", label: "Adoptant" },
];

export function RoleSelect({
  userId,
  current,
}: {
  userId: string;
  current: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleChange = (role: string) => {
    if (role === current) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await setUserRole(userId, role);
      if ("error" in r) setError(r.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "rounded-pill border-2 border-ink-900/10 bg-cream px-3 py-1 text-sm font-medium text-ink-900",
          isPending && "opacity-60",
        )}
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {isPending && <Loader2 className="size-4 animate-spin text-ink-400" />}
      {saved && <Check className="size-4 text-meadow-600" />}
      {error && <span className="text-xs text-berry">{error}</span>}
    </div>
  );
}
