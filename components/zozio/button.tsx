import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const zozioButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display-alt font-semibold whitespace-nowrap select-none transition-all duration-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-meadow-300/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        meadow:
          "bg-meadow-500 text-cream rounded-full btn-3d-meadow hover:bg-meadow-600 active:bg-meadow-600",
        sunshine:
          "bg-sunshine-400 text-ink-900 rounded-full btn-3d-sunshine hover:bg-sunshine-500 active:bg-sunshine-500",
        outline:
          "bg-cream text-ink-900 border-2 border-ink-900/15 rounded-full hover:border-meadow-500 hover:text-meadow-700 active:translate-y-px",
        ghost:
          "bg-transparent text-ink-700 rounded-full hover:bg-meadow-100/60 active:translate-y-px",
        sage:
          "bg-sage-500 text-cream rounded-full hover:bg-sage-700 active:translate-y-px",
      },
      size: {
        sm: "h-9 px-4 text-sm [&_svg]:size-4",
        md: "h-11 px-6 text-base [&_svg]:size-4",
        lg: "h-14 px-8 text-lg [&_svg]:size-5",
        xl: "h-16 px-10 text-xl [&_svg]:size-6",
        icon: "size-11 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "meadow",
      size: "md",
    },
  },
);

interface ZozioButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof zozioButtonVariants> {
  asChild?: boolean;
}

export function ZozioButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ZozioButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="zozio-button"
      className={cn(zozioButtonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { zozioButtonVariants };
