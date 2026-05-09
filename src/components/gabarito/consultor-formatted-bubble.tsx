"use client";

import { Fragment, useMemo, type ReactNode } from "react";

function citeToAnchor(cite: string): string {
  const t = cite.replace(/\s+/g, " ").trim();
  if (/Art\.\s*35\s*-\s*A/i.test(t)) return "art-35a";
  if (/Art\.\s*41/i.test(t)) return "art-41";
  const m = t.match(/Art\.\s*(\d+)/i);
  if (m) return `art-${m[1]}`;
  return "art-20";
}

function renderArticlesInPlainText(
  text: string,
  keyPrefix: string,
  onArticleNavigate: (anchor: string) => void,
): ReactNode {
  const re = /\b(Art\.\s*\d+(?:-[A-Za-z]+)?(?:,\s*[IVXLCDM]+)?)\b/gi;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  const r = new RegExp(re.source, re.flags);
  while ((m = r.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const cite = m[1];
    const anchor = citeToAnchor(cite);
    parts.push(
      <button
        key={`${keyPrefix}-art-${idx++}`}
        type="button"
        onClick={() => onArticleNavigate(anchor)}
        className="mx-0.5 inline-flex max-w-full items-center break-words rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 align-baseline text-xs font-bold text-emerald-950 underline decoration-emerald-500 decoration-2 underline-offset-2 transition hover:border-emerald-300 hover:bg-emerald-100"
      >
        {cite}
      </button>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts.length > 0 ? parts : text;
}

function renderWithBoldAndArticles(
  text: string,
  onArticleNavigate: (anchor: string) => void,
): ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      const inner = seg.slice(2, -2);
      return (
        <strong key={`b-${i}`} className="font-semibold text-slate-900">
          {renderArticlesInPlainText(inner, `b-${i}`, onArticleNavigate)}
        </strong>
      );
    }
    return <Fragment key={`t-${i}`}>{renderArticlesInPlainText(seg, `t-${i}`, onArticleNavigate)}</Fragment>;
  });
}

export function ConsultorFormattedBubble({
  content,
  onArticleNavigate,
}: {
  content: string;
  onArticleNavigate: (anchor: string) => void;
}) {
  const body = useMemo(
    () => renderWithBoldAndArticles(content, onArticleNavigate),
    [content, onArticleNavigate],
  );
  return <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{body}</div>;
}
