"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

import { GoogleButton } from "../_components/google-button";
import { AuthDivider, ErrorAlert } from "../_components/auth-alert";

interface LoginFormProps {
  next?: string;
  initialError?: string;
}

export function LoginForm({ next, initialError }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialError ? authErrorMessage(initialError) : null,
  );
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(authErrorMessage(err.message));
        return;
      }

      const role = data.user?.user_metadata?.role as string | undefined;
      const destination =
        next ?? (role === "visitor" ? "/profil" : "/admin/dashboard");
      router.push(destination);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Heslo</Label>
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-meadow-700 hover:text-meadow-600"
            >
              Zapomněl jsi heslo?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border-ink-900/15 bg-cream text-base"
          />
        </div>

        <ZozioButton
          type="submit"
          variant="meadow"
          size="lg"
          disabled={isPending || !email || !password}
          className="w-full"
        >
          <LogIn /> {isPending ? "Přihlašuji…" : "Přihlásit se"}
        </ZozioButton>
      </form>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <AuthDivider />

      <GoogleButton next={next} onError={(msg) => setError(authErrorMessage(msg))} />

      <p className="text-center text-xs text-ink-400">
        Přihlášením souhlasíš s{" "}
        <a href="/obchodni-podminky" className="underline hover:text-ink-600">
          podmínkami
        </a>{" "}
        a{" "}
        <a href="/zasady-soukromi" className="underline hover:text-ink-600">
          zásadami zpracování osobních údajů
        </a>
        .
      </p>
    </div>
  );
}
