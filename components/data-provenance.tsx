"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Button, StatusTag, type Status } from "./ui/primitives";
import { fmtPercent } from "@/lib/format";

/** Where every field came from, how fresh it is, and what is missing. */
export function DataProvenance({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { meta, assumptions } = useAtlas();

  const grouped = React.useMemo(() => {
    if (!meta) return [];
    const bySource = new Map<string, { field: string; status: Status; coverage: number }[]>();
    for (const [field, m] of Object.entries(meta.fields)) {
      const key = m.source ?? "__derived";
      const list = bySource.get(key) ?? [];
      list.push({ field, status: m.status as Status, coverage: m.coverage });
      bySource.set(key, list);
    }
    return [...bySource.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [meta]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[min(820px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border border-line bg-panel shadow-2xl outline-none">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <Dialog.Title className="text-[14px] font-semibold text-fg">
                Data sources and vintage
              </Dialog.Title>
              {meta && (
                <p className="mt-0.5 text-[11px] text-subtle">
                  Grid built {new Date(meta.generated_at).toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
                  {meta.hex_count.toLocaleString()} cells at H3 resolution {meta.h3_resolution} ·{" "}
                  {meta.projection}
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 px-0" aria-label="Close">
                <X size={14} aria-hidden />
              </Button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {!meta && <p className="text-[12px] text-muted">Loading source metadata…</p>}

            {meta && (
              <>
                <section className="mb-4">
                  <h3 className="overline mb-1.5">What this build does not know</h3>
                  <ul className="space-y-1.5">
                    {meta.notes.map((n) => (
                      <li key={n} className="text-[11.5px] leading-snug text-muted">
                        {n}
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="space-y-2.5">
                  <h3 className="overline">Field by field</h3>
                  {grouped.map(([sourceId, fields]) => {
                    const src = meta.sources[sourceId];
                    return (
                      <div
                        key={sourceId}
                        className="rounded-[6px] border border-line bg-raised/40 p-2.5"
                      >
                        {src ? (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 text-[12.5px] font-medium text-fg">
                                {src.name}
                              </p>
                              <StatusTag status={src.status as Status} />
                            </div>
                            <p className="mt-0.5 text-[11px] text-subtle">
                              {src.publisher} · vintage {src.vintage} · {src.license}
                            </p>
                            {src.caveat && (
                              <p className="mt-1 text-[11px] leading-snug text-warn/85">
                                {src.caveat}
                              </p>
                            )}
                            <a
                              href={src.landing_page ?? src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-accent hover:underline"
                            >
                              Source
                              <ExternalLink size={9} aria-hidden />
                            </a>
                          </>
                        ) : (
                          <p className="text-[12.5px] font-medium text-fg">
                            Derived inside Atlas
                          </p>
                        )}

                        <ul className="mt-2 flex flex-wrap gap-1">
                          {fields.map((f) => (
                            <li
                              key={f.field}
                              className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-2 py-[2px]"
                            >
                              <code className="num text-[10.5px] text-muted">{f.field}</code>
                              <span
                                className={`overline ${
                                  f.coverage === 0
                                    ? "text-unknown"
                                    : f.coverage < 0.9
                                      ? "text-warn"
                                      : "text-ok/80"
                                }`}
                              >
                                {f.coverage === 0 ? "no data" : fmtPercent(f.coverage)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </section>

                {assumptions && (
                  <section className="mt-4">
                    <h3 className="overline mb-1.5">Economic inputs</h3>
                    <div className="space-y-1.5">
                      {[assumptions.electricity_price, assumptions.grid_carbon].map((a) => (
                        <div
                          key={a.label}
                          className="rounded-[6px] border border-line bg-raised/40 p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-[12px] text-fg">
                              {a.label} —{" "}
                              <span className="num">
                                {a.value} {a.unit}
                              </span>
                              {a.period ? `, ${a.period}` : ""}
                            </p>
                            <StatusTag status={a.status as Status} />
                          </div>
                          {a.caveat && (
                            <p className="mt-1 text-[11px] leading-snug text-warn/85">{a.caveat}</p>
                          )}
                          {a.source_url && (
                            <a
                              href={a.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-accent hover:underline"
                            >
                              {a.source}
                              <ExternalLink size={9} aria-hidden />
                            </a>
                          )}
                        </div>
                      ))}
                      {Object.values(assumptions.scenario).map((a) => (
                        <div
                          key={a.label}
                          className="flex items-start justify-between gap-2 rounded-[6px] border border-line bg-raised/40 px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[12px] text-fg">
                              {a.label} —{" "}
                              <span className="num">
                                {a.value.toLocaleString("en-US")} {a.unit}
                              </span>
                            </p>
                            {a.caveat && (
                              <p className="mt-0.5 text-[11px] leading-snug text-subtle">
                                {a.caveat}
                              </p>
                            )}
                          </div>
                          <StatusTag status="assumption" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-line px-4 py-2.5">
            <p className="text-[10.5px] leading-snug text-subtle">
              Polygon intersections are preliminary geospatial screens, not legal determinations.
              Scores are a planning aid, not a permitting decision.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
