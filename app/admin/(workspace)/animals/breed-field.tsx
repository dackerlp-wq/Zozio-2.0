"use client";

import { useId, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Sdílený výběr plemene — našeptávač z globálního katalogu (datalist) +
 * přepínač „kříženec" s druhým plemenem + tlačítko „Nové plemeno".
 * Používá se shodně v profilu zvířete i v příjmovém formuláři.
 */
export function BreedField({
  breedOptions,
  breed,
  isCrossbreed,
  breedSecondary,
  disabled,
  onBreed,
  onCrossbreed,
  onBreedSecondary,
  onCreate,
}: {
  breedOptions: string[];
  breed: string;
  isCrossbreed: boolean;
  breedSecondary: string;
  disabled: boolean;
  onBreed: (v: string) => void;
  onCrossbreed: (v: boolean) => void;
  onBreedSecondary: (v: string) => void;
  /** Explicitní založení nového plemene; vrací true při úspěchu. */
  onCreate: (name: string) => Promise<boolean>;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitNew() {
    if (!newName.trim()) return;
    setBusy(true);
    const ok = await onCreate(newName);
    setBusy(false);
    if (ok) {
      setNewName("");
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-600">
          Plemeno
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-600">
          <input
            type="checkbox"
            checked={isCrossbreed}
            disabled={disabled}
            onChange={(e) => onCrossbreed(e.target.checked)}
            className="accent-meadow-500"
          />
          Kříženec
        </label>
      </div>

      <div className="flex gap-2">
        <BreedCombo
          list={breedOptions}
          value={breed}
          disabled={disabled}
          placeholder="Začni psát plemeno…"
          onChange={onBreed}
          className="flex-1"
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border-[1.5px] border-dashed border-ink-900/20 px-3 text-sm font-semibold text-ink-600 hover:border-meadow-500 hover:text-meadow-600"
          >
            <Plus className="size-4" /> Nové plemeno
          </button>
        )}
      </div>

      {creating && !disabled && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            className="admin-input flex-1"
            value={newName}
            placeholder="Název nového plemene…"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNew();
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !newName.trim()}
            onClick={submitNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-meadow-500 px-4 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Přidat
          </button>
        </div>
      )}

      {isCrossbreed && (
        <div className="mt-2">
          <BreedCombo
            list={breedOptions}
            value={breedSecondary}
            disabled={disabled}
            placeholder="Druhé plemeno (méně výrazné)…"
            onChange={onBreedSecondary}
          />
        </div>
      )}
      <p className="mt-1.5 text-xs text-ink-500">
        {isCrossbreed
          ? "První plemeno je hlavní (zobrazí se výrazně), druhé je doplňkové."
          : "Vyber z číselníku, nebo přidej nové plemeno tlačítkem."}
      </p>
    </div>
  );
}

/**
 * Textové pole plemene s našeptávačem (datalist z globálního katalogu).
 * Psaní jen mění hodnotu — nic se neukládá, dokud se neuloží formulář. Nové
 * plemeno do katalogu se zakládá výhradně tlačítkem „Nové plemeno".
 */
function BreedCombo({
  list,
  value,
  disabled,
  placeholder,
  onChange,
  className,
}: {
  list: string[];
  value: string;
  disabled: boolean;
  placeholder: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <>
      <input
        className={cn("admin-input", className)}
        list={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={id}>
        {list.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  );
}
