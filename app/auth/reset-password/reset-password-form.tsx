"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

import { ErrorAlert } from "../_components/auth-alert";

const MIN_PASSWORD = 8;

export function ResetPasswordForm({ role }: { role: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Heslo musí mít alespoň ${MIN_PASSWORD} znaků.`);
      return;
    }
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(authErrorMessage(err.message));
        return;
      }
      router.push(role === "visitor" ? "/profil" : "/admin/dashboard");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nové heslo</Label>
        <Input
          id="password"
          type="password"
          placeholder="Alespoň 8 znaků"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          disabled={isPending}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-xl border-ink-900/15 bg-cream text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Heslo znovu</Label>
        <Input
          id="confirm"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
          disabled={isPending}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-12 rounded-xl border-ink-900/15 bg-cream text-base"
        />
      </div>

      <ZozioButton
        type="submit"
        variant="meadow"
        size="lg"
        disabled={isPending || !password || !confirm}
        className="w-full"
      >
        <KeyRound /> {isPending ? "Ukládám…" : "Nastavit nové heslo"}
      </ZozioButton>

      {error && <ErrorAlert>{error}</ErrorAlert>}
    </form>
  );
}
