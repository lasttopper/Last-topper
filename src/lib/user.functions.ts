import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeFileName, sendTelegramDocument, buildReport, fmtIST, fmtDate } from "@/lib/telegram-alert";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let { data } = await supabaseAdmin
        .from("users")
        .select(
          "id, email, full_name, avatar_url, country_code, phone, profession, onboarded, daily_question_limit, streak, total_accuracy, is_pro, pro_since, date_of_birth, terms_accepted_at",
        )
        .eq("id", context.userId)
        .maybeSingle();

      if (!data) {
        const { data: newUser } = await supabaseAdmin
          .from("users")
          .upsert(
            { id: context.userId, onboarded: false, daily_question_limit: 20 },
            { onConflict: "id" },
          )
          .select(
            "id, email, full_name, avatar_url, country_code, phone, profession, onboarded, daily_question_limit, streak, total_accuracy, is_pro, pro_since, date_of_birth, terms_accepted_at",
          )
          .maybeSingle();

        data = newUser || {
          id: context.userId,
          email: null,
          full_name: null,
          avatar_url: null,
          country_code: "+91",
          phone: null,
          profession: null,
          onboarded: false,
          daily_question_limit: 20,
          streak: 0,
          total_accuracy: 0,
          is_pro: false,
          pro_since: null,
          date_of_birth: null,
          terms_accepted_at: null,
        };
      }

      return data;
    } catch (err) {
      console.warn("[getMyProfile] DB fetch fallback:", err);
      return {
        id: context.userId,
        email: null,
        full_name: null,
        avatar_url: null,
        country_code: "+91",
        phone: null,
        profession: null,
        onboarded: false,
        daily_question_limit: 20,
        streak: 0,
        total_accuracy: 0,
        is_pro: false,
        pro_since: null,
        date_of_birth: null,
        terms_accepted_at: null,
      };
    }
  });

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(15),
  country_code: z.string().default("+91"),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  accept_terms: z.literal(true),
});

export const saveSignupDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => signupSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Validate DOB (>= 8 years old, <= 100)
    const dob = new Date(data.date_of_birth + "T00:00:00Z");
    const now = new Date();
    const ageMs = now.getTime() - dob.getTime();
    const years = ageMs / (365.25 * 24 * 3600 * 1000);
    if (Number.isNaN(years) || years < 8 || years > 100) {
      throw new Error("Please enter a valid date of birth.");
    }

    const cleanPhone = data.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Please enter a valid 10-digit phone number.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if phone number is already linked to another account
    const { data: existing, error: qErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", cleanPhone)
      .neq("id", context.userId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (existing) {
      throw new Error("This phone number is already linked to another account.");
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        full_name: data.full_name,
        country_code: data.country_code || "+91",
        phone: cleanPhone,
        date_of_birth: data.date_of_birth,
        terms_accepted_at: new Date().toISOString(),
      })
      .eq("id", context.userId);

    if (error) {
      const msg = String((error as { message?: string }).message ?? "");
      if (msg.includes("duplicate key")) {
        throw new Error("This phone number is already linked to another account.");
      }
      throw error;
    }

    return { ok: true };
  });

const phoneSchema = z.object({
  country_code: z.string().min(1).max(6),
  phone: z.string().min(4).max(20),
});

export const updatePhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => phoneSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cleanPhone = data.phone.replace(/\D/g, "");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: qErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", cleanPhone)
      .neq("id", context.userId)
      .maybeSingle();
    if (qErr) throw qErr;
    if (existing) throw new Error("This phone number is already linked to another account.");

    const { error } = await supabaseAdmin
      .from("users")
      .update({ country_code: data.country_code, phone: cleanPhone })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const professionSchema = z.object({ profession: z.enum(["pcm", "pcb"]) });

export const setProfession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => professionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("users")
      .update({ profession: data.profession })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin
      .from("users")
      .select(
        "email, full_name, country_code, phone, profession, date_of_birth, terms_accepted_at, signup_alert_sent_at, created_at",
      )
      .eq("id", context.userId)
      .maybeSingle();

    if (!u?.full_name || !u?.date_of_birth) {
      throw new Error("Please complete your profile before continuing.");
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ onboarded: true })
      .eq("id", context.userId);
    if (error) throw error;

    try {
      if (!u.signup_alert_sent_at) {
        const lines = buildReport("New signup verified", [
          ["Name", u.full_name],
          ["Email", u.email ?? "—"],
          ["Phone", u.phone ? `${u.country_code ?? "+91"} ${u.phone}` : "—"],
          ["Date of birth", fmtDate(u.date_of_birth)],
          ["Track", (u.profession ?? "").toString().toUpperCase()],
          ["Terms accepted", fmtIST(u.terms_accepted_at)],
          ["Signed up at", fmtIST(u.created_at)],
          ["User ID", context.userId],
        ]);
        const fileName = safeFileName([String(u.full_name ?? "user"), "new_user"], "txt");
        await sendTelegramDocument(
          fileName,
          lines,
          [
            "🆕 <b>New signup verified</b>",
            `👤 ${u.full_name ?? "—"}`,
            `📱 ${u.phone ? `${u.country_code ?? "+91"} ${u.phone}` : "—"}`,
            `🎓 ${(u.profession ?? "—").toString().toUpperCase()}`,
          ].join("\n"),
        );

        await supabaseAdmin
          .from("users")
          .update({ signup_alert_sent_at: new Date().toISOString() })
          .eq("id", context.userId);
      }
    } catch (e) {
      console.error("[onboarding] telegram notification skipped", e);
    }

    return { ok: true };
  });

export const pingActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin
      .from("users")
      .select("streak, best_streak, last_streak_date")
      .eq("id", context.userId)
      .maybeSingle();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const last = u?.last_streak_date ? new Date(u.last_streak_date as string) : null;
    const streak = u?.streak ?? 0;

    let nextStreak = streak;
    if (!last) nextStreak = 1;
    else {
      const diffDays = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())) / 86400000);
      if (diffDays === 0) return { streak };
      if (diffDays === 1) nextStreak = streak + 1;
      else nextStreak = 1;
    }

    await supabaseAdmin
      .from("users")
      .update({
        streak: nextStreak,
        best_streak: Math.max(Number(u?.best_streak ?? 0), nextStreak),
        last_streak_date: todayStr,
        last_active_date: todayStr,
      })
      .eq("id", context.userId);
    return { streak: nextStreak };
  });

export const getStreakDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("users")
        .select("streak, best_streak, last_streak_date, last_active_date")
        .eq("id", context.userId)
        .maybeSingle();
      return {
        streak: Number(data?.streak ?? 0),
        best_streak: Math.max(Number(data?.best_streak ?? 0), Number(data?.streak ?? 0)),
        last_streak_date: (data?.last_streak_date as string | null) ?? null,
        last_active_date: (data?.last_active_date as string | null) ?? null,
      };
    } catch {
      return { streak: 0, best_streak: 0, last_streak_date: null, last_active_date: null };
    }
  });
