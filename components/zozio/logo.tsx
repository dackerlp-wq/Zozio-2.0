import Link from "next/link";

import { cn } from "@/lib/utils";

interface ZozLogoProps {
  className?: string;
  href?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-5xl",
} as const;

export function ZozLogo({ className, href = "/", size = "md" }: ZozLogoProps) {
  const inner = (
    <span
      className={cn(
        "inline-block font-display font-bold tracking-tight text-ink-900",
        sizeClass[size],
        className,
      )}
    >
      zozio<span className="text-meadow-500">.</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label="Zozio – domů">
      {inner}
    </Link>
  );
}
