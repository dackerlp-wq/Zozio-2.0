"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Home, UserPlus } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

import { GoogleButton } from "../_components/google-button";
import { AuthDivider, ErrorAlert, SuccessAlert } from "../_components/auth-alert";

type Account = "adopter" | "shelter";

interface RegisterFormProps {
  next?: string;
}

const MIN_PASSWORD = 8;

export function RegisterForm({ next }: RegisterFormProps) {
  const router = useRouter();
  const [account, setAccount] = useState<Account>("adopter");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Adoptant → role visitor + /profil. Útulek → bez role (proxy ho pošle na
  // onboarding, který nastaví owner).
  const destination =
    next ?? (account === "adopter" ? "/profil" : "/admin/onboarding");

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
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        destination,
      )}`;

      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: account === "adopter" ? { role: "visitor" } : {},
        },
      });

      if (err) {
        setError(authErrorMessage(err.message));
        return;
      }

      // Když je e-mailové potvrzení vypnuté, vrací se rovnou session.
      if (data.session) {
        router.push(destination);
        router.refresh();
        return;
      }

      setSentTo(email.trim());
    });
  };

  if (sentTo) {
    return (
      <SuccessAlert title="Skoro hotovo — potvrď e-mail">
        Poslali jsme potvrzovací odkaz na <strong>{sentTo}</strong>. Klikni na něj
        a dokončíš registraci.
      </SuccessAlert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Volba typu účtu */}
      <div className="space-y-2">
        <Label>Chci…</Label>
        <div className="grid grid-cols-2 gap-2">
          <AccountOption
            active={account === "adopter"}
            icon={<Heart className="size-5" />}
            title="Adoptovat"
            subtitle="Hledám parťáka"
            onClick={() => setAccount("adopter")}
          />
          <AccountOption
            active={account === "shelter"}
            icon={<Home className="size-5" />}
            title="Spravovat útulek"
            subtitle="Jsem z útulku"
            onClick={() => setAccount("shelter")}
          />
        </div>
      </div>

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
          <Label htmlFor="password">Heslo</Label>
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
          disabled={isPending || !email || !password || !confirm}
          className="w-full"
        >
          <UserPlus /> {isPending ? "Zakládám účet…" : "Vytvořit účet"}
        </ZozioButton>
      </form>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      <AuthDivider />

      <GoogleButton
        next={destination}
        role={account === "adopter" ? "visitor" : undefined}
        label="Registrovat se přes Google"
        onError={(msg) => setError(authErrorMessage(msg))}
      />

      <p className="text-center text-xs text-ink-400">
        Registrací souhlasíš s{" "}
        <a href="#" className="underline hover:text-ink-600">
          podmínkami
        </a>{" "}
        a{" "}
        <a href="#" className="underline hover:text-ink-600">
          zásadami zpracování osobních údajů
        </a>
        .
      </p>
    </div>
  );
}

function AccountOption({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition-colors " +
        (active
          ? "border-meadow-500 bg-meadow-100"
          : "border-ink-900/10 bg-cream-warm hover:border-meadow-300")
      }
    >
      <span className={active ? "text-meadow-700" : "text-ink-500"}>{icon}</span>
      <span className="font-semibold text-ink-900">{title}</span>
      <span className="text-xs text-ink-500">{subtitle}</span>
    </button>
  );
}
