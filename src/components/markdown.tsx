"use client";
/**
 * Markdown — a small, dependency-free renderer for the answer panels.
 *
 * We deliberately avoid a full markdown library: the model + retrieval output
 * is a known, narrow subset (headings, bold/italic, inline code, links, bullet
 * and numbered lists, GitHub-style tables, block dividers). A focused renderer
 * keeps the bundle lean, keeps the repo "own code", and lets us theme every
 * element to match the console (dark, indigo accents) instead of fighting a
 * library's defaults.
 *
 * Security: we never use dangerouslySetInnerHTML. Every token becomes a React
 * element, so retrieved/third-party document text cannot inject markup.
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ---------- inline: **bold**, *italic*, `code`, [text](url) ---------- */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: links first (they contain other chars), then code, bold, italic.
  const pattern =
    /(\[[^\]]+\]\([^)]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("[")) {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (lm) {
        nodes.push(
          <a
            key={key}
            href={lm[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:decoration-indigo-400 break-words"
          >
            {lm[1]}
          </a>
        );
      }
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[0.85em] font-mono text-amber-200/90"
        >
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <em key={key} className="italic text-zinc-300">
          {tok.slice(1, -1)}
        </em>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ---------- GitHub table: | a | b | with a |---|---| separator row ---------- */
function isTableSep(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

export function Markdown({
  content,
  className,
  accent = "zinc",
}: {
  content: string;
  className?: string;
  accent?: "zinc" | "indigo";
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const headingColor = accent === "indigo" ? "text-indigo-100" : "text-zinc-100";

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block ```lang ... ```
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/40 p-3 text-xs font-mono leading-relaxed text-zinc-300"
        >
          {buf.join("\n")}
        </pre>
      );
      continue;
    }

    // Table: current line has pipes and next line is a separator
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-white/[0.04]">
                {header.map((h, hi) => (
                  <th
                    key={hi}
                    className="border-b border-white/[0.08] px-3 py-2 text-left font-semibold text-zinc-200"
                  >
                    {renderInline(h, `th-${key}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="odd:bg-white/[0.01]">
                  {r.map((c, ci) => (
                    <td
                      key={ci}
                      className="border-b border-white/[0.04] px-3 py-1.5 align-top text-zinc-400"
                    >
                      {renderInline(c, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings ###### -> #
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const sizes = ["text-lg", "text-base", "text-sm", "text-sm", "text-xs", "text-xs"];
      blocks.push(
        <div
          key={key++}
          className={cn(
            "font-semibold mt-3 mb-1 first:mt-0",
            sizes[level - 1],
            headingColor
          )}
        >
          {renderInline(h[2], `h-${key}`)}
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-3 border-white/[0.08]" />);
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1.5 space-y-1 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 leading-relaxed">
              <span className={cn("mt-[0.5em] h-1 w-1 shrink-0 rounded-full", accent === "indigo" ? "bg-indigo-400/70" : "bg-zinc-500")} />
              <span>{renderInline(it, `li-${key}-${ii}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-1.5 space-y-1 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 leading-relaxed">
              <span className={cn("shrink-0 tabular-nums", accent === "indigo" ? "text-indigo-400/80" : "text-zinc-500")}>{ii + 1}.</span>
              <span>{renderInline(it, `ol-${key}-${ii}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line -> spacer
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (gather consecutive non-empty, non-special lines)
    const para: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed first:mt-0">
        {renderInline(para.join(" "), `p-${key}`)}
      </p>
    );
  }

  return <div className={cn("text-sm", className)}>{blocks}</div>;
}
