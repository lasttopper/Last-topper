import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelegramAlert } from "@/lib/telegram-alert";

async function assertAdmin(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin only");
}

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [authUsers, profileUsers, posts, doubts, reports, battles] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("forum_posts").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("doubts").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("post_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("battle_sessions").select("id", { count: "exact", head: true }).not("submitted_at", "is", null),
    ]);

    if (authUsers.error) throw authUsers.error;
    for (const result of [profileUsers, posts, doubts, reports, battles]) {
      if (result.error) throw result.error;
    }

    const authUserTotal = authUsers.data?.total;
    return {
      // Supabase Auth is the source of truth for real registered accounts.
      users: typeof authUserTotal === "number" ? authUserTotal : profileUsers.count ?? 0,
      profile_users: profileUsers.count ?? 0,
      posts: posts.count ?? 0,
      doubts: doubts.count ?? 0,
      pending_reports: reports.count ?? 0,
      completed_battles: battles.count ?? 0,
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("users")
      .select("id, email, full_name, phone, profession, is_banned, reputation, streak, created_at, is_pro, pro_until")
      .order("created_at", { ascending: false }).limit(100);
    if (data.q) q = q.or(`email.ilike.%${data.q}%,full_name.ilike.%${data.q}%,phone.ilike.%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const adminGrantPro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      plan: z.enum(["weekly", "monthly", "yearly", "revoke"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.plan === "revoke") {
      const { error } = await supabaseAdmin.from("users")
        .update({ is_pro: false, pro_until: null }).eq("id", data.user_id);
      if (error) throw error;
      return { ok: true };
    }
    const days = data.plan === "yearly" ? 365 : data.plan === "monthly" ? 30 : 7;
    const { data: u } = await supabaseAdmin
      .from("users").select("pro_until").eq("id", data.user_id).maybeSingle();
    const base = u?.pro_until && new Date(u.pro_until as string).getTime() > Date.now()
      ? new Date(u.pro_until as string).getTime()
      : Date.now();
    const until = new Date(base + days * 86400_000).toISOString();
    const { error } = await supabaseAdmin.from("users")
      .update({ is_pro: true, pro_since: new Date().toISOString(), pro_until: until })
      .eq("id", data.user_id);
    if (error) throw error;
    return { ok: true, pro_until: until };
  });

export const adminSetBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("users")
      .update({ is_banned: data.banned }).eq("id", data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("post_reports")
      .select("id, target_type, target_id, reason, message, status, created_at, reporter_id")
      .eq("status", "pending").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      report_id: z.string().uuid(),
      action: z.enum(["dismiss", "delete_content"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report, error } = await supabaseAdmin.from("post_reports")
      .select("target_type, target_id").eq("id", data.report_id).maybeSingle();
    if (error) throw error;
    if (!report) throw new Error("report not found");
    if (data.action === "delete_content") {
      const table = report.target_type === "forum_post" ? "forum_posts"
        : report.target_type === "forum_reply" ? "forum_replies"
        : report.target_type === "doubt" ? "doubts" : "doubt_replies";
      const { error: deleteError } = await (supabaseAdmin as any)
        .from(table)
        .delete()
        .eq("id", report.target_id);
      if (deleteError) throw deleteError;
    }
    const { error: updateError } = await supabaseAdmin.from("post_reports")
      .update({ status: data.action === "delete_content" ? "resolved" : "dismissed" })
      .eq("id", data.report_id);
    if (updateError) throw updateError;
    return { ok: true };
  });

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return [];
  });

export const adminSetWithdrawalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { ok: true };
  });

export const adminReportsChart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 14 * 86400e3).toISOString();
    const byDay: Record<string, number> = {};

    // Supabase Auth users are the source of truth for signup counts. The
    // public users table is a profile mirror and can be affected by RLS or
    // delayed profile creation, so don't use it for admin overview metrics.
    let page = 1;
    const perPage = 1000;
    for (;;) {
      const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      for (const user of pageData?.users ?? []) {
        const createdAt = user.created_at;
        if (!createdAt || createdAt < since) continue;
        const d = createdAt.slice(0, 10);
        byDay[d] = (byDay[d] ?? 0) + 1;
      }
      const nextPage = pageData?.nextPage;
      if (!nextPage || nextPage === page) break;
      page = nextPage;
    }

    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400e3).toISOString().slice(0, 10);
      return { day: d.slice(5), signups: byDay[d] ?? 0 };
    });
    return { signups: days };
  });

/* ------------------------ Question bank bulk upload ------------------------ */

type BankOptionKey = "A" | "B" | "C" | "D";
type BankOptions = Record<BankOptionKey, string>;
type BankRow = {
  question: string;
  options: BankOptions;
  correct: string;
  hint: string;
  explanation: string;
  profession: "pcm" | "pcb" | null;
  chapter_id: string | null;
  subject_code: string | null;
  exam: string | null;
  exam_year: number | null;
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function compactKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readField(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  const lookup = new Map(Object.entries(row).map(([key, value]) => [compactKey(key), value]));
  for (const key of keys) {
    const value = lookup.get(compactKey(key));
    if (value !== undefined) return value;
  }
  return undefined;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeProfession(value: unknown): "pcm" | "pcb" | null {
  const text = cleanText(value).toLowerCase();
  if (text === "pcm" || text === "jee" || text === "math" || text === "maths") return "pcm";
  if (text === "pcb" || text === "neet" || text === "bio" || text === "biology") return "pcb";
  return null;
}

function normalizeYear(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const year = typeof value === "number" ? value : Number.parseInt(cleanText(value), 10);
  if (!Number.isFinite(year) || !Number.isInteger(year) || year < 1980 || year > 2100) return null;
  return year;
}

function normalizeOptions(row: Record<string, unknown>): BankOptions | null {
  const source = readField(row, ["options", "choices", "answers", "answer_options"]);
  const fromArray = Array.isArray(source) ? source : null;
  if (fromArray) {
    const values = fromArray.slice(0, 4).map(cleanText);
    if (values.length === 4 && values.every(Boolean)) {
      return { A: values[0], B: values[1], C: values[2], D: values[3] };
    }
  }

  const optionSource =
    source && typeof source === "object" && !Array.isArray(source)
      ? (source as Record<string, unknown>)
      : row;
  const optionValues = OPTION_KEYS.map((key, index) =>
    cleanText(
      readField(optionSource, [
        key,
        key.toLowerCase(),
        `option_${key.toLowerCase()}`,
        `option${key}`,
        `option${key.toLowerCase()}`,
        `option_${index + 1}`,
        `option${index + 1}`,
        String(index),
        String(index + 1),
      ]),
    ),
  );

  if (optionValues.every(Boolean)) {
    return { A: optionValues[0], B: optionValues[1], C: optionValues[2], D: optionValues[3] };
  }

  return null;
}

function normalizeChoiceLetters(value: string): string {
  const upper = value.toUpperCase();
  const compact = upper.replace(/\bAND\b/g, "").replace(/[\s,;|+&/]/g, "").replace(/[()]/g, "");
  if (/^[ABCD]+$/.test(compact)) {
    return OPTION_KEYS.filter((key) => compact.includes(key)).join("");
  }

  const wrapped = upper.match(/^\(?\s*([ABCD])\s*\)?$/);
  if (wrapped) return wrapped[1];

  const leading = upper.match(/^\(?\s*([ABCD])\s*[\).:\-]/);
  if (leading) return leading[1];

  const labelled = upper.match(/(?:ANSWER|ANS|OPTION|CORRECT)\s*[:\-]?\s*([ABCD])\b/);
  if (labelled) return labelled[1];

  return "";
}

function normalizeCorrect(value: unknown, options: BankOptions | null): string | null {
  const text = cleanText(value);
  if (!text) return null;

  const letters = normalizeChoiceLetters(text);
  if (letters) return letters;

  if (options) {
    const normalizedAnswer = text.toLowerCase().replace(/\s+/g, " ");
    for (const key of OPTION_KEYS) {
      if (options[key].toLowerCase().replace(/\s+/g, " ") === normalizedAnswer) return key;
    }
  }

  // JEE Advanced numerical-answer PYQs use values like 9, 0.5, -14.6 etc.
  return text.slice(0, 80);
}

const bankRowSchema = z.unknown().transform((value, ctx): BankRow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each row must be an object." });
    return z.NEVER as never;
  }

  const row = value as Record<string, unknown>;
  const question = cleanText(readField(row, ["question", "question_text", "prompt", "stem"]));
  if (question.length < 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Question text is required." });
  }

  const options = normalizeOptions(row);
  const correct = normalizeCorrect(
    readField(row, ["correct", "answer", "answer_key", "answerKey", "correct_answer", "correctAnswer", "correct_option", "correctOption", "ans"]),
    options,
  );
  if (!correct) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Correct answer is required." });
  }
  const correctIsChoice = !!correct && !!normalizeChoiceLetters(correct);
  if (correctIsChoice && !options) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choice questions need four options: A, B, C and D.",
    });
  }

  const chapterId = cleanText(readField(row, ["chapter_id", "chapterId"]));
  const subjectCode = cleanText(readField(row, ["subject_code", "subjectCode", "subject"]));
  const exam = cleanText(readField(row, ["exam", "exam_name", "examName", "test", "paper"]));

  return {
    question,
    options: options ?? { A: "", B: "", C: "", D: "" },
    correct: correct ?? "A",
    hint: cleanText(readField(row, ["hint"])),
    explanation: cleanText(readField(row, ["explanation", "solution", "rationale"])),
    profession: normalizeProfession(readField(row, ["profession", "stream", "course"])),
    // Many PYQ files use chapter names here; keep upload resilient by storing
    // only valid UUIDs and leaving everything else unlinked instead of failing.
    chapter_id: chapterId && UUID_RE.test(chapterId) ? chapterId : null,
    subject_code: subjectCode ? subjectCode.toLowerCase().slice(0, 80) : null,
    exam: exam ? exam.toUpperCase().slice(0, 40) : null,
    exam_year: normalizeYear(readField(row, ["exam_year", "examYear", "year"])),
  };
});

const bulkUploadSchema = z.object({
  rows: z.array(bankRowSchema).min(1).max(5000),
});

type BankInsertRow = {
  question: string;
  options: never;
  correct: string;
  hint: string;
  explanation: string;
  profession: "pcm" | "pcb" | null;
  chapter_id: string | null;
  subject_code: string | null;
  exam: string | null;
  exam_year: number | null;
  source: "admin";
  created_by: string;
};

function duplicateGroupKey(row: { exam: string | null; exam_year: number | null }) {
  return `${row.exam ?? "__NULL__"}::${row.exam_year ?? "__NULL__"}`;
}

function duplicateQuestionKey(row: { question: string; exam: string | null; exam_year: number | null }) {
  return `${duplicateGroupKey(row)}::${row.question.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

async function filterExistingBankRows(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  rows: BankInsertRow[],
) {
  const existing = new Set<string>();
  const groups = new Map<string, { exam: string | null; exam_year: number | null }>();
  for (const row of rows) groups.set(duplicateGroupKey(row), { exam: row.exam, exam_year: row.exam_year });

  for (const group of groups.values()) {
    let query = supabaseAdmin
      .from("question_bank")
      .select("question, exam, exam_year")
      .eq("source", "admin")
      .limit(10000);
    query = group.exam ? query.eq("exam", group.exam) : query.is("exam", null);
    query = group.exam_year === null ? query.is("exam_year", null) : query.eq("exam_year", group.exam_year);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data ?? []) existing.add(duplicateQuestionKey(row));
  }

  let skipped = 0;
  const nextRows: BankInsertRow[] = [];
  for (const row of rows) {
    const key = duplicateQuestionKey(row);
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    existing.add(key);
    nextRows.push(row);
  }
  return { rows: nextRows, skipped };
}

export const adminBulkUploadQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkUploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedRows: BankInsertRow[] = data.rows.map((r) => ({
      question: r.question,
      options: r.options as unknown as never,
      correct: r.correct,
      hint: r.hint ?? "",
      explanation: r.explanation ?? "",
      profession: r.profession ?? null,
      chapter_id: r.chapter_id ?? null,
      subject_code: r.subject_code ?? null,
      exam: r.exam ? r.exam.toUpperCase() : null,
      exam_year: r.exam_year ?? null,
      source: "admin",
      created_by: context.userId,
    }));
    const deduped = await filterExistingBankRows(supabaseAdmin, normalizedRows);
    let inserted = 0;
    for (let i = 0; i < deduped.rows.length; i += 200) {
      const chunk = deduped.rows.slice(i, i + 200);
      const { error, count } = await supabaseAdmin
        .from("question_bank")
        .insert(chunk as unknown as never, { count: "exact" });
      if (error) throw error;
      inserted += count ?? chunk.length;
    }
    return { inserted, skipped: deduped.skipped };
  });

