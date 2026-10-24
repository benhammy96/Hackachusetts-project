"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, Loader2, RefreshCw, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { useAtlas } from "./atlas-provider";
import { Button } from "./ui/primitives";
import { LANGUAGES, type Audience, type LangCode } from "@/lib/brief";
import { Markdown } from "./markdown";

export function BriefPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { selected, mw, cooling, lens } = useAtlas();
  const [lang, setLang] = React.useState<LangCode>("en");
  const [audience, setAudience] = React.useState<Audience>("community");
  const [text, setText] = React.useState("");
  const [source, setSource] = React.useState<
    "bedrock" | "offline" | "cache" | null
  >(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const abort = React.useRef<AbortController | null>(null);

  /**
   * Last resort if the API route itself is unreachable: the pre-rendered briefs
   * for the calibration sites, shipped as a static file (ATLAS.md 6.3).
   */
  const loadFromCache = React.useCallback(
    async (h3: string): Promise<boolean> => {
      try {
        const res = await fetch("/data/briefs-cache.json");
        if (!res.ok) return false;
        const cache = (await res.json()) as {
          settings: { mw: number; cooling: string; lens: string };
          briefs: Record<string, string>;
        };
        const hit = cache.briefs[`${h3}|${lang}|${audience}`];
        if (!hit) return false;
        setText(hit);
        setSource("cache");
        const s = cache.settings;
        if (s.mw !== mw || s.cooling !== cooling || s.lens !== lens) {
          setNotice(
            `Showing a cached brief written for ${s.mw} MW, ${s.cooling.replace("_", " ")}, ` +
              `${s.lens} lens. It does not reflect your current settings.`,
          );
        }
        return true;
      } catch {
        return false;
      }
    },
    [lang, audience, mw, cooling, lens],
  );

  const generate = React.useCallback(async () => {
    if (!selected) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setText("");
    setSource(null);
    setNotice(null);
    setStreaming(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          h3: selected.h3,
          mw,
          cooling,
          lens,
          lang,
          audience,
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `${res.status} ${res.statusText}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const ev = /^event: (.+)$/m.exec(frame)?.[1];
          const raw = /^data: (.*)$/m.exec(frame)?.[1];
          if (!ev || raw === undefined) continue;
          let data: unknown;
          try {
            data = JSON.parse(raw);
          } catch {
            continue;
          }
          if (ev === "delta" && typeof data === "string") {
            setText((t) => t + data);
          } else if (ev === "meta") {
            setSource((data as { source: "bedrock" | "offline" }).source);
          } else if (ev === "notice") {
            setNotice((data as { message: string }).message);
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const served = await loadFromCache(selected.h3);
      if (!served) {
        toast.error("Could not generate the brief", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    } finally {
      setStreaming(false);
    }
  }, [selected, mw, cooling, lens, lang, audience, loadFromCache]);

  React.useEffect(() => {
    if (open) void generate();
    else abort.current?.abort();
  }, [open, generate]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l border-line bg-panel shadow-2xl outline-none"
          aria-describedby="brief-desc"
        >
          <div className="shrink-0 border-b border-line px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="text-[14px] font-semibold text-fg">
                  {audience === "developer"
                    ? "Developer screening report"
                    : "Town-meeting brief"}
                </Dialog.Title>
                <p id="brief-desc" className="mt-0.5 text-[11px] text-subtle">
                  Every figure comes from the score engine. The writer cannot
                  add numbers of its own.
                </p>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 px-0"
                  aria-label="Close"
                >
                  <X size={14} aria-hidden />
                </Button>
              </Dialog.Close>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              {(["community", "developer"] as Audience[]).map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  aria-pressed={audience === a}
                  className={`rounded-full border px-2.5 py-[3px] text-[11px] transition-colors ${
                    audience === a
                      ? "border-accent/60 bg-accent-muted text-accent"
                      : "border-line bg-raised/50 text-muted hover:border-subtle"
                  }`}
                >
                  {a === "community" ? "For residents" : "For developers"}
                </button>
              ))}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  aria-pressed={lang === l.code}
                  lang={l.code}
                  title={l.label}
                  className={`rounded-full border px-2.5 py-[3px] text-[11px] transition-colors ${
                    lang === l.code
                      ? "border-accent/60 bg-accent-muted text-accent"
                      : "border-line bg-raised/50 text-muted hover:border-subtle"
                  }`}
                >
                  {l.endonym}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {notice && (
              <p className="mb-2 rounded-[6px] border border-warn/35 bg-warn/5 px-2.5 py-1.5 text-[11px] text-warn">
                {notice}
              </p>
            )}
            {streaming && text.length === 0 && (
              <p className="flex items-center gap-2 text-[12px] text-muted">
                <Loader2 size={13} className="animate-spin" aria-hidden />
                Reading the score card and the order…
              </p>
            )}
            <Markdown source={text} />
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-2.5">
            {source === "cache" && (
              <span className="flex items-center gap-1.5 text-[10.5px] text-warn">
                <WifiOff size={11} aria-hidden />
                Offline — pre-rendered cache
              </span>
            )}
            {source === "bedrock" && (
              <span className="text-[10.5px] text-subtle">
                Written by Claude on Bedrock
              </span>
            )}
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(text);
                  toast.success("Brief copied");
                }}
                disabled={!text}
              >
                <Copy size={12} aria-hidden />
                Copy
              </Button>
              <Button
                size="sm"
                onClick={() => void generate()}
                disabled={streaming}
              >
                <RefreshCw
                  size={12}
                  aria-hidden
                  className={streaming ? "animate-spin" : ""}
                />
                Regenerate
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
