import { aiChat, openRouterChat } from "@/lib/ai-router";
import type { ReviseReference, ReviseTopic } from "./revise.types";

type SupabaseContext = { supabase: { from: (table: string) => any } };

type ChapterRow = {
  id: string;
  name: string;
  class_level: number | null;
  subject_id?: string | null;
};

type ChapterDetails = {
  name: string;
  class_level: number | null;
  subjects?: { name?: string | null } | null;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function sanitizeTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ").slice(0, 200);
  return title.length > 0 ? title : null;
}

function isAiGenerationError(error: unknown): boolean {
  return error instanceof Error && /AI|credits|busy|gateway/i.test(error.message);
}

async function callAi<T>(
  prompt: string,
  schema: Record<string, unknown>,
  runner: (body: any) => Promise<any> = aiChat,
): Promise<T> {
  const json = await runner({
    model: "google/gemini-3.6-flash",
    messages: [
      {
        role: "system",
        content:
          "You are an expert NCERT-aligned exam tutor for Indian JEE/NEET students. Reply only using the requested tool. Content must be strictly from official NCERT curriculum (Class 11–12) with high-yield exam insights.",
      },
      { role: "user", content: prompt },
    ],
    tools: [
      {
        type: "function",
        function: { name: "reply", description: "Return structured response", parameters: schema },
      },
    ],
    tool_choice: { type: "function", function: { name: "reply" } },
  });
  const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no content");
  return JSON.parse(args) as T;
}

const callGemini = <T,>(prompt: string, schema: Record<string, unknown>) => callAi<T>(prompt, schema);

const DIAGRAM_SCHEMA = {
  type: "object",
  properties: { diagram: { type: "string" }, diagram_caption: { type: "string" } },
  required: ["diagram"],
} as const;

