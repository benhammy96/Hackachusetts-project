"use client";

import * as React from "react";

/**
 * A deliberately small markdown renderer for brief text: headings, lists,
 * paragraphs, rules, bold, italic, inline code and links.
 *
 * It builds React elements rather than HTML strings, so model or template
 * output can never inject markup.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = React.useMemo(() => parse(source), [source]);
  if (!source.trim()) return null;
  return <div className="space-y-2.5">{blocks}</div>;
}

function parse(src: string): React.ReactNode[] {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    out.push(
      <p key={key++} className="text-[12.5px] leading-relaxed text-muted">
        {inline(para.join(" "))}
      </p>,
    );
    para = [];
  };

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag
        key={key++}
        className={`space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-muted ${
          list.ordered ? "list-decimal" : "list-disc"
        }`}
      >
        {list.items.map((item, i) => (
          <li key={i} className="pl-0.5 marker:text-subtle">
            {inline(item)}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushAll();
      out.push(<hr key={key++} className="border-t border-line" />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = inline(heading[2]);
      if (level <= 1) {
        out.push(
          <h2 key={key++} className="text-[15px] font-semibold text-fg">
            {text}
          </h2>,
        );
      } else if (level === 2) {
        out.push(
          <h3 key={key++} className="mt-1 text-[13px] font-semibold text-fg">
            {text}
          </h3>,
        );
      } else {
        out.push(
          <h4 key={key++} className="eyebrow mt-1">
            {text}
          </h4>,
        );
      }
      continue;
    }

    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (!list?.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[2]);
      continue;
    }

    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }

    if (list) {
      // A wrapped continuation line inside a list item.
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    para.push(line.trim());
  }

  flushAll();
  return out;
}

const TOKEN = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string): React.ReactNode[] {
  const parts = text.split(TOKEN).filter((p) => p !== undefined && p !== "");
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) {
      return (
        <em key={i} className="text-subtle">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code
          key={i}
          className="num rounded-[3px] border border-line bg-raised px-1 py-px text-[11px] text-muted"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = link[2];
      const safe = /^https?:\/\//i.test(href);
      if (!safe) return <span key={i}>{link[1]}</span>;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          {link[1]}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
