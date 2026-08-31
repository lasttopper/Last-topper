/**
 * Multi-provider AI router with automatic key rotation.
 * Supports Gemini, OpenRouter, xAI Grok, and Custom/OmniRoute OpenAI-compatible endpoints.
 * Order of attempts:
 *   0. Custom API / OmniRoute (Base URL & Model if configured in Admin)
 *   1. GEMINI_API_KEY_1 / _2 / _3   -> Google Generative Language (e.g. gemini-3.6-flash)
 *   2. OPENROUTER_API_KEY_1 / _2    -> OpenRouter Catalog
 *   3. XAI_API_KEY                  -> xAI Grok 4 Fast
 */

export type ChatBody = {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  response_format?: unknown;
  tools?: unknown;
  tool_choice?: unknown;
  temperature?: number;
};

type Provider = {
  label: string;
  url: string;
  headers: Record<string, string>;
  model: (m: string) => string;
};

function getConfig() {
  if (typeof process !== "undefined" && process.env) {
    try {
      // Dynamic import in Node server environment
      const { getAppConfig } = require("@/lib/app-config.server");
      return getAppConfig();
    } catch {
      // Fallback to process.env
    }
  }
  return {};
}

/** Google's native API model mapping. Respects custom configured default model (e.g. gemini-3.6-flash). */
function toGeminiModel(requestedModel: string, configuredDefault?: string): string {
  const bare = requestedModel.replace(/^google\//, "");
  if (/lite/i.test(bare)) return "gemini-flash-lite-latest";
  if (/pro/i.test(bare)) return "gemini-pro-latest";
  if (configuredDefault && configuredDefault.trim()) {
    return configuredDefault.trim().replace(/^google\//, "");
  }
  return "gemini-3.6-flash";
}

/** OpenRouter catalog model mapping. */
function toOpenRouterModel(model: string): string {
  const bare = model.replace(/^google\//, "");
  if (/lite/i.test(bare)) return "google/gemini-2.5-flash-lite";
  if (/pro/i.test(bare)) return "google/gemini-2.5-pro";
  return "google/gemini-2.5-flash";
}

/** xAI Grok model ids. */
function toGrokModel(): string {
  return "grok-4-fast-non-reasoning";
}

function buildProviders(): Provider[] {
  const cfg = getConfig();
  const list: Provider[] = [];

  // 0. Custom API / OmniRoute (Self-hosted or custom OpenAI-compatible endpoint)
  const omniBase = (cfg.omniroute_base_url || process.env.OMNIROUTE_BASE_URL || "").trim().replace(/\/+$/, "");
  if (omniBase) {
    const omniModel = (m: string) => cfg.omniroute_model || process.env.OMNIROUTE_MODEL || m;
    const key = cfg.omniroute_api_key_1 || process.env.OMNIROUTE_API_KEY_1 || "";
    list.push({
      label: "Custom_API / OmniRoute",
      url: `${omniBase}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      model: omniModel,
    });
  }

  // 1. Google Gemini Keys & Model (e.g. gemini-3.6-flash)
  const configuredGeminiModel = cfg.gemini_model || process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const geminiKeys = [
    { name: "GEMINI_API_KEY_1", key: cfg.gemini_api_key_1 || process.env.GEMINI_API_KEY_1 },
    { name: "GEMINI_API_KEY_2", key: cfg.gemini_api_key_2 || process.env.GEMINI_API_KEY_2 },
    { name: "GEMINI_API_KEY_3", key: cfg.gemini_api_key_3 || process.env.GEMINI_API_KEY_3 },
  ];

  for (const item of geminiKeys) {
    const key = item.key?.trim();
    if (!key) continue;
    list.push({
      label: item.name,
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      model: (reqM) => toGeminiModel(reqM, configuredGeminiModel),
    });
  }

  // 2. OpenRouter Keys
  const openRouterKeys = [
    { name: "OPENROUTER_API_KEY_1", key: cfg.openrouter_api_key_1 || process.env.OPENROUTER_API_KEY_1 },
    { name: "OPENROUTER_API_KEY_2", key: cfg.openrouter_api_key_2 || process.env.OPENROUTER_API_KEY_2 },
  ];

  for (const item of openRouterKeys) {
    const key = item.key?.trim();
    if (!key) continue;
    list.push({
      label: item.name,
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      model: toOpenRouterModel,
    });
  }

  // 3. xAI Grok Key
  const grok = (cfg.xai_api_key || process.env.XAI_API_KEY || "").trim();
  if (grok) {
    list.push({
      label: "XAI_API_KEY",
      url: "https://api.x.ai/v1/chat/completions",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${grok}` },
      model: toGrokModel,
    });
  }

  return list;
}

/** True when we should give up on this key and move to the next one. */
function shouldRotate(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 429 || status >= 500;
}

/** Per-provider request budget; on timeout we rotate to the next key. */
const REQUEST_TIMEOUT_MS = 22_000;

export class AiUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "AiUnavailableError";
    this.status = status;
  }
}