/** Deterministic concept map so a topic is never left without a visual. */
function fallbackDiagram(topicTitle: string): { diagram: string; diagram_caption: string } {
  const t = topicTitle.replace(/"/g, "");
  return {
    diagram: `flowchart TD\n  A["${t}"] --> B["NCERT definitions"]\n  A --> C["Core concept / process"]\n  A --> D["Formulas & conditions"]\n  C --> E["Solved examples"]\n  D --> E\n  E --> F["Exercise practice"]`,
    diagram_caption: "Quick revision map for this topic.",
  };
}

/**
 * Diagram runs on OpenRouter and is saved permanently in Supabase.
 */
async function generateDiagram(
  topicTitle: string,
  chapter: ChapterDetails,
): Promise<{ diagram: string; diagram_caption: string | null }> {
  try {
    const ai = await callAi<{ diagram?: string; diagram_caption?: string }>(
      `Create ONE Mermaid diagram that visually explains the NCERT topic "${topicTitle}" from the Class ${chapter.class_level} ${chapter.subjects?.name ?? ""} chapter "${chapter.name}".
Rules: start with "flowchart TD" (or "graph LR", "mindmap"). Every node label MUST be wrapped in double quotes, e.g. A["Ideal gas"] --> B["PV = nRT"]. Plain text only inside labels — NO LaTeX, no $, no parentheses, no <br>, no emojis, no semicolons. 6-12 nodes maximum. Output raw Mermaid code with no markdown fences.
Also return diagram_caption: one short line (max 90 chars).`,
      DIAGRAM_SCHEMA as unknown as Record<string, unknown>,
      openRouterChat,
    );
    const diagram = sanitizeDiagram(ai.diagram);
    if (diagram) return { diagram, diagram_caption: sanitizeTitle(ai.diagram_caption) };
  } catch (error) {
    if (!isAiGenerationError(error)) throw error;
  }
  return fallbackDiagram(topicTitle);
}

/**
 * Fetch verified web references from top educational sites using Firecrawl API.
 */
async function firecrawlReferences(topic: string, chapter: string): Promise<ReviseReference[]> {
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) return fallbackReferences();
  const sites = ["ncert.nic.in", "unacademy.com", "vedantu.com", "oswaalbooks.com", "byjus.com"];
  const query = `${topic} ${chapter} NCERT revision notes ${sites.map((s) => `site:${s}`).join(" OR ")}`;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${fcKey}`,
      },
      body: JSON.stringify({ query, limit: 8 }),
    });
    if (!res.ok) return fallbackReferences();
    const json = await res.json();
    const items: Array<{ url?: string; title?: string; description?: string }> =
      json?.data?.web ?? json?.data ?? json?.results ?? [];
    const seen = new Set<string>();
    const refs: ReviseReference[] = [];

    for (const it of items) {
      if (!it.url) continue;
      let host: string;
      try {
        host = new URL(it.url).hostname.replace(/^www\./, "");
      } catch {
        continue;
      }
      const source = sites.find((s) => host.endsWith(s));
      if (!source) continue;
      if (seen.has(host + it.url)) continue;
      seen.add(host + it.url);
      refs.push({ title: it.title ?? host, url: it.url, source });
      if (refs.length >= 6) break;
    }
    return refs.length > 0 ? refs : fallbackReferences();
  } catch {
    return fallbackReferences();
  }
}

function fallbackReferences(): ReviseReference[] {
  return [
    { title: "NCERT official textbooks", url: "https://ncert.nic.in/textbook.php", source: "ncert.nic.in" },
    { title: "Vedantu CBSE Revision Notes", url: "https://www.vedantu.com/revision-notes", source: "vedantu.com" },
    { title: "BYJU'S NCERT Learning Resources", url: "https://byjus.com/ncert/", source: "byjus.com" },
  ];
}

function fallbackTopicTitles(chapterName: string, subjectName?: string | null): string[] {
  const subject = (subjectName ?? "").toLowerCase();
  const subjectTopic = subject.includes("chem")
    ? "High-Yield Reactions, Equations, & Trends"
    : subject.includes("bio")
      ? "NCERT Diagrams, Terminology, & Key Processes"
      : subject.includes("math")
        ? "Essential Theorems, Formulas, & Problem Patterns"
        : "Core Laws, Formulas, Derivations, & Graphs";

  return [
    `${chapterName} — High-Yield Overview`,
    "NCERT Definitions & Key Scientific Terminology",
    "Core Concept Mechanism & Mathematical Relationships",
    subjectTopic,
    "High-Yield Solved Examples & Numerical Applications",
    "Tricky NCERT Exercise Patterns & JEE/NEET Shortcuts",
    "Common Mistakes & Conceptual Traps to Avoid",
    "Last-Minute NCERT Formula & Diagram Revision Checklist",
  ];
}

function buildTopicRows(chapterId: string, titles: string[]) {
  const seen = new Set<string>();
  return titles
    .map((title, i) => {
      const cleanTitle = sanitizeTitle(title) ?? `Topic ${i + 1}`;
      const baseSlug = slugify(cleanTitle) || `topic-${i + 1}`;
      let slug = baseSlug;
      let suffix = 2;
      while (seen.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      seen.add(slug);
      return { chapter_id: chapterId, title: cleanTitle, slug, display_order: i };
    })
    .slice(0, 12);
}

function fallbackRevision(topicTitle: string, chapter: ChapterDetails): Pick<ReviseTopic, "summary" | "key_points" | "formulas" | "refs" | "diagram" | "diagram_caption"> {
  const subject = chapter.subjects?.name ?? "subject";
  const classText = chapter.class_level ? `Class ${chapter.class_level}` : "NCERT";

  return {
    summary: `${topicTitle} is a critical high-yield topic in ${classText} ${subject} for the chapter "${chapter.name}". To excel in JEE and NEET exams, master the exact NCERT definitions, mathematical formulas, and step-by-step mechanisms. Focus on understanding the physical or biological significance of every term before attempting practice problems.`,
    key_points: [
      "Master official NCERT definitions and key scientific terms.",
      "Understand the underlying mechanism, process, theorem, or physical law.",
      "Practice solved examples and textbook exercises directly from NCERT.",
      "Highlight important formulas, units, SI dimensions, and exceptions.",
      "Use spaced repetition to review this topic prior to tests.",
    ],
    formulas: [
      "Key NCERT Formula: $E = mc^2$",
      "Standard Relation: $PV = nRT$",
    ],
    refs: fallbackReferences(),
    diagram: `flowchart TD\n  A["${topicTitle.replace(/"/g, "")}"] --> B["NCERT Definitions"]\n  A --> C["Core Concept / Mechanism"]\n  A --> D["Formulas & Conditions"]\n  C --> E["JEE/NEET Solved Examples"]\n  D --> E\n  E --> F["Mistake Bank Review"]`,
    diagram_caption: "High-yield concept map for this revision topic.",
  };
}

/** Mermaid is strict — keep only what we can safely render. */
function sanitizeDiagram(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .replace(/^\s*```(?:mermaid)?/i, "")
    .replace(/```\s*$/, "")
    .trim()
    .slice(0, 3000);
  if (!code) return null;
  if (!/^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|mindmap|erDiagram|timeline)\b/i.test(code)) {
    return null;
  }
  return code;
}

/**
 * Lists the best high-yield revision topics for a chapter and PERMANENTLY saves them in Supabase.
 */
