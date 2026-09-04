import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminCtx(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw error;
  if (!data) throw new Error("Forbidden: admin only");
}

export const getAdminApiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCtx(context);
    const { getAppConfigAsync, maskSecret } = await import("@/lib/app-config.server");
    const cfg = await getAppConfigAsync();

    return {
      gemini_model: cfg.gemini_model || "gemini-2.5-flash",
      gemini_api_key_0: maskSecret(cfg.gemini_api_key_0),
      gemini_api_key_1: maskSecret(cfg.gemini_api_key_1),
      gemini_api_key_2: maskSecret(cfg.gemini_api_key_2),
      gemini_api_key_3: maskSecret(cfg.gemini_api_key_3),
      has_gemini_0: !!cfg.gemini_api_key_0,
      has_gemini_1: !!cfg.gemini_api_key_1,
      has_gemini_2: !!cfg.gemini_api_key_2,
      has_gemini_3: !!cfg.gemini_api_key_3,

      openrouter_api_key_1: maskSecret(cfg.openrouter_api_key_1),
      openrouter_api_key_2: maskSecret(cfg.openrouter_api_key_2),
      has_openrouter_1: !!cfg.openrouter_api_key_1,
      has_openrouter_2: !!cfg.openrouter_api_key_2,

      xai_api_key: maskSecret(cfg.xai_api_key),
      has_xai: !!cfg.xai_api_key,

      firecrawl_api_key: maskSecret(cfg.firecrawl_api_key),
      has_firecrawl: !!cfg.firecrawl_api_key,

      omniroute_base_url: cfg.omniroute_base_url || "",
      omniroute_model: cfg.omniroute_model || "",
      omniroute_api_key_1: maskSecret(cfg.omniroute_api_key_1),
      has_omniroute: !!cfg.omniroute_api_key_1,

      razorpay_key_id: cfg.razorpay_key_id || "",
      razorpay_key_secret: maskSecret(cfg.razorpay_key_secret),
      razorpay_webhook_secret: maskSecret(cfg.razorpay_webhook_secret),
      has_razorpay_secret: !!cfg.razorpay_key_secret,

      telegram_api_key: maskSecret(cfg.telegram_api_key),
      report_telegram_chat_id: cfg.report_telegram_chat_id || "",
      has_telegram: !!cfg.telegram_api_key,
    };
  });

const saveSettingsSchema = z.object({
  gemini_model: z.string().optional(),
  gemini_api_key_0: z.string().optional(),
  gemini_api_key_1: z.string().optional(),
  gemini_api_key_2: z.string().optional(),
  gemini_api_key_3: z.string().optional(),
  openrouter_api_key_1: z.string().optional(),
  openrouter_api_key_2: z.string().optional(),
  xai_api_key: z.string().optional(),
  firecrawl_api_key: z.string().optional(),
  omniroute_base_url: z.string().optional(),
  omniroute_model: z.string().optional(),
  omniroute_api_key_1: z.string().optional(),
  razorpay_key_id: z.string().optional(),
  razorpay_key_secret: z.string().optional(),
  razorpay_webhook_secret: z.string().optional(),
  telegram_api_key: z.string().optional(),
  report_telegram_chat_id: z.string().optional(),
});

export const saveAdminApiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminCtx(context);
    const { saveAppConfig } = await import("@/lib/app-config.server");

    // Only update keys if a non-masked value was provided
    const updatePayload: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        if (typeof val === "string" && val.includes("••••••••")) {
          continue;
        }
        updatePayload[key] = typeof val === "string" ? val.trim() : val;
      }
    }

    await saveAppConfig(updatePayload, context.userId);
    return { ok: true, message: "API configurations saved successfully." };
  });

export const testAiApiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminCtx(context);
    const { aiChatText } = await import("@/lib/ai-router");
    const startTime = Date.now();
    try {
      const response = await aiChatText({
        messages: [{ role: "user", content: "Hello AI! Confirm connection in 1 short sentence." }],
        temperature: 0.3,
      });
      const latency = Date.now() - startTime;
      return { ok: true, response, latency_ms: latency };
    } catch (e: any) {
      return { ok: false, error: e.message || "Failed to connect to AI provider" };
    }
  });