/**
 * Runs a chat completion across every configured key until one succeeds.
 * Returns the parsed OpenAI-style JSON response.
 */
export async function aiChat(body: ChatBody): Promise<any> {
  const providers = buildProviders();
  if (providers.length === 0) throw new AiUnavailableError("No AI provider keys configured in Admin Panel or .env", 500);

  const requested = body.model ?? "google/gemini-3.6-flash";
  let lastStatus = 503;
  let lastText = "AI unavailable";

  for (const p of providers) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const resp = await fetch(p.url, {
          method: "POST",
          headers: p.headers,
          body: JSON.stringify({ ...body, stream: false, model: p.model(requested) }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (resp.ok) return await resp.json();

        lastStatus = resp.status;
        lastText = await resp.text().catch(() => "");
        console.error(`[ai-router] ${p.label} -> ${resp.status} ${lastText.slice(0, 300)}`);

        if (resp.status === 429 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        if (shouldRotate(resp.status)) break;
        break;
      } catch (e) {
        lastText = e instanceof Error ? e.message : String(e);
        console.error(`[ai-router] ${p.label} network error: ${lastText}`);
        break;
      }
    }
  }

  throw new AiUnavailableError(`All AI providers failed (last ${lastStatus}: ${lastText.slice(0, 200)})`, lastStatus);
}

/** Convenience: returns the assistant message text. */
export async function aiChatText(body: ChatBody): Promise<string> {
  const json = await aiChat(body);
  return (json?.choices?.[0]?.message?.content ?? "") as string;
}

/**
 * OpenRouter dedicated fallback.
 */
export async function openRouterChat(body: ChatBody): Promise<any> {
  const cfg = getConfig();
  const keys = [
    cfg.openrouter_api_key_1 || process.env.OPENROUTER_API_KEY_1,
    cfg.openrouter_api_key_2 || process.env.OPENROUTER_API_KEY_2,
  ]
    .map((n) => n?.trim())
    .filter(Boolean) as string[];

  if (keys.length === 0) return aiChat(body);

  const model = toOpenRouterModel(body.model ?? "google/gemini-2.5-flash");
  let lastStatus = 503;
  let lastText = "AI unavailable";

  for (const key of keys) {
    try {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ ...body, stream: false, model }),
      });
      if (resp.ok) return await resp.json();
      lastStatus = resp.status;
      lastText = await resp.text().catch(() => "");
      console.error(`[ai-router] openrouter -> ${resp.status} ${lastText.slice(0, 200)}`);
    } catch (e) {
      lastText = e instanceof Error ? e.message : String(e);
      console.error(`[ai-router] openrouter network error: ${lastText}`);
    }
  }
  throw new AiUnavailableError(`Diagram provider failed (last ${lastStatus})`, lastStatus);
}
