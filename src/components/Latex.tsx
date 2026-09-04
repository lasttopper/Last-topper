import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders Markdown formatting (headings, lists, bold, italic, code, dividers)
 * along with $...$ (inline) and $$...$$ (display) KaTeX math equations.
 */
export function Latex({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => renderMarkdownAndMath(children ?? ""), [children]);
  return (
    <div
      className={`text-sm leading-relaxed text-foreground space-y-2 ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdownAndMath(input: string): string {
  if (!input) return "";

  // Step 1: Extract Math ($$...$$ and $...$) into placeholder tokens with NO underscores
  const mathPlaceholders: string[] = [];
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

  const textWithMathPlaceholders = input.replace(mathRegex, (match) => {
    const isDisplay = match.startsWith("$$");
    const tex = isDisplay ? match.slice(2, -2) : match.slice(1, -1);
    const token = `@@MATHTOKEN${mathPlaceholders.length}@@`;

    try {
      const rendered = katex.renderToString(tex.trim(), {
        displayMode: isDisplay,
        throwOnError: false,
        output: "html",
      });
      mathPlaceholders.push(
        isDisplay
          ? `<div class="my-2.5 overflow-x-auto rounded-xl bg-primary/10 p-3 text-center border border-primary/20 shadow-xs">${rendered}</div>`
          : `<span class="inline-block px-1 font-mono">${rendered}</span>`
      );
    } catch {
      mathPlaceholders.push(escapeHtml(match));
    }
    return token;
  });

  // Step 2: Line-by-line Markdown parsing
  const lines = textWithMathPlaceholders.split("\n");
  const htmlLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;

  const closeLists = () => {
    if (inUnorderedList) {
      htmlLines.push("</ul>");
      inUnorderedList = false;
    }
    if (inOrderedList) {
      htmlLines.push("</ol>");
      inOrderedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    // Horizontal Rule
    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      closeLists();
      htmlLines.push('<hr class="my-3 border-t border-border/70" />');
      continue;
    }

    // Headings
    if (/^#{1,6}\s+/.test(trimmed)) {
      closeLists();
      const level = trimmed.match(/^(#{1,6})/)?.[0].length ?? 3;
      const titleText = trimmed.replace(/^#{1,6}\s+/, "");
      const formattedTitle = formatInlineMarkdown(titleText);

      if (level === 1) {
        htmlLines.push(`<h1 class="text-base font-extrabold tracking-tight text-foreground mt-3 mb-1.5">${formattedTitle}</h1>`);
      } else if (level === 2) {
        htmlLines.push(`<h2 class="text-sm font-bold tracking-tight text-foreground mt-2.5 mb-1">${formattedTitle}</h2>`);
      } else if (level === 3) {
        htmlLines.push(`<h3 class="text-xs font-bold uppercase tracking-wider text-primary mt-2 mb-1 border-b border-primary/20 pb-0.5">${formattedTitle}</h3>`);
      } else {
        htmlLines.push(`<h4 class="text-xs font-semibold text-indigo-400 mt-1.5 mb-0.5">${formattedTitle}</h4>`);
      }
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      closeLists();
      const quoteText = formatInlineMarkdown(trimmed.slice(2));
      htmlLines.push(`<blockquote class="my-2 rounded-r-lg border-l-3 border-primary bg-primary/10 px-3 py-2 text-xs italic text-foreground">${quoteText}</blockquote>`);
      continue;
    }

    // Unordered List
    if (/^[-*+]\s+/.test(trimmed)) {
      if (inOrderedList) closeLists();
      if (!inUnorderedList) {
        htmlLines.push('<ul class="my-1.5 space-y-1 pl-4 list-disc text-foreground">');
        inUnorderedList = true;
      }
      const itemText = formatInlineMarkdown(trimmed.replace(/^[-*+]\s+/, ""));
      htmlLines.push(`<li>${itemText}</li>`);
      continue;
    }

    // Ordered List
    if (/^\d+\.\s+/.test(trimmed)) {
      if (inUnorderedList) closeLists();
      if (!inOrderedList) {
        htmlLines.push('<ol class="my-1.5 space-y-1 pl-4 list-decimal text-foreground">');
        inOrderedList = true;
      }
      const itemText = formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""));
      htmlLines.push(`<li>${itemText}</li>`);
      continue;
    }

    // Regular Paragraph Line
    closeLists();
    const formattedLine = formatInlineMarkdown(line);
    htmlLines.push(`<p class="mb-1.5 last:mb-0 leading-relaxed">${formattedLine}</p>`);
  }

  closeLists();

  let finalHtml = htmlLines.join("\n");

  // Step 3: Restore Math Tokens safely
  for (let i = 0; i < mathPlaceholders.length; i++) {
    const token = `@@MATHTOKEN${i}@@`;
    finalHtml = finalHtml.split(token).join(mathPlaceholders[i]);
  }

  return finalHtml;
}

function formatInlineMarkdown(text: string): string {
  let s = escapeHtml(text);

  // Bold (**text** or __text__)
  s = s.replace(/(\*\*|__)(.*?)\1/g, '<strong class="font-bold text-foreground">$2</strong>');

  // Italic (*text* or _text_)
  s = s.replace(/(\*|_)(.*?)\1/g, '<em class="italic text-foreground/90">$2</em>');

  // Inline code (`code`)
  s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">$1</code>');

  return s;
}

/**
 * Normalizes an AI/legacy formula string into "label" + LaTeX math.
 */
export function parseFormula(raw: string): { label: string | null; tex: string } {
  const text = String(raw ?? "").trim();
  const m = text.match(/^([^$:]{1,60}):\s*(.+)$/s);
  const label = m ? m[1].trim() : null;
  let body = (m ? m[2] : text).trim();

  if (!/\$/.test(body)) {
    body = body
      .replace(/->|→/g, "\\rightarrow ")
      .replace(/<=>|⇌/g, "\\rightleftharpoons ")
      .replace(/\bdelta\b/gi, "\\Delta ")
      .replace(/×/g, "\\times ")
      .replace(/·/g, "\\cdot ");
    body = `$${body}$`;
  }
  return { label, tex: body };
}

/** Renders one formula as a labelled, centered display equation. */
export function Formula({ children }: { children: string }) {
  const { label, tex } = parseFormula(children ?? "");
  return (
    <div className="space-y-1">
      {label && (
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      )}
      <Latex className="block overflow-x-auto text-[15px] leading-relaxed text-foreground">{tex}</Latex>
    </div>
  );
}
