"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button, KeyCombo } from "./ui/primitives";
import { SHORTCUTS } from "./use-hotkeys";

/** `?`: every keyboard shortcut in one table, grouped by what it acts on. */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border border-line bg-panel shadow-2xl outline-none"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
            <Dialog.Title className="text-[14px] font-semibold text-fg">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 px-0" aria-label="Close">
                <X size={14} aria-hidden />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-[12px]">
              <caption className="sr-only">Keyboard shortcuts</caption>
              {groups.map((g) => (
                <tbody key={g}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={2}
                      className="eyebrow border-b border-line bg-raised/40 px-4 py-1 text-left"
                    >
                      {g}
                    </th>
                  </tr>
                  {SHORTCUTS.filter((s) => s.group === g).map((s) => (
                    <tr key={s.label} className="border-b border-line/60">
                      <th scope="row" className="px-4 py-1 text-left font-normal text-muted">
                        {s.label}
                      </th>
                      <td className="w-[96px] px-4 py-1 text-right">
                        <KeyCombo keys={s.keys} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <p className="shrink-0 border-t border-line px-4 py-2 text-[11px] text-subtle">
            Single-key shortcuts pause while you type in a field or a dialog is open.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
