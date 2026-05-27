import { cn } from "@/lib/utils";

interface PawLoaderProps {
  className?: string;
  label?: string;
}

export function PawLoader({ className, label = "Načítám…" }: PawLoaderProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center gap-3 text-ink-600",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-end gap-1.5 text-3xl">
        <span className="animate-paw-1" aria-hidden>🐾</span>
        <span className="animate-paw-2" aria-hidden>🐾</span>
        <span className="animate-paw-3" aria-hidden>🐾</span>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
