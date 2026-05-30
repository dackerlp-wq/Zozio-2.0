export function TabPlaceholder({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-ink-600">{description}</p>
      <span className="mt-4 inline-flex rounded-full bg-sunshine-200 px-3 py-1 text-xs font-semibold text-sunshine-600">
        Připravujeme
      </span>
    </div>
  );
}
