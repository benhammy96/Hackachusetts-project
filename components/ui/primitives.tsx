"use client";

import * as React from "react";
import * as RSwitch from "@radix-ui/react-switch";
import * as RSeparator from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/format";

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "default" | "ghost" | "danger";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
  }
>(function Button({ className, variant = "default", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[6px] border font-medium",
        "transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-7 px-2 text-[11px]" : "h-8 px-3 text-[12px]",
        variant === "primary" &&
          "border-accent/60 bg-accent-muted text-accent hover:bg-accent/20",
        variant === "default" &&
          "border-line bg-raised text-fg hover:border-subtle hover:bg-[#1d2a36]",
        variant === "ghost" && "border-transparent bg-transparent text-muted hover:bg-raised hover:text-fg",
        variant === "danger" && "border-bad/50 bg-bad/10 text-bad hover:bg-bad/20",
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------------------------------- SegmentedControl */

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex h-8 items-center rounded-[6px] border border-line bg-panel p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 whitespace-nowrap rounded-[4px] px-2.5 text-[12px] font-medium transition-colors duration-100",
              active
                ? "bg-accent-muted text-accent"
                : "text-muted hover:bg-raised hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Select */

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "h-8 appearance-none rounded-[6px] border border-line bg-panel pl-2.5 pr-7",
          "text-[12px] text-fg transition-colors hover:border-subtle",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2 h-3 w-3 text-subtle"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </label>
  );
}

/* ------------------------------------------------------------- StatusTag */

export type Status = "verified" | "modeled" | "proxy" | "unavailable" | "assumption";

/** Small textual status marker. Deliberately not a colourful badge. */
export function StatusTag({ status, className }: { status: Status; className?: string }) {
  const tone =
    status === "verified"
      ? "text-ok/90"
      : status === "unavailable"
        ? "text-unknown"
        : status === "proxy"
          ? "text-warn/90"
          : "text-muted";
  return (
    <span className={cn("eyebrow shrink-0", tone, className)} title={describeStatus(status)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function describeStatus(status: Status): string {
  switch (status) {
    case "verified":
      return "Measured directly from the publisher's dataset.";
    case "modeled":
      return "Derived from publisher data using a documented assumption.";
    case "proxy":
      return "A stand-in variable. It is not the same thing as the label implies.";
    case "assumption":
      return "A scenario input you can change. Not a measurement.";
    case "unavailable":
      return "No data loaded. The factor is dropped from the score rather than guessed.";
  }
}

/* -------------------------------------------------------------------- Bar */

export function Bar({
  value,
  max = 1,
  color,
  className,
}: {
  value: number | null;
  max?: number;
  color?: string;
  className?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[#1b2631]", className)}
      role="presentation"
    >
      {value !== null && (
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct}%`, background: color ?? "var(--color-accent)" }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Separator */

export function Separator({ className }: { className?: string }) {
  return (
    <RSeparator.Root
      className={cn("h-px w-full shrink-0 bg-line", className)}
      decorative
    />
  );
}

/* ----------------------------------------------------------------- Switch */

export function Toggle({
  checked,
  onChange,
  label,
  swatch,
  disabled,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  swatch?: string;
  disabled?: boolean;
  detail?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[32px] cursor-pointer items-center gap-2 rounded-[6px] px-1.5 py-1",
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-raised",
      )}
    >
      <RSwitch.Root
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className={cn(
          "relative h-[14px] w-[26px] shrink-0 rounded-full border transition-colors duration-100",
          checked ? "border-accent/70 bg-accent/35" : "border-line bg-[#1b2631]",
        )}
      >
        <RSwitch.Thumb
          className={cn(
            "block h-[10px] w-[10px] translate-x-[2px] rounded-full transition-transform duration-100",
            checked ? "translate-x-[13px] bg-accent" : "bg-subtle",
          )}
        />
      </RSwitch.Root>
      {swatch && (
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-white/15"
          style={{ background: swatch }}
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] text-fg">{label}</span>
      {detail && <span className="eyebrow shrink-0">{detail}</span>}
    </label>
  );
}

/* -------------------------------------------------------------------- Kbd */

/** A keyboard key, for shortcut hints. `mod` renders as ⌘ on Apple, Ctrl elsewhere. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  const mod = useModKey();
  return (
    <kbd
      className={cn(
        "num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] border border-line bg-raised px-1",
        "text-[10px] font-medium leading-none text-muted",
        className,
      )}
    >
      {children === "mod" ? mod : children}
    </kbd>
  );
}

export function KeyCombo({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Resolved after mount to keep SSR stable. */
export function useModKey(): string {
  const [mod, setMod] = React.useState("⌘");
  React.useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod("Ctrl");
  }, []);
  return mod;
}

/* ------------------------------------------------------------------- Flag */

/** Compact textual state indicator for dense tables. Never colour alone. */
export function Flag({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "warn" | "bad" | "ok";
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "num inline-flex h-4 shrink-0 items-center rounded-[6px] border px-1 text-[10px] font-medium leading-none",
        tone === "warn" && "border-warn/40 text-warn",
        tone === "bad" && "border-bad/40 text-bad",
        tone === "ok" && "border-ok/40 text-ok",
        tone === "neutral" && "border-line text-subtle",
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Skeleton */

/** Reserves space rather than changing layout (UI_DESIGN.md section 3). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[4px] bg-[#1b2631]", className)} />;
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6">
      <p className="text-[13px] font-semibold text-fg">{title}</p>
      {children && <div className="mt-2 space-y-2 text-[12px] text-muted">{children}</div>}
    </div>
  );
}
