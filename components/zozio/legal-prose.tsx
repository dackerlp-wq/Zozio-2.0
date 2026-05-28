interface LegalProseProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

export function LegalProse({ title, updated, children }: LegalProseProps) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
        Právní
      </div>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-ink-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-ink-400">Poslední aktualizace: {updated}</p>

      <div className="mt-10 space-y-5 leading-relaxed text-ink-600 [&_a]:text-meadow-700 [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-1 [&_strong]:text-ink-900 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
