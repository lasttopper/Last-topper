import fs from "fs";
import path from "path";

export type AppConfig = {
  gemini_model?: string;
  gemini_api_key_1?: string;
  gemini_api_key_2?: string;
  gemini_api_key_3?: string;
  openrouter_api_key_1?: string;
  openrouter_api_key_2?: string;
  xai_api_key?: string;
  omniroute_base_url?: string;
  omniroute_model?: string;
  omniroute_api_key_1?: string;
  razorpay_key_id?: string;
  razorpay_key_secret?: string;
  razorpay_webhook_secret?: string;
  telegram_api_key?: string;
  report_telegram_chat_id?: string;
  // Sub2Unlock & Monetag Settings
  mega_sub2unlock_enabled?: boolean;
  monetag_direct_link?: string;
  monetag_script_id?: string;
  youtube_sub_url?: string;
  telegram_channel_url?: string;
  sub2unlock_timer_sec?: number;
};

const CONFIG_FILE = path.join(process.cwd(), "app_config.json");

let memoryConfig: AppConfig | null = null;

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

  return {
    gemini_model: memoryConfig.gemini_model || process.env.GEMINI_MODEL || "gemini-3.6-flash",
    gemini_api_key_1: memoryConfig.gemini_api_key_1 || process.env.GEMINI_API_KEY_1 || "",
    gemini_api_key_2: memoryConfig.gemini_api_key_2 || process.env.GEMINI_API_KEY_2 || "",
    gemini_api_key_3: memoryConfig.gemini_api_key_3 || process.env.GEMINI_API_KEY_3 || "",
    openrouter_api_key_1: memoryConfig.openrouter_api_key_1 || process.env.OPENROUTER_API_KEY_1 || "",
    openrouter_api_key_2: memoryConfig.openrouter_api_key_2 || process.env.OPENROUTER_API_KEY_2 || "",
    xai_api_key: memoryConfig.xai_api_key || process.env.XAI_API_KEY || "",
    omniroute_base_url: memoryConfig.omniroute_base_url || process.env.OMNIROUTE_BASE_URL || "",
    omniroute_model: memoryConfig.omniroute_model || process.env.OMNIROUTE_MODEL || "",
    omniroute_api_key_1: memoryConfig.omniroute_api_key_1 || process.env.OMNIROUTE_API_KEY_1 || "",
    razorpay_key_id: memoryConfig.razorpay_key_id || process.env.RAZORPAY_KEY_ID || "",
    razorpay_key_secret: memoryConfig.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || "",
    razorpay_webhook_secret: memoryConfig.razorpay_webhook_secret || process.env.RAZORPAY_WEBHOOK_SECRET || "",
    telegram_api_key: memoryConfig.telegram_api_key || process.env.TELEGRAM_API_KEY_1 || process.env.TELEGRAM_API_KEY || "",
    report_telegram_chat_id: memoryConfig.report_telegram_chat_id || process.env.REPORT_TELEGRAM_CHAT_ID || "",
    mega_sub2unlock_enabled: memoryConfig.mega_sub2unlock_enabled !== undefined ? memoryConfig.mega_sub2unlock_enabled : true,
    monetag_direct_link: memoryConfig.monetag_direct_link || process.env.MONETAG_DIRECT_LINK || "https://sub2unlock.io",
    monetag_script_id: memoryConfig.monetag_script_id || process.env.MONETAG_SCRIPT_ID || "",
    youtube_sub_url: memoryConfig.youtube_sub_url || process.env.YOUTUBE_SUB_URL || "https://youtube.com/@LastTopper",
    telegram_channel_url: memoryConfig.telegram_channel_url || process.env.TELEGRAM_CHANNEL_URL || "https://t.me/LastTopper",
    sub2unlock_timer_sec: memoryConfig.sub2unlock_timer_sec || Number(process.env.SUB2UNLOCK_TIMER_SEC) || 10,
  };
}

export function saveAppConfig(newCfg: Partial<AppConfig>): AppConfig {
  const current = getAppConfig();
  const merged: AppConfig = { ...current, ...newCfg };
  memoryConfig = merged;

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch (e) {
    console.error("[app-config] Failed to write config file", e);
  }

  // Sync with process.env for runtime compatibility
  if (merged.gemini_model) process.env.GEMINI_MODEL = merged.gemini_model;
  if (merged.gemini_api_key_1) process.env.GEMINI_API_KEY_1 = merged.gemini_api_key_1;
  if (merged.gemini_api_key_2) process.env.GEMINI_API_KEY_2 = merged.gemini_api_key_2;
  if (merged.gemini_api_key_3) process.env.GEMINI_API_KEY_3 = merged.gemini_api_key_3;
  if (merged.openrouter_api_key_1) process.env.OPENROUTER_API_KEY_1 = merged.openrouter_api_key_1;
  if (merged.openrouter_api_key_2) process.env.OPENROUTER_API_KEY_2 = merged.openrouter_api_key_2;
  if (merged.xai_api_key) process.env.XAI_API_KEY = merged.xai_api_key;
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
  if (merged.monetag_direct_link) process.env.MONETAG_DIRECT_LINK = merged.monetag_direct_link;
  if (merged.monetag_script_id) process.env.MONETAG_SCRIPT_ID = merged.monetag_script_id;
  if (merged.youtube_sub_url) process.env.YOUTUBE_SUB_URL = merged.youtube_sub_url;
  if (merged.telegram_channel_url) process.env.TELEGRAM_CHANNEL_URL = merged.telegram_channel_url;
  if (merged.sub2unlock_timer_sec) process.env.SUB2UNLOCK_TIMER_SEC = String(merged.sub2unlock_timer_sec);

  return merged;
}

export function maskSecret(secret?: string): string {
  if (!secret || secret.trim().length === 0) return "";
  const s = secret.trim();
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`;
}
