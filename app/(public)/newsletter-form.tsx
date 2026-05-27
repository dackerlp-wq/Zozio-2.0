"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ZozioButton } from "@/components/zozio/button";
import { cn } from "@/lib/utils";

interface NewsletterFormProps {
  className?: string;
}

export function NewsletterForm({ className }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      // TODO: napojit /api/newsletter/subscribe — zatím jen optimistic UI
      await new Promise((r) => setTimeout(r, 600));
      setSubscribed(true);
    });
  };

  if (subscribed) {
    return (
      <div
        className={cn(
          "mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-meadow-500/15 px-5 py-4 text-meadow-300 ring-1 ring-inset ring-meadow-500/30",
          className,
        )}
      >
        <CheckCircle2 className="size-5 shrink-0" />
        <span className="text-sm font-semibold">
          Hotovo! Podívej se do schránky a potvrď přihlášení.
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "mx-auto flex max-w-md flex-col gap-3 sm:flex-row",
        className,
      )}
    >
      <Input
        type="email"
        required
        placeholder="tvuj@email.cz"
        value={email}
        disabled={isPending}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 flex-1 rounded-full border-cream/20 bg-cream/10 px-5 text-base text-cream placeholder:text-cream/40 focus:border-cream/40"
      />
      <ZozioButton
        type="submit"
        variant="sunshine"
        size="md"
        disabled={isPending || !email}
        className="h-12"
      >
        {isPending ? "Přihlašuji…" : "Odebírat"}
      </ZozioButton>
    </form>
  );
}
