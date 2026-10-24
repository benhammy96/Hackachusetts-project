"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, MapPin, Search, Hexagon } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { KeyCombo, Kbd, StatusTag } from "./ui/primitives";
import { rankSites } from "@/lib/alternatives";
import { fmtScore, titleCase } from "@/lib/format";
import type { HexRecord, ScoreResult } from "@/lib/types";

export interface Command {
  id: string;
  label: string;
  group: string;
  keys?: string[];
  /** Extra words the filter matches, e.g. "mw size" for presets. */
  keywords?: string;
  /** When set, the command shows but cannot run, and this says why. */
  disabledReason?: string;
  run: () => void;
}

interface Item {
  id: string;
  group: string;
  label: string;
  detail?: string;
  keys?: string[];
  icon?: React.ReactNode;
  score?: { value: string; color: string };
  disabledReason?: string;
  run: () => void;
}

const H3_ID = /^8[0-9a-f]{14}$/;

function matches(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q) return true;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((t) => hay.includes(t));
}

/**
 * ⌘K: jump to a town or a cell, or run any action in the app. Towns resolve to
 * their best-scoring cell under the current size, cooling and lens, so the
 * jump lands on the same answer the explorer would rank first.
 */
export function CommandMenu({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  commands: Command[];
}) {
  const { index, mw, cooling, lens, select, flyTo, scoreFor } = useAtlas();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // Best cell per town, computed only while the menu is open.
  const towns = React.useMemo(() => {
    if (!open || !index) return [] as { town: string; hex: HexRecord; result: ScoreResult }[];
    const seen = new Map<string, { town: string; hex: HexRecord; result: ScoreResult }>();
    for (const row of rankSites(index, { mw, cooling, lens, limit: Number.POSITIVE_INFINITY })) {
      const town = row.hex.town;
      if (town && !seen.has(town)) seen.set(town, { town, hex: row.hex, result: row.result });
    }
    return [...seen.values()].sort((a, b) => a.town.localeCompare(b.town));
  }, [open, index, mw, cooling, lens]);

  const goTo = React.useCallback(
    (hex: HexRecord) => {
      select(hex.h3);
      flyTo(hex.lat, hex.lng, 12.5);
      onOpenChange(false);
    },
    [select, flyTo, onOpenChange],
  );

  const items = React.useMemo<Item[]>(() => {
    const q = query.trim();
    const out: Item[] = [];

    const cellId = q.toLowerCase();
    if (H3_ID.test(cellId) && index) {
      const hex = index.get(cellId);
      if (hex) {
        const r = scoreFor(hex);
        out.push({
          id: `cell-${hex.h3}`,
          group: "Cell",
          label: `Go to cell ${hex.h3}`,
          detail: titleCase(hex.town),
          icon: <Hexagon size={13} aria-hidden />,
          score:
            r.score === null && !r.excluded
              ? { value: "Not available", color: "var(--color-unknown)" }
              : { value: r.excluded ? "0.0" : fmtScore(r.score), color: r.band.color },
          run: () => goTo(hex),
        });
      }
    }

    if (q.length >= 2) {
      const ql = q.toLowerCase();
      const hits = towns
        .filter((t) => t.town.toLowerCase().includes(ql))
        .sort(
          (a, b) =>
            Number(!a.town.toLowerCase().startsWith(ql)) - Number(!b.town.toLowerCase().startsWith(ql)),
        )
        .slice(0, 8);
      for (const t of hits) {
        out.push({
          id: `town-${t.town}`,
          group: "Towns",
          label: titleCase(t.town),
          detail: "best cell in town",
          icon: <MapPin size={13} aria-hidden />,
          score: { value: fmtScore(t.result.score), color: t.result.band.color },
          run: () => goTo(t.hex),
        });
      }
    }

    for (const c of commands) {
      if (!matches(q, c.label, c.group, c.keywords)) continue;
      out.push({
        id: c.id,
        group: c.group,
        label: c.label,
        keys: c.keys,
        disabledReason: c.disabledReason,
        run: () => {
          onOpenChange(false);
          c.run();
        },
      });
    }
    return out;
  }, [query, towns, commands, index, scoreFor, goTo, onOpenChange]);

  React.useEffect(() => setActive(0), [query]);

  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item && !item.disabledReason) item.run();
    }
  };

  // Group headings in first-seen order.
  let lastGroup = "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 flex max-h-[64vh] w-[min(600px,92vw)] -translate-x-1/2 flex-col overflow-hidden rounded-[10px] border border-line bg-panel shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
            <Search size={14} aria-hidden className="shrink-0 text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search a town, paste a cell ID, or type a command"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-list"
              aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
              aria-autocomplete="list"
              className="h-8 min-w-0 flex-1 rounded-[6px] bg-transparent px-1 text-[13px] text-fg placeholder:text-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            aria-label="Results"
            className="min-h-0 flex-1 overflow-y-auto p-1"
          >
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-[12px] text-subtle">
                Nothing matches “{query}”. Town search covers towns with at least one cell that
                passes the hard screens.
              </p>
            )}
            {items.map((item, i) => {
              const heading = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const isActive = i === active;
              return (
                <React.Fragment key={item.id}>
                  {heading && (
                    <div role="presentation" className="overline px-2 pb-1 pt-2">
                      {heading}
                    </div>
                  )}
                  <div
                    id={`cmd-${item.id}`}
                    data-index={i}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={Boolean(item.disabledReason)}
                    onMouseMove={() => setActive(i)}
                    onClick={() => !item.disabledReason && item.run()}
                    className={`flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-[12px] ${
                      isActive ? "bg-raised text-fg" : "text-muted"
                    } ${item.disabledReason ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {item.icon && <span className="shrink-0 text-subtle">{item.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                      {item.detail && (
                        <span className="ml-2 text-[11px] text-subtle">{item.detail}</span>
                      )}
                      {item.disabledReason && (
                        <span className="ml-2 text-[11px] text-subtle">{item.disabledReason}</span>
                      )}
                    </span>
                    {item.score && (
                      <span className="num shrink-0 text-[12px] font-semibold" style={{ color: item.score.color }}>
                        {item.score.value}
                        {item.score.value !== "Not available" && (
                          <span className="text-[10px] font-normal text-subtle"> / 10</span>
                        )}
                      </span>
                    )}
                    {item.keys && <KeyCombo keys={item.keys} />}
                    {isActive && !item.disabledReason && (
                      <CornerDownLeft size={12} aria-hidden className="shrink-0 text-subtle" />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line px-3 text-[11px] text-subtle">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> run
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <StatusTag status="modeled" />
              Screening estimates for {mw} MW under the current lens
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