export const adminBankStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [total, ai, admin] = await Promise.all([
      supabaseAdmin.from("question_bank").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("question_bank").select("id", { count: "exact", head: true }).eq("source", "ai"),
      supabaseAdmin.from("question_bank").select("id", { count: "exact", head: true }).eq("source", "admin"),
    ]);
    return {
      total: total.count ?? 0,
      ai: ai.count ?? 0,
      admin: admin.count ?? 0,
    };
  });


/* ---------------- Owner-only: manage admins ---------------- */

const OWNER_EMAIL = "vikashraoa2343@gmail.com";

function isOwnerCtx(context: { claims: Record<string, unknown> }) {
  const email = (context.claims?.email as string | undefined)?.toLowerCase();
  return email === OWNER_EMAIL;
}

function assertOwner(context: { claims: Record<string, unknown> }) {
  if (!isOwnerCtx(context)) throw new Error("Forbidden: owner only");
}

export const amIOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ owner: isOwnerCtx(context) }));

export const ownerListAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles").select("user_id, role, created_at").eq("role", "admin");
    if (error) throw error;
    const ids = (roles ?? []).map((r) => r.user_id as string);
    if (!ids.length) return [];
    const { data: users } = await supabaseAdmin
      .from("users").select("id, email, full_name, avatar_url").in("id", ids);
    return (roles ?? []).map((r) => {
      const u = users?.find((x) => x.id === r.user_id);
      return {
        user_id: r.user_id as string,
        created_at: r.created_at as string,
        email: (u?.email as string) ?? null,
        full_name: (u?.full_name as string) ?? null,
        avatar_url: (u?.avatar_url as string) ?? null,
        is_owner: (u?.email as string)?.toLowerCase() === OWNER_EMAIL,
      };
    });
  });

