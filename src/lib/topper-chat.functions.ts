import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatText } from "@/lib/ai-router";
import { createHandwrittenNotebookPage } from "@/lib/handwriting-generator";

const BUCKET = "ai-handwriting";

/** Signed URL lifetime for handwritten images (24 hours max retention). */
const SIGN_TTL = 60 * 60 * 24;

export type ChatThread = { id: string; title: string; updated_at: string };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  created_at: string;
};

/**
 * Automatically purges chat threads, messages, and handwritten notes older than 24 hours.
 */
export async function purgeExpiredAiHistory(userId?: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Delete messages older than 24 hours
    let msgQuery = supabaseAdmin.from("ai_chat_messages").delete().lt("created_at", cutoff);
    if (userId) msgQuery = msgQuery.eq("user_id", userId);
    await msgQuery;

    // 2. Delete inactive threads older than 24 hours
    let threadQuery = supabaseAdmin.from("ai_chat_threads").delete().lt("updated_at", cutoff);
    if (userId) threadQuery = threadQuery.eq("user_id", userId);
    await threadQuery;
  } catch (e) {
    console.warn("[purgeExpiredAiHistory] Auto-cleanup error:", e);
  }
}

async function signPaths(paths: (string | null)[]): Promise<Record<string, string>> {
  const real = paths.filter((p): p is string => !!p);
  if (real.length === 0) return {};
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(real, SIGN_TTL);
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
    }
    return map;
  } catch {
    return {};
  }
}

/** All chat threads for the signed-in user updated within last 24 hours. */
export const listChatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await purgeExpiredAiHistory(context.userId);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("ai_chat_threads")
        .select("id, title, updated_at")
        .eq("user_id", context.userId)
        .gte("updated_at", cutoff)
        .order("updated_at", { ascending: false })
        .limit(50);
      return (data ?? []) as ChatThread[];
    } catch {
      return [];
    }
  });

export const createChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await purgeExpiredAiHistory(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_chat_threads")
      .insert({ user_id: context.userId, title: "New chat" })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error("Failed to create chat thread");
    return data as ChatThread;
  });

export const deleteChatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("ai_chat_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const getChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await purgeExpiredAiHistory(context.userId);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("ai_chat_messages")
        .select("id, role, content, image_url, created_at")
        .eq("thread_id", data.threadId)
        .eq("user_id", context.userId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(200);
      const list = (rows ?? []) as ChatMessage[];
      const signed = await signPaths(list.map((m) => m.image_url));
      return list.map((m) => ({
        ...m,
        image_url: m.image_url ? (signed[m.image_url] ?? null) : null,
      }));
    } catch {
      return [];
    }
  });

/** Persist a message into a thread (owner-scoped). */
async function saveMessage(
  userId: string,
  threadId: string,
  role: "user" | "assistant",
  content: string,
  imagePath?: string | null,
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_chat_messages").insert({
      thread_id: threadId,
      user_id: userId,
      role,
      content,
      image_url: imagePath ?? null,
    });
    await supabaseAdmin
      .from("ai_chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", userId);
  } catch (e) {
    console.warn("[saveMessage] Error persisting chat message:", e);
  }
}

/** Give a fresh thread a short title from the first user message. */
async function maybeTitle(userId: string, threadId: string, first: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin
      .from("ai_chat_threads")
      .select("title")
      .eq("id", threadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (t?.title && t.title !== "New chat") return;
    const title = first.replace(/\s+/g, " ").trim().slice(0, 60) || "New chat";
    await supabaseAdmin
      .from("ai_chat_threads")
      .update({ title })
      .eq("id", threadId)
      .eq("user_id", userId);
  } catch (e) {
    console.warn("[maybeTitle] Error updating thread title:", e);
  }
}

export const saveChatTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        threadId: z.string().uuid(),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await saveMessage(context.userId, data.threadId, data.role, data.content);
    if (data.role === "user") {
      await maybeTitle(context.userId, data.threadId, data.content);
    }
    return { ok: true };
  });

/**
 * Render text (or an AI-written topic) as a rich handwritten notebook page.
 * Unlocked for all users with AI expansion and downloadable output.
 */
export const generateHandwrittenImage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        threadId: z.string().optional(),
        text: z.string().min(1).max(2000),
        mode: z.enum(["notes", "solution"]).default("notes"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    let body = data.text.trim();

    // Auto-expand short topic prompts into full structured NCERT study notes first!
    if (body.length < 150 || data.mode === "solution") {
      try {
        const sysPrompt = data.mode === "solution"
          ? "You are an NCERT topper. Write a concise step-by-step worked solution: Title, Formula used, Numbered steps, and Final Answer. Under 120 words. Plain text only, no markdown headers or asterisks."
          : "You are an NCERT topper. Write crisp handwritten study notes on the given topic. Include: 1) Main Heading, 2) Core Definition, 3) Important Formulas/Equations, 4) 3 Key Bullet points for revision. Under 140 words. Plain text only, no markdown headers or asterisks.";

        const generatedContent = await aiChatText({
          model: "google/gemini-3.6-flash",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Topic: ${body}` },
          ],
        });
        if (generatedContent && generatedContent.trim().length > 30) {
          body = generatedContent.trim();
        }
      } catch (e) {
        console.warn("[generateHandwrittenImage] AI expansion fallback:", e);
      }
    }

    body = body.replace(/[*#`$]/g, "").trim().slice(0, 1500);

    try {
      const pageUrl = await createHandwrittenNotebookPage(body, data.mode);
      return { url: pageUrl, caption: body };
    } catch {
      const fallbackSvg = await createHandwrittenNotebookPage(body, "notes");
      return { url: fallbackSvg, caption: body };
    }
  });