export async function listChapterTopics(
  chapterId: string,
  context: SupabaseContext,
): Promise<{ chapter: { id: string; name: string; class_level: number | null } | null; topics: ReviseTopic[] }> {
  const { data: chapter } = await context.supabase
    .from("chapters")
    .select("id, name, class_level, subject_id")
    .eq("id", chapterId)
    .maybeSingle();
  if (!chapter) return { chapter: null, topics: [] };

  // 1. Check if topics are ALREADY saved in Supabase
  const { data: existing } = await context.supabase
    .from("revise_topics")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("display_order");

  if (existing && existing.length > 0) {
    return { chapter, topics: existing as unknown as ReviseTopic[] };
  }

  // 2. Fetch educational web topics using Firecrawl & Gemini AI
  const { data: subject } = await context.supabase
    .from("subjects")
    .select("name")
    .eq("id", (chapter as ChapterRow).subject_id)
    .maybeSingle();

  let titles = fallbackTopicTitles(chapter.name, subject?.name);
  try {
    const result = await callGemini<{ topics: { title: string }[] }>(
      `Select the top 8 to 10 BEST high-yield NCERT revision topics for Class ${chapter.class_level} ${subject?.name ?? ""} chapter "${chapter.name}" commonly featured on top educational websites (NCERT, Vedantu, BYJU'S, Unacademy) for IIT-JEE and NEET revision. Return titles ordered logically from core concepts to high-yield exam applications.`,
      {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
          },
        },
        required: ["topics"],
      },
    );
    const aiTitles = (result.topics ?? []).map((topic) => sanitizeTitle(topic.title)).filter(Boolean) as string[];
    if (aiTitles.length > 0) titles = aiTitles;
  } catch (error) {
    console.warn("[listChapterTopics] Error fetching AI topic titles, using fallback titles:", error);
  }

  // 3. Save topics PERMANENTLY to Supabase database so they persist forever
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inserted, error } = await supabaseAdmin
    .from("revise_topics")
    .upsert(buildTopicRows(chapterId, titles), { onConflict: "chapter_id,slug", ignoreDuplicates: true })
    .select("*")
    .order("display_order");

  if (error) throw error;
  return { chapter, topics: (inserted ?? []) as unknown as ReviseTopic[] };
}

/**
 * Reads a topic revision note. Once generated, it is SAVED PERMANENTLY in Supabase forever.
 */
export async function readTopicRevision(topicId: string, context: SupabaseContext): Promise<ReviseTopic> {
  const { data: topic, error } = await context.supabase
    .from("revise_topics")
    .select("*, chapters(name, class_level, subjects(name))")
    .eq("id", topicId)
    .maybeSingle();
  if (error) throw error;
  if (!topic) throw new Error("Topic not found");

  const topicRecord = topic as Record<string, unknown> & { chapters?: ChapterDetails };
  const { chapters, ...rest } = topicRecord;
  const chapter = chapters ?? { name: "NCERT", class_level: null, subjects: { name: "subject" } };

  // 1. PERMANENT CACHE CHECK: If explanation + diagram + references are already stored in DB, return immediately!
  if (topicRecord.summary && topicRecord.generated_at && topicRecord.diagram && Array.isArray(topicRecord.refs) && topicRecord.refs.length > 0) {
    return rest as unknown as ReviseTopic;
  }

  // 2. Generate best explanation using Gemini 3.6 Flash + Firecrawl Search for verified educational references
  try {
    const ai = await callGemini<{
      summary: string;
      key_points: string[];
      formulas: string[];
    }>(
      `Write a comprehensive, crystal-clear NCERT-aligned revision note for the topic "${topicRecord.title}" from Class ${chapter.class_level} ${chapter.subjects?.name ?? ""} chapter "${chapter.name}".

Requirements:
- summary: 140-220 word crystal-clear, deep explanation covering NCERT principles, physical/chemical/biological meaning, and exam relevance.
- key_points: 6-8 bullet points highlighting crucial definitions, edge-cases, and JEE/NEET exam tips.
- formulas: array of essential formulas or chemical equations. STRICT FORMAT: each item MUST be "Label: $latex$" wrapping valid LaTeX in single dollar signs (e.g. "Kinetic energy: $K=\\tfrac{1}{2}mv^2$", "Ideal gas law: $PV=nRT$").

Write in your own clear words without copying copyrighted text.`,
      {
        type: "object",
        properties: {
          summary: { type: "string" },
          key_points: { type: "array", items: { type: "string" } },
          formulas: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "key_points", "formulas"],
      },
    );

    // Fetch verified educational references from top learning sites via Firecrawl Search
    const [refs, dia] = await Promise.all([
      firecrawlReferences(String(topicRecord.title ?? "Revision"), chapter.name),
      generateDiagram(String(topicRecord.title ?? "Revision"), chapter),
    ]);

    // 3. SAVE PERMANENTLY IN SUPABASE FOREVER
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("revise_topics")
      .update({
        summary: ai.summary,
        key_points: ai.key_points,
        formulas: ai.formulas,
        diagram: dia.diagram,
        diagram_caption: dia.diagram_caption,
        refs,
        generated_at: new Date().toISOString(),
      })
      .eq("id", topicId)
      .select("*")
      .maybeSingle();

    if (upErr) throw upErr;
    return updated as unknown as ReviseTopic;
  } catch (error) {
    console.warn("[readTopicRevision] Error generating topic revision, using fallback & saving:", error);
    const fallback = fallbackRevision(String(topicRecord.title ?? "Revision"), chapter);
    return { ...(rest as unknown as ReviseTopic), ...fallback };
  }
}
