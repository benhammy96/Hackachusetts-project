"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import { useAtlas } from "./atlas-provider";
import { Button, StatusTag, type Status } from "./ui/primitives";
import { fmtInt, fmtNumber, fmtPercent, NOT_AVAILABLE } from "@/lib/format";
import {
  CONDITIONAL_FIELD,
  SOURCE_ROLE_LABEL,
  fieldLabel,
} from "@/lib/field-labels";
import type { DataMeta, SourceMeta } from "@/lib/hexes";
import type { MeasuredInput } from "@/lib/economics";
import { cn } from "@/lib/utils";

interface FieldRow {
  field: string;
  status: Status;
  coverage: number;
}

interface DatasetEntry {
  id: string;
  src: SourceMeta;
  fields: FieldRow[];
  /** Plain-language use, for a source that feeds no field directly. */
  role: string | null;
}

interface Groups {
  scored: DatasetEntry[];
  exclusion: DatasetEntry[];
  basemap: DatasetEntry[];
  computed: FieldRow[];
  unavailable: FieldRow[];
}

function groupMeta(meta: DataMeta): Groups {
  const bySource = new Map<string, FieldRow[]>();
  const computed: FieldRow[] = [];
  const unavailable: FieldRow[] = [];

  for (const [field, m] of Object.entries(meta.fields)) {
    const row = { field, status: m.status as Status, coverage: m.coverage };
    if (m.source) {
      bySource.set(m.source, [...(bySource.get(m.source) ?? []), row]);
    } else if (m.status === "unavailable") {
      unavailable.push(row);
    } else {
      computed.push(row);
    }
  }

  const scored: DatasetEntry[] = [];
  const combined: DatasetEntry[] = [];
  const exclusion: DatasetEntry[] = [];
  const basemap: DatasetEntry[] = [];

  for (const [id, src] of Object.entries(meta.sources)) {
    const fields = bySource.get(id) ?? [];
    const role = src.role ?? null;
    if (fields.length > 0) {
      scored.push({ id, src, fields, role: null });
    } else if (role === "exclusion") {
      exclusion.push({ id, src, fields, role: SOURCE_ROLE_LABEL.exclusion });
    } else if (role === "basemap") {
      basemap.push({ id, src, fields, role: SOURCE_ROLE_LABEL.basemap });
    } else if (role && meta.fields[role]) {
      combined.push({ id, src, fields, role });
    } else {
      scored.push({
        id,
        src,
        fields,
        role: "Not tied to a single published field.",
      });
    }
  }

  scored.sort(
    (a, b) =>
      b.fields.length - a.fields.length || a.src.name.localeCompare(b.src.name),
  );

  // A source that is merged into another source's field sits directly after it.
  for (const c of combined) {
    const field = c.role as string;
    const ownerIdx = scored.findIndex((s) =>
      s.fields.some((f) => f.field === field),
    );
    const owner = ownerIdx >= 0 ? scored[ownerIdx] : null;
    const entry = {
      ...c,
      role: owner
        ? `Combined with ${owner.src.name} for “${fieldLabel(field)}”.`
        : `Used for “${fieldLabel(field)}”.`,
    };
    if (ownerIdx >= 0) scored.splice(ownerIdx + 1, 0, entry);
    else scored.push(entry);
  }

  exclusion.sort((a, b) => a.src.name.localeCompare(b.src.name));
  return { scored, exclusion, basemap, computed, unavailable };
}

