"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

import { ErrorAlert, SuccessAlert } from "../_components/auth-alert";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        "/auth/reset-password",
      )}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo },
      );
      if (err) {
        setError(authErrorMessage(err.message));
        return;
      }
      setSent(true);
    });
  };

  if (sent) {
    return (
      <SuccessAlert title="E-mail odeslán">
        Pokud u nás <strong>{email}</strong> má účet, dorazí na něj odkaz pro
        nastavení nového hesla. Zkontroluj i spam.
      </SuccessAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="jan.novak@example.com"
          required
          autoComplete="email"
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-xl border-ink-900/15 bg-cream text-base"
        />
      </div>

      <ZozioButton
        type="submit"
        variant="meadow"
        size="lg"
        disabled={isPending || !email}
        className="w-full"
      >
        <Mail /> {isPending ? "Odesílám…" : "Poslat odkaz"}
      </ZozioButton>

      {error && <ErrorAlert>{error}</ErrorAlert>}
    </form>
  );
}
