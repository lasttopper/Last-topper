import fs from "fs";
import path from "path";

export type AppConfig = {
  gemini_model?: string;
  gemini_api_key_0?: string;
  gemini_api_key_1?: string;
  gemini_api_key_2?: string;
  gemini_api_key_3?: string;
  openrouter_api_key_1?: string;
  openrouter_api_key_2?: string;
  xai_api_key?: string;
  firecrawl_api_key?: string;
  omniroute_base_url?: string;
  omniroute_model?: string;
  omniroute_api_key_1?: string;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  razorpay_webhook_secret?: string;
  telegram_api_key?: string;
  report_telegram_chat_id?: string;
};

const CONFIG_FILE = path.join(process.cwd(), "app_config.json");

let memoryConfig: AppConfig | null = null;

export async function loadAppConfigFromDb(): Promise<AppConfig | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("activity_events")
      .select("payload")
      .eq("kind", "app_config")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.payload && typeof data.payload === "object") {
      return data.payload as AppConfig;
    }
  } catch (e) {
    console.warn("[app-config] Failed to load config from database:", e);
  }
  return null;
}

export async function getAppConfigAsync(): Promise<AppConfig> {
  if (!memoryConfig) {
    const dbCfg = await loadAppConfigFromDb();
    if (dbCfg) memoryConfig = dbCfg;
  }
  return getAppConfig();
}

export function getAppConfig(): AppConfig {
  if (!memoryConfig) {
    let disk: AppConfig = {};
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        disk = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      }
    } catch {
      disk = {};
    }
    memoryConfig = disk;
  }

  const g0 = memoryConfig.gemini_api_key_0 || process.env.GEMINI_API_KEY_0 || process.env.GEMINI_API_KEY || "";
  const g1 = memoryConfig.gemini_api_key_1 || process.env.GEMINI_API_KEY_1 || g0;

  return {
    gemini_model: memoryConfig.gemini_model || process.env.GEMINI_MODEL || "gemini-3.6-flash",
    gemini_api_key_0: g0,
    gemini_api_key_1: g1,
    gemini_api_key_2: memoryConfig.gemini_api_key_2 || process.env.GEMINI_API_KEY_2 || "",
    gemini_api_key_3: memoryConfig.gemini_api_key_3 || process.env.GEMINI_API_KEY_3 || "",
    openrouter_api_key_1: memoryConfig.openrouter_api_key_1 || process.env.OPENROUTER_API_KEY_1 || "",
    openrouter_api_key_2: memoryConfig.openrouter_api_key_2 || process.env.OPENROUTER_API_KEY_2 || "",
    xai_api_key: memoryConfig.xai_api_key || process.env.XAI_API_KEY || "",
    firecrawl_api_key: memoryConfig.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || "",
    omniroute_base_url: memoryConfig.omniroute_base_url || process.env.OMNIROUTE_BASE_URL || "",
    omniroute_model: memoryConfig.omniroute_model || process.env.OMNIROUTE_MODEL || "",
    omniroute_api_key_1: memoryConfig.omniroute_api_key_1 || process.env.OMNIROUTE_API_KEY_1 || "",
    razorpay_key_id: memoryConfig.razorpay_key_id || process.env.RAZORPAY_KEY_ID || "",
    razorpay_key_secret: memoryConfig.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || "",
    razorpay_webhook_secret: memoryConfig.razorpay_webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET || "",
    telegram_api_key: memoryConfig.telegram_api_key || process.env.TELEGRAM_API_KEY_1 || process.env.TELEGRAM_API_KEY || "",
    report_telegram_chat_id: memoryConfig.report_telegram_chat_id || process.env.REPORT_TELEGRAM_CHAT_ID || "",
  };
}

export async function saveAppConfig(newCfg: Partial<AppConfig>, userId?: string): Promise<AppConfig> {
  const current = getAppConfig();
  const merged: AppConfig = { ...current, ...newCfg };
  memoryConfig = merged;

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch (e) {
    console.warn("[app-config] Ephemeral filesystem write skipped:", e);
  }

  if (userId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("activity_events").insert({
        user_id: userId,
        kind: "app_config",
        payload: merged as any,
      });
    } catch (dbErr) {
      console.error("[app-config] Failed to persist config to Supabase:", dbErr);
    }
  }

  if (merged.gemini_model) process.env.GEMINI_MODEL = merged.gemini_model;
  if (merged.gemini_api_key_0) {
    process.env.GEMINI_API_KEY_0 = merged.gemini_api_key_0;
    process.env.GEMINI_API_KEY = merged.gemini_api_key_0;
  }
  if (merged.gemini_api_key_1) process.env.GEMINI_API_KEY_1 = merged.gemini_api_key_1;
  if (merged.gemini_api_key_2) process.env.GEMINI_API_KEY_2 = merged.gemini_api_key_2;
  if (merged.gemini_api_key_3) process.env.GEMINI_API_KEY_3 = merged.gemini_api_key_3;
  if (merged.openrouter_api_key_1) process.env.OPENROUTER_API_KEY_1 = merged.openrouter_api_key_1;
  if (merged.openrouter_api_key_2) process.env.OPENROUTER_API_KEY_2 = merged.openrouter_api_key_2;
  if (merged.xai_api_key) process.env.XAI_API_KEY = merged.xai_api_key;
  if (merged.firecrawl_api_key) process.env.FIRECRAWL_API_KEY = merged.firecrawl_api_key;
  if (merged.omniroute_base_url) process.env.OMNIROUTE_BASE_URL = merged.omniroute_base_url;
  if (merged.omniroute_model) process.env.OMNIROUTE_MODEL = merged.omniroute_model;
  if (merged.omniroute_api_key_1) process.env.OMNIROUTE_API_KEY_1 = merged.omniroute_api_key_1;
  if (merged.razorpay_key_id) process.env.RAZORPAY_KEY_ID = merged.razorpay_key_id;
  if (merged.razorpay_key_secret) process.env.RAZORPAY_KEY_SECRET = merged.razorpay_key_secret;
  if (merged.razorpay_webhook_secret) process.env.RAZORPAY_WEBHOOK_SECRET = merged.razorpay_webhook_secret;
  if (merged.telegram_api_key) {
    process.env.TELEGRAM_API_KEY_1 = merged.telegram_api_key;
    process.env.TELEGRAM_API_KEY = merged.telegram_api_key;
  }
  if (merged.report_telegram_chat_id) process.env.REPORT_TELEGRAM_CHAT_ID = merged.report_telegram_chat_id;

  return merged;
}

export function maskSecret(secret?: string): string {
  if (!secret || secret.trim().length === 0) return "";
  const s = secret.trim();
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
}
