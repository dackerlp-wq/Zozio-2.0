import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const zozioBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-body font-semibold whitespace-nowrap leading-none",
  {
    variants: {
      variant: {
        available:
          "bg-meadow-100 text-meadow-700 ring-1 ring-inset ring-meadow-300/40",
        reserved:
          "bg-sunshine-200 text-sunshine-600 ring-1 ring-inset ring-sunshine-400/40",
        adopted:
          "bg-sage-100 text-sage-700 ring-1 ring-inset ring-sage-300/40",
        urgent:
          "bg-terracotta-500 text-cream",
        fresh:
          "bg-fern-100 text-fern-700 ring-1 ring-inset ring-fern-600/30",
        longStay:
          "bg-peach-200 text-terracotta-600 ring-1 ring-inset ring-peach-300",
        soft:
          "bg-cream-warm text-ink-700 ring-1 ring-inset ring-ink-900/8",
        outline:
          "bg-transparent text-ink-700 ring-1 ring-inset ring-ink-900/15",
      },
      size: {
        sm: "h-6 px-2.5 text-xs",
        md: "h-7 px-3 text-sm",
        lg: "h-8 px-3.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "soft",
      size: "md",
    },
  },
);

interface ZozioBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof zozioBadgeVariants> {}

export function ZozioBadge({
  className,
  variant,
  size,
  ...props
}: ZozioBadgeProps) {
  return (
    <span
      data-slot="zozio-badge"
      className={cn(zozioBadgeVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { zozioBadgeVariants };
