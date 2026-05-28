import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
      <AlertCircle className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function SuccessAlert({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-meadow-100 p-5 text-meadow-700 ring-1 ring-inset ring-meadow-300/40">
      <CheckCircle2 className="size-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-sm text-meadow-700/80">{children}</div>}
      </div>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-ink-900/10" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-cream px-3 text-ink-400">nebo</span>
      </div>
    </div>
  );
}
