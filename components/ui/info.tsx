"use client";

import * as React from "react";
import * as RTooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={120} skipDelayDuration={200}>
      {children}
    </RTooltip.Provider>
  );
}

export function Hint({
  children,
  content,
  side = "top",
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 max-w-[300px] rounded-[8px] border border-line bg-raised px-2.5 py-2",
            "text-[11.5px] leading-snug text-muted shadow-lg",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
            className,
          )}
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/** The standard "why does this say that" affordance. */
export function InfoDot({
  content,
  label = "More information",
  side,
}: {
  content: React.ReactNode;
  label?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Hint content={content} side={side}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:text-accent"
      >
        <Info size={12} strokeWidth={2} aria-hidden />
      </button>
    </Hint>
  );
}
