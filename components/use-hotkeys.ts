"use client";

import * as React from "react";

/**
 * Global keyboard shortcuts.
 *
 * Keys are written lowercase: "mod+k", "/", "?", "escape", "[", "v", "1".
 * `mod` is ⌘ on Apple and Ctrl elsewhere. Single-key shortcuts never fire while
 * the user is typing in a field or while a dialog is open, so they cannot act on
 * something hidden behind it. Only `mod+` shortcuts always fire.
 */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function dialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"][data-state="open"]'));
}

export function comboFor(e: KeyboardEvent): string {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  return (e.metaKey || e.ctrlKey ? "mod+" : "") + key;
}

export function useHotkeys(map: HotkeyMap): void {
  const ref = React.useRef(map);
  ref.current = map;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      const combo = comboFor(e);
      const handler = ref.current[combo];
      if (!handler) return;
      // Escape is deliberately not global: in a field it clears the field, and in
      // a dialog it closes the dialog, without also dropping the selection.
      const isGlobal = combo.startsWith("mod+");
      if (!isGlobal && (isTyping(e.target) || dialogOpen())) return;
      // Leave the browser's own mod shortcuts (copy, reload, find) alone.
      if (combo.startsWith("mod+") && combo !== "mod+k") return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** The documented shortcut list, shared by the help dialog and the command menu. */
export const SHORTCUTS: { keys: string[]; label: string; group: string }[] = [
  { keys: ["mod", "K"], label: "Open the command menu", group: "General" },
  { keys: ["/"], label: "Search towns in the explorer", group: "General" },
  { keys: ["?"], label: "Show keyboard shortcuts", group: "General" },
  { keys: ["["], label: "Show or hide the site explorer", group: "General" },
  { keys: ["Esc"], label: "Clear the selection", group: "General" },
  { keys: ["1"], label: "5 MW edge preset", group: "Scenario" },
  { keys: ["2"], label: "25 MW enterprise preset", group: "Scenario" },
  { keys: ["3"], label: "100 MW campus preset", group: "Scenario" },
  { keys: ["4"], label: "300 MW hyperscale preset", group: "Scenario" },
  { keys: ["V"], label: "Switch between 2D and 3D", group: "Map" },
  { keys: ["G"], label: "Show or hide the suitability grid", group: "Map" },
  { keys: ["R"], label: "Reset to the statewide view", group: "Map" },
  { keys: ["Z"], label: "Zoom to the selected cell", group: "Selected site" },
  { keys: ["P"], label: "Pin or unpin for comparison", group: "Selected site" },
  { keys: ["F"], label: "Find better cells within 25 km", group: "Selected site" },
  { keys: ["B"], label: "Generate the town-meeting brief", group: "Selected site" },
  { keys: ["C"], label: "Compare pinned sites", group: "Selected site" },
  { keys: ["E"], label: "Export the evidence as JSON", group: "Selected site" },
];

export function shortcutFor(label: string): string[] | undefined {
  return SHORTCUTS.find((s) => s.label === label)?.keys;
}