/** Where every field came from, how fresh it is, and what is missing. */
export function DataProvenance({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { meta, assumptions } = useAtlas();
  const groups = React.useMemo(() => (meta ? groupMeta(meta) : null), [meta]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(860px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border border-line bg-panel outline-none">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-fg">
                Data sources
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] text-muted">
                {meta ? (
                  <>
                    <span className="num">
                      {Object.keys(meta.sources).length}
                    </span>{" "}
                    published datasets ·{" "}
                    <span className="num">{fmtInt(meta.hex_count)}</span>{" "}
                    screening cells ·{" "}
                    <span className="num">
                      {meta.hex_area_km2.toFixed(2)} km²
                    </span>{" "}
                    each
                  </>
                ) : (
                  "Where every number comes from, and what is missing."
                )}
              </Dialog.Description>
              {meta && (
                <p className="mt-0.5 text-[11px] text-subtle">
                  Distances: {meta.projection}
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 px-0"
                aria-label="Close"
              >
                <X size={15} aria-hidden />
              </Button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
            {!meta && (
              <p className="text-[12px] text-muted">Loading source metadata…</p>
            )}

            {meta && groups && (
              <>
                <Section title="Known limits of this build">
                  <ul className="space-y-2 rounded-[8px] border border-line bg-raised/40 px-4 py-3">
                    {meta.notes.map((n) => (
                      <li
                        key={n}
                        className="flex gap-2.5 text-[12px] leading-relaxed text-muted"
                      >
                        <span
                          aria-hidden
                          className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-subtle"
                        />
                        {n}
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section
                  title="Measurements per cell"
                  count={groups.scored.length}
                  hint="Percentages are the share of grid cells that have a value."
                >
                  <DatasetList entries={groups.scored} />
                </Section>

                {groups.exclusion.length > 0 && (
                  <Section
                    title="Hard exclusion screens"
                    count={groups.exclusion.length}
                  >
                    <DatasetList entries={groups.exclusion} />
                  </Section>
                )}

                {(groups.computed.length > 0 ||
                  groups.unavailable.length > 0) && (
                  <Section title="Computed by Atlas, or not available">
                    <div className="rounded-[8px] border border-line px-4 py-2">
                      <FieldTable
                        rows={[...groups.computed, ...groups.unavailable]}
                        showStatus
                      />
                    </div>
                  </Section>
                )}

                {groups.basemap.length > 0 && (
                  <Section title="Basemap only" count={groups.basemap.length}>
                    <DatasetList entries={groups.basemap} />
                  </Section>
                )}

                {assumptions && (
                  <Section title="Economic inputs">
                    <EconomicTable
                      measured={[
                        assumptions.electricity_price,
                        assumptions.grid_carbon,
                      ]}
                      scenario={Object.values(assumptions.scenario)}
                    />
                  </Section>
                )}
              </>
            )}
          </div>

          <footer className="shrink-0 border-t border-line px-5 py-3">
            <p className="text-[11px] text-subtle">
              Scores are a planning aid, not a permitting decision.
            </p>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ------------------------------------------------------------- pieces */

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-fg">
          {title}
          {count !== undefined && (
            <span className="num ml-2 text-[11px] font-normal text-subtle">
              {count}
            </span>
          )}
        </h3>
        {hint && <p className="text-[11px] text-subtle">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function DatasetList({ entries }: { entries: DatasetEntry[] }) {
  return (
    <ul className="divide-y divide-line rounded-[8px] border border-line">
      {entries.map((e) => (
        <DatasetRow key={e.id} entry={e} />
      ))}
    </ul>
  );
}

function DatasetRow({ entry }: { entry: DatasetEntry }) {
  const { src, fields, role } = entry;
  const href = src.landing_page ?? src.url;
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-baseline gap-1.5 text-[13px] font-medium text-fg hover:text-accent"
          >
            {src.name}
            <ExternalLink
              size={11}
              aria-label="opens the publisher's page"
              className="shrink-0 translate-y-[1px] text-subtle group-hover:text-accent"
            />
          </a>
          <p className="mt-0.5 text-[11.5px] text-subtle">
            {src.publisher} · {src.vintage} · {src.license}
          </p>
        </div>
        <StatusTag status={src.status as Status} className="mt-0.5" />
      </div>

      {src.caveat && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          <span className="font-medium text-warn">Caveat. </span>
          {src.caveat}
        </p>
      )}
      {role && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{role}</p>
      )}

      {fields.length > 0 && (
        <FieldTable
          rows={fields}
          sourceStatus={src.status as Status}
          className="mt-2.5"
        />
      )}
    </li>
  );
}

/**
 * Field name and coverage, two columns wide. A field's status is shown only
 * when it differs from its source's, e.g. a modelled sum of verified blocks.
 */
function FieldTable({
  rows,
  sourceStatus,
  showStatus,
  className,
}: {
  rows: FieldRow[];
  sourceStatus?: Status;
  showStatus?: boolean;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-8",
        rows.length > 1 && "sm:grid-cols-2",
        className,
      )}
    >
      {rows.map((f) => {
        const conditional = CONDITIONAL_FIELD[f.field];
        const tagged =
          showStatus || (sourceStatus && f.status !== sourceStatus);
        return (
          <div
            key={f.field}
            className={cn(
              "flex items-baseline justify-between gap-3 border-t border-line/60 py-1.5 first:border-t-0",
              rows.length > 1 && "sm:[&:nth-child(2)]:border-t-0",
            )}
          >
            <dt className="min-w-0">
              <span className="text-[12px] text-fg/90" title={f.field}>
                {fieldLabel(f.field)}
              </span>
              {tagged && <StatusTag status={f.status} className="ml-2" />}
              {conditional && (
                <span className="block text-[11px] text-subtle">
                  {conditional}
                </span>
              )}
            </dt>
            <dd
              className={cn(
                "num shrink-0 text-[12px]",
                f.coverage === 0
                  ? "text-unknown"
                  : f.coverage < 0.9 && !conditional
                    ? "text-warn"
                    : "text-muted",
              )}
              title="Share of grid cells with a value"
            >
              {f.coverage === 0 ? NOT_AVAILABLE : fmtPercent(f.coverage)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function EconomicTable({
  measured,
  scenario,
}: {
  measured: MeasuredInput[];
  scenario: MeasuredInput[];
}) {
  const rows = [...measured, ...scenario];
  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      <table className="w-full border-collapse text-left">
        <thead className="bg-raised/50">
          <tr>
            <th scope="col" className="eyebrow w-[46%] px-4 py-2 font-semibold">
              Input
            </th>
            <th
              scope="col"
              className="eyebrow px-3 py-2 text-right font-semibold"
            >
              Value
            </th>
            <th scope="col" className="eyebrow w-[26%] px-3 py-2 font-semibold">
              Basis
            </th>
            <th
              scope="col"
              className="eyebrow px-4 py-2 text-right font-semibold"
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.label} className="border-t border-line align-top">
              <th scope="row" className="px-4 py-2.5 font-normal">
                <span className="text-[12.5px] text-fg">{a.label}</span>
                {a.caveat && (
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-subtle">
                    {a.caveat}
                  </span>
                )}
              </th>
              <td className="num whitespace-nowrap px-3 py-2.5 text-right text-[12.5px] text-fg">
                {fmtNumber(a.value)}
                <span className="mt-0.5 block font-sans text-[11px] text-subtle">
                  {a.unit}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[11.5px] text-muted">
                {a.source_url ? (
                  <a
                    href={a.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-baseline gap-1 hover:text-accent"
                  >
                    {a.source}
                    <ExternalLink
                      size={10}
                      aria-hidden
                      className="shrink-0 text-subtle"
                    />
                  </a>
                ) : (
                  a.source
                )}
                {a.period && (
                  <span className="block text-subtle">{a.period}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right">
                <StatusTag status={a.status as Status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