export const ownerSetAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email().optional(), user_id: z.string().uuid().optional(), make: z.boolean() })
      .refine((v) => v.email || v.user_id, "email or user_id required")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId = data.user_id;
    let email = data.email?.toLowerCase();
    if (!userId && email) {
      const { data: u } = await supabaseAdmin.from("users").select("id, email").ilike("email", email).maybeSingle();
      if (!u) throw new Error("No user found with that email. They must sign up first.");
      userId = u.id as string;
    } else if (userId && !email) {
      const { data: u } = await supabaseAdmin.from("users").select("email").eq("id", userId).maybeSingle();
      email = (u?.email as string | undefined)?.toLowerCase();
    }

    if (!data.make && email === OWNER_EMAIL) throw new Error("The owner account cannot be removed.");

    if (data.make) {
      const { error } = await supabaseAdmin
        .from("user_roles").insert({ user_id: userId!, role: "admin" });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles").delete().eq("user_id", userId!).eq("role", "admin");
      if (error) throw error;
    }
    return { ok: true, user_id: userId, email };
  });

/* ---------------- Announcements (broadcast to all users) ---------------- */

export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(3).max(120),
      body: z.string().trim().max(1000).optional().default(""),
      link: z.string().trim().max(300).optional().default(""),
      audience: z.enum(["all", "pro", "free"]).optional().default("all"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin.from("users").select("id").eq("is_banned", false);
    if (data.audience === "pro") q = q.eq("is_pro", true);
    if (data.audience === "free") q = q.eq("is_pro", false);
    const { data: users, error } = await q;
    if (error) throw error;

    const ids = (users ?? []).map((u) => u.id as string);
    if (!ids.length) return { sent: 0 };

    const rows = ids.map((id) => ({
      user_id: id,
      kind: "announcement",
      title: data.title,
      body: data.body || null,
      link: data.link || null,
    }));

    let sent = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error: insErr } = await supabaseAdmin
        .from("notifications")
        .insert(chunk as unknown as never);
      if (insErr) throw insErr;
      sent += chunk.length;
    }

    await sendTelegramAlert(`📣 Announcement sent to ${sent} users\n<b>${data.title}</b>\n${data.body ?? ""}`);
    return { sent };
  });

export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("title, body, created_at")
      .eq("kind", "announcement")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    const seen = new Map<string, { title: string; body: string | null; created_at: string; count: number }>();
    for (const n of data ?? []) {
      const key = `${n.title}|${(n.created_at as string).slice(0, 16)}`;
      const cur = seen.get(key);
      if (cur) cur.count += 1;
      else seen.set(key, { title: n.title as string, body: (n.body as string) ?? null, created_at: n.created_at as string, count: 1 });
    }
    return Array.from(seen.values()).slice(0, 20);
  });
