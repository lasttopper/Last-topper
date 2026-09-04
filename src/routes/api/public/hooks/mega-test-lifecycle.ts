import { createFileRoute } from "@tanstack/react-router";
import { aiChat } from "@/lib/ai-router";
import { puterGenerateQuestions } from "@/lib/puter";

type MegaQuestion = {
  id: string;
  chapter_id: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  hint: string;
  explanation: string;
};

async function callGeminiMega(count: number, batchIdx: number): Promise<MegaQuestion[]> {
  const prompt = `Generate exactly ${count} NCERT-only exam-style MCQ covering ONLY Physics and Chemistry (Class 11 & 12). Mix chapters and difficulty (30/40/30). Use LaTeX ($...$ / $$...$$). This is batch #${batchIdx + 1}; produce a fresh unique set. Return STRICT JSON: {"questions":[{"question":"...","options":{"A":"","B":"","C":"","D":""},"correct":"A|B|C|D","hint":"...","explanation":"..."}]}`;
  try {
    const data = await aiChat({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: "You are an NCERT-only exam question generator. Physics and Chemistry only. Output STRICT JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { questions?: Array<Omit<MegaQuestion, "id" | "chapter_id">> };
    return (parsed.questions ?? []).slice(0, count).map((q, i) => ({
      id: `mq_${Date.now()}_${batchIdx}_${i}`,
      chapter_id: "",
      question: q.question,
      options: q.options,
      correct: q.correct,
      hint: q.hint ?? "",
      explanation: q.explanation ?? "",
    }));
  } catch {
    try {
      const puterQs = await puterGenerateQuestions("pcm", ["Physics", "Chemistry"], count);
      return puterQs.map((q, i) => ({
        id: `mq_puter_${Date.now()}_${batchIdx}_${i}`,
        chapter_id: "",
        question: q.question,
        options: q.options,
        correct: q.correct,
        hint: q.hint ?? "",
        explanation: q.explanation ?? "",
      }));
    } catch {
      return [];
    }
  }
}

async function generateMegaQuestionSet(): Promise<MegaQuestion[]> {
  const parts = await Promise.all([callGeminiMega(60, 0), callGeminiMega(60, 1), callGeminiMega(60, 2)]);
  const all = parts.flat();
  if (all.length < 60) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("question_bank")
      .select("id, chapter_id, question, options, correct, hint, explanation")
      .limit(500);
    const pool = data ?? [];
    if (pool.length === 0) return all;
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 180 - all.length);
    return [
      ...all,
      ...picked.map((r, i) => ({
        id: `mq_bank_${Date.now()}_${i}`,
        chapter_id: (r.chapter_id as string) ?? "",
        question: r.question as string,
        options: r.options as MegaQuestion["options"],
        correct: r.correct as MegaQuestion["correct"],
        hint: (r.hint as string) ?? "",
        explanation: (r.explanation as string) ?? "",
      })),
    ];
  }
  return all.slice(0, 180);
}

/**
 * Called periodically by pg_cron to:
 *  - rank paid entries and credit Pro rewards
 *  - mark tests as completed
 * Auth: apikey header (Supabase publishable key).
 */
export const Route = createFileRoute("/api/public/hooks/mega-test-lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        const { data: tests } = await supabaseAdmin
          .from("mega_tests")
          .select("id, entry_fee, min_participants, status, scheduled_end")
          .lt("scheduled_end", now)
          .in("status", ["scheduled", "live"]);

        const results: Array<{ id: string; action: string }> = [];
        for (const t of tests ?? []) {
          const { data: entries } = await supabaseAdmin
            .from("mega_test_entries")
            .select("id, user_id, paid, refunded, score, correct_count")
            .eq("mega_test_id", t.id)
            .eq("paid", true);
          const paidEntries = entries ?? [];

          const ranked = paidEntries
            .filter((e) => e.score !== null && e.score !== undefined)
            .sort((a, b) => (b.score! - a.score!) || ((b.correct_count ?? 0) - (a.correct_count ?? 0)));

          for (let i = 0; i < ranked.length; i += 1) {
            const rank = i + 1;
            const e = ranked[i];
            await supabaseAdmin.from("mega_test_entries").update({ rank, prize: 0 }).eq("id", e.id);

            if (rank === 1 && paidEntries.length >= 50) {
              // Grant 1 week of Pro to the winner
              const { data: u2 } = await supabaseAdmin.from("users").select("pro_until").eq("id", e.user_id).maybeSingle();
              const base = u2?.pro_until && new Date(u2.pro_until) > new Date() ? new Date(u2.pro_until) : new Date();
              const until = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
              await supabaseAdmin.from("users").update({ is_pro: true, pro_since: new Date().toISOString(), pro_until: until.toISOString() }).eq("id", e.user_id);
            }
          }

          await supabaseAdmin.from("mega_tests").update({ status: "completed" }).eq("id", t.id);
          results.push({ id: t.id, action: "completed" });
        }

        const nowD = new Date();
        function nextSunday1000IST(from: Date): Date {
          for (let i = 0; i < 8; i += 1) {
            const c = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
            c.setUTCHours(4, 30, 0, 0);
            if (c.getUTCDay() === 0 && c.getTime() > from.getTime()) return c;
          }
          return from;
        }

        const isSunday = nowD.getUTCDay() === 0;
        const past2pmIST = nowD.getUTCHours() * 60 + nowD.getUTCMinutes() >= 8 * 60 + 30;
        const shouldProvision = !isSunday || past2pmIST;
        if (shouldProvision) {
          const start = nextSunday1000IST(nowD);
          const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
          for (const profession of ["pcm", "pcb"] as const) {
            const { data: existing } = await supabaseAdmin
              .from("mega_tests")
              .select("id")
              .eq("profession", profession)
              .eq("scheduled_start", start.toISOString())
              .maybeSingle();
            if (!existing) {
              await supabaseAdmin.from("mega_tests").insert({
                profession,
                scheduled_start: start.toISOString(),
                scheduled_end: end.toISOString(),
                status: "scheduled",
                entry_fee: 0,
                min_participants: 1,
                question_count: 180,
              });
              results.push({ id: `${profession}-${start.toISOString()}`, action: "provisioned" });
            }
          }

          const { data: rows } = await supabaseAdmin
            .from("mega_tests")
            .select("id, questions")
            .eq("scheduled_start", start.toISOString());
          const needsGen = (rows ?? []).some((r) => !r.questions || (r.questions as unknown[]).length === 0);
          const within24h = start.getTime() - nowD.getTime() <= 24 * 60 * 60 * 1000;
          if (needsGen && within24h) {
            const questions = await generateMegaQuestionSet();
            if (questions.length > 0) {
              for (const r of rows ?? []) {
                await supabaseAdmin.from("mega_tests")
                  .update({ questions: questions as unknown as never })
                  .eq("id", r.id);
              }
              results.push({ id: `mega-questions-${start.toISOString()}`, action: `generated-${questions.length}` });
            }
          }
        }

        return Response.json({ ok: true, results });
      },
    },
  },
});
