/**
 * Multi-provider AI router with automatic key rotation and model fallback.
 * Supports Gemini (Native REST), OpenRouter, xAI Grok, and Custom/OmniRoute OpenAI-compatible endpoints.
 * Order of attempts:
 *   0. Custom API / OmniRoute (Base URL & Model if configured in Admin)
 *   1. GEMINI_API_KEY_0 / _1 / _2 / _3 / GEMINI_API_KEY -> Google Generative Language Native API (gemini-3.6-flash -> gemini-3.5-flash)
 *   2. OPENROUTER_API_KEY_1 / _2    -> OpenRouter Catalog
 *   3. XAI_API_KEY                  -> xAI Grok 4 Fast
 */

import { puterAiChat } from "@/lib/puter";
import { getAppConfig } from "@/lib/app-config.server";

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
  execute: (body: ChatBody, requestedModel: string) => Promise<any>;
};

async function getConfig() {
  try {
    const { getAppConfigAsync } = await import("@/lib/app-config.server");
    return await getAppConfigAsync();
  } catch {
    return getAppConfig();
  }
}

/** Google's native API model mapping. Sanitizes deprecated models (e.g. gemini-2.5-flash -> gemini-3.6-flash). */
function toGeminiModel(requestedModel: string, configuredDefault?: string): string {
  let model = requestedModel || configuredDefault || "gemini-3.6-flash";
  model = model.trim().replace(/^google\//, "");

  if (model.includes("2.5") || model.includes("2.0") || model === "flash" || model === "gemini-flash") {
    return "gemini-3.6-flash";
  }
  if (model === "gemini-3.5-flash" || model === "3.5-flash") {
    return "gemini-3.5-flash";
  }
  if (/lite/i.test(model)) return "gemini-3.5-flash-lite";
  if (/pro/i.test(model)) return "gemini-2.5-pro";

  return "gemini-3.6-flash";
}

/** OpenRouter catalog model mapping. */
function toOpenRouterModel(model: string): string {
  const bare = model.replace(/^google\//, "");
  if (/lite/i.test(bare)) return "google/gemini-2.0-flash-lite";
  if (/pro/i.test(bare)) return "google/gemini-1.5-pro";
  return "google/gemini-2.0-flash";
}

/** xAI Grok model ids. */
function toGrokModel(): string {
  return "grok-4-fast-non-reasoning";
}

const REQUEST_TIMEOUT_MS = 22_000;

async function buildProviders(): Promise<Provider[]> {
  const cfg = await getConfig();
  const list: Provider[] = [];

  // 0. Custom API / OmniRoute (Self-hosted or custom OpenAI-compatible endpoint)
  const omniBase = (cfg.omniroute_base_url || process.env.OMNIROUTE_BASE_URL || "").trim().replace(/\/+$/, "");
  if (omniBase) {
    const omniModel = (m: string) => cfg.omniroute_model || process.env.OMNIROUTE_MODEL || m;
    const key = cfg.omniroute_api_key_1 || process.env.OMNIROUTE_API_KEY_1 || "";
    list.push({
      label: "Custom_API / OmniRoute",
      execute: async (body, reqM) => {
        const resp = await fetch(`${omniBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
          },
          body: JSON.stringify({ ...body, stream: false, model: omniModel(reqM) }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw { status: resp.status, text };
        }
        return await resp.json();
      },
    });
  }

  // 1. Google Gemini Keys & Model (e.g. gemini-3.6-flash & gemini-3.5-flash via Native REST API)
  const configuredGeminiModel = cfg.gemini_model || process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const geminiKeys = [
    { name: "GEMINI_API_KEY_1", key: cfg.gemini_api_key_1 || process.env.GEMINI_API_KEY_1 },
    { name: "GEMINI_API_KEY_0", key: cfg.gemini_api_key_0 || process.env.GEMINI_API_KEY_0 || process.env.GEMINI_API_KEY },
    { name: "GEMINI_API_KEY_2", key: cfg.gemini_api_key_2 || process.env.GEMINI_API_KEY_2 },
    { name: "GEMINI_API_KEY_3", key: cfg.gemini_api_key_3 || process.env.GEMINI_API_KEY_3 },
  ];

  const seenKeys = new Set<string>();

  for (const item of geminiKeys) {
    const key = item.key?.trim();
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    list.push({
      label: item.name,
      execute: async (body, reqM) => {
        const primaryModel = toGeminiModel(reqM, configuredGeminiModel);
        const candidateModels = [primaryModel];
        if (primaryModel === "gemini-3.6-flash") {
          candidateModels.push("gemini-3.5-flash");
        } else if (primaryModel === "gemini-3.5-flash") {
          candidateModels.push("gemini-3.6-flash");
        }

        const contents: any[] = [];
        let sysInstruction: string | undefined;

        for (const m of body.messages) {
          if (m.role === "system") {
            sysInstruction = (sysInstruction ? sysInstruction + "\n" : "") + m.content;
          } else {
            contents.push({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            });
          }
        }

        const payload: any = {
          contents,
          ...(sysInstruction ? { systemInstruction: { parts: [{ text: sysInstruction }] } } : {}),
        };

        if (body.temperature !== undefined) {
          payload.generationConfig = payload.generationConfig || {};
          payload.generationConfig.temperature = body.temperature;
        }

        const isJson = body.response_format && (body.response_format as any).type === "json_object";
        if (isJson) {
          payload.generationConfig = payload.generationConfig || {};
          payload.generationConfig.responseMimeType = "application/json";
        }

        let lastErr: any = null;

        for (const targetModel of candidateModels) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`;
          try {
            const resp = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (resp.ok) {
              const data = await resp.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
              return {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: text,
                    },
                  },
                ],
              };
            }

            const text = await resp.text().catch(() => "");
            lastErr = { status: resp.status, text };

            if (resp.status !== 429 && resp.status !== 404 && resp.status !== 503) {
              break;
            }
          } catch (fetchErr: any) {
            lastErr = { status: 500, text: fetchErr?.message || String(fetchErr) };
          }
        }

        throw lastErr || { status: 500, text: "Gemini models exhausted" };
      },
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
      execute: async (body, reqM) => {
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ ...body, stream: false, model: toOpenRouterModel(reqM) }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw { status: resp.status, text };
        }
        return await resp.json();
      },
    });
  }

  // 3. xAI Grok Key
  const grok = (cfg.xai_api_key || process.env.XAI_API_KEY || "").trim();
  if (grok) {
    list.push({
      label: "XAI_API_KEY",
      execute: async (body) => {
        const resp = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${grok}` },
          body: JSON.stringify({ ...body, stream: false, model: toGrokModel() }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw { status: resp.status, text };
        }
        return await resp.json();
      },
    });
  }

  return list;
}

/** True when we should give up on this key and move to the next one. */
function shouldRotate(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status === 404 || status === 429 || status >= 500;
}

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
  const providers = await buildProviders();
  const requested = body.model ?? "google/gemini-3.6-flash";
  let lastStatus = 503;
  let lastText = "AI unavailable";

  if (providers.length > 0) {
    for (const p of providers) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          return await p.execute(body, requested);
        } catch (e: any) {
          const status = typeof e?.status === "number" ? e.status : 500;
          const text = typeof e?.text === "string" ? e.text : (e?.message || String(e));
          lastStatus = status;
          lastText = text;

          console.error(`[ai-router] ${p.label} -> ${status} ${text.slice(0, 300)}`);

          if (status === 429 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 250));
            continue;
          }
          if (shouldRotate(status)) break;
          break;
        }
      }
    }
  }

  // Fallback to Puter.js AI when primary provider keys are unconfigured or failing
  try {
    const puterContent = await puterAiChat(body.messages);
    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: puterContent,
          },
        },
      ],
    };
  } catch (puterErr) {
    console.warn("[ai-router] Puter AI fallback failed:", puterErr);
  }

  throw new AiUnavailableError(`All AI providers failed including Puter.js fallback (last ${lastStatus}: ${lastText.slice(0, 200)})`, lastStatus);
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
  const cfg = await getConfig();
  const keys = [
    cfg.openrouter_api_key_1 || process.env.OPENROUTER_API_KEY_1,
    cfg.openrouter_api_key_2 || process.env.OPENROUTER_API_KEY_2,
  ]
    .map((n) => n?.trim())
    .filter(Boolean) as string[];

  if (keys.length === 0) return aiChat(body);

  const model = toOpenRouterModel(body.model ?? "google/gemini-3.6-flash");
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
