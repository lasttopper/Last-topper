import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getAdminApiSettings, saveAdminApiSettings, testAiApiConnection } from "@/lib/api-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Key, CreditCard, Send, Zap, CheckCircle2, AlertCircle, Save, RotateCcw } from "lucide-react";
import { failMessage } from "@/lib/friendly-error";

export const Route = createFileRoute("/_authenticated/admin/api-settings")({
  head: () => ({
    meta: [
      { title: "API & Model Settings — Admin" },
      { name: "description", content: "Configure AI models, API keys, Razorpay gateway, and Telegram alerts." },
    ],
  }),
  component: AdminApiSettingsPage,
});

function AdminApiSettingsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-api-settings"], queryFn: () => getAdminApiSettings() });

  const [geminiModel, setGeminiModel] = useState("gemini-3.6-flash");
  const [geminiKey0, setGeminiKey0] = useState("");
  const [geminiKey1, setGeminiKey1] = useState("");
  const [geminiKey2, setGeminiKey2] = useState("");
  const [geminiKey3, setGeminiKey3] = useState("");

  const [openRouterKey1, setOpenRouterKey1] = useState("");
  const [openRouterKey2, setOpenRouterKey2] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [firecrawlKey, setFirecrawlKey] = useState("");

  const [omniBase, setOmniBase] = useState("");
  const [omniModel, setOmniModel] = useState("");
  const [omniKey, setOmniKey] = useState("");

  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState("");

  const [telegramKey, setTelegramKey] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [testResult, setTestResult] = useState<{ ok: boolean; response?: string; latency_ms?: number; error?: string } | null>(null);

  useEffect(() => {
    if (q.data) {
      setGeminiModel(q.data.gemini_model || "gemini-3.6-flash");
      setGeminiKey0(q.data.gemini_api_key_0 || "");
      setGeminiKey1(q.data.gemini_api_key_1 || "");
      setGeminiKey2(q.data.gemini_api_key_2 || "");
      setGeminiKey3(q.data.gemini_api_key_3 || "");

      setOpenRouterKey1(q.data.openrouter_api_key_1 || "");
      setOpenRouterKey2(q.data.openrouter_api_key_2 || "");
      setXaiKey(q.data.xai_api_key || "");
      setFirecrawlKey(q.data.firecrawl_api_key || "");

      setOmniBase(q.data.omniroute_base_url || "");
      setOmniModel(q.data.omniroute_model || "");
      setOmniKey(q.data.omniroute_api_key_1 || "");

      setRazorpayKeyId(q.data.razorpay_key_id || "");
      setRazorpayKeySecret(q.data.razorpay_key_secret || "");
      setRazorpayWebhookSecret(q.data.razorpay_webhook_secret || "");

      setTelegramKey(q.data.telegram_api_key || "");
      setTelegramChatId(q.data.report_telegram_chat_id || "");
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      saveAdminApiSettings({
        data: {
          gemini_model: geminiModel,
          gemini_api_key_0: geminiKey0,
          gemini_api_key_1: geminiKey1,
          gemini_api_key_2: geminiKey2,
          gemini_api_key_3: geminiKey3,
          openrouter_api_key_1: openRouterKey1,
          openrouter_api_key_2: openRouterKey2,
          xai_api_key: xaiKey,
          firecrawl_api_key: firecrawlKey,
          omniroute_base_url: omniBase,
          omniroute_model: omniModel,
          omniroute_api_key_1: omniKey,
          razorpay_key_id: razorpayKeyId,
          razorpay_key_secret: razorpayKeySecret,
          razorpay_webhook_secret: razorpayWebhookSecret,
          telegram_api_key: telegramKey,
          report_telegram_chat_id: telegramChatId,
        },
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["admin-api-settings"] });
    },
    onError: (e: Error) => toast.error(failMessage(e)),
  });

  const testConnection = useMutation({
    mutationFn: () => testAiApiConnection(),
    onSuccess: (res) => {
      setTestResult(res);
      if (res.ok) {
        toast.success(`AI Connection Successful (${res.latency_ms}ms)`);
      } else {
        toast.error(`AI Test Failed: ${res.error}`);
      }
    },
    onError: (e: Error) => toast.error(failMessage(e)),
  });

  if (q.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading configurations…</div>;
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" /> API & System Settings
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure AI models, Razorpay payments, and Telegram alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={testConnection.isPending}
            onClick={() => testConnection.mutate()}
            className="inline-flex items-center gap-1.5"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            {testConnection.isPending ? "Testing..." : "Test AI Connection"}
          </Button>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {save.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {testResult && (
        <div className={`rounded-xl border p-4 text-xs ${testResult.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200"}`}>
          <div className="flex items-center gap-2 font-semibold">
            {testResult.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-rose-500" />}
            {testResult.ok ? `AI Connection Healthy (${testResult.latency_ms}ms)` : "AI Connection Failed"}
          </div>
          <p className="mt-1 font-mono text-[11px] leading-relaxed opacity-90">
            {testResult.ok ? testResult.response : testResult.error}
          </p>
        </div>
      )}

      {/* 1. Google Gemini AI Model & Keys */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Google Gemini Configuration</h2>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            Primary Model Provider
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-foreground">Select Gemini Model</label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Default model used for NCERT question generation, battle sessions, and Topper AI tutor.
            </p>
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
            >
              <option value="gemini-3.6-flash">gemini-3.6-flash (Recommended · Next-Gen Speed & Accuracy)</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash (Fast & Accurate)</option>
              <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (Ultra Low Latency)</option>
              <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>GEMINI_API_KEY_0 (Root / Primary Key 0)</span>
              {q.data?.has_gemini_0 && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <div className="relative mt-1 flex items-center gap-1">
              <Input
                type="text"
                placeholder="Paste AIzaSy... to change"
                className="font-mono text-xs pr-12"
                value={geminiKey0}
                onChange={(e) => setGeminiKey0(e.target.value)}
              />
              {geminiKey0 && (
                <button
                  type="button"
                  onClick={() => setGeminiKey0("")}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 bg-muted rounded"
                  title="Clear key to edit"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>GEMINI_API_KEY_1 (Primary Key 1)</span>
              {q.data?.has_gemini_1 && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <div className="relative mt-1 flex items-center gap-1">
              <Input
                type="text"
                placeholder="Paste AIzaSy... to change"
                className="font-mono text-xs pr-12"
                value={geminiKey1}
                onChange={(e) => setGeminiKey1(e.target.value)}
              />
              {geminiKey1 && (
                <button
                  type="button"
                  onClick={() => setGeminiKey1("")}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 bg-muted rounded"
                  title="Clear key to edit"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>GEMINI_API_KEY_2 (Rotation Backup 1)</span>
              {q.data?.has_gemini_2 && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <div className="relative mt-1 flex items-center gap-1">
              <Input
                type="text"
                placeholder="Paste AIzaSy... to change"
                className="font-mono text-xs pr-12"
                value={geminiKey2}
                onChange={(e) => setGeminiKey2(e.target.value)}
              />
              {geminiKey2 && (
                <button
                  type="button"
                  onClick={() => setGeminiKey2("")}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 bg-muted rounded"
                  title="Clear key to edit"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>GEMINI_API_KEY_3 (Rotation Backup 2)</span>
              {q.data?.has_gemini_3 && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <div className="relative mt-1 flex items-center gap-1">
              <Input
                type="text"
                placeholder="Paste AIzaSy... to change"
                className="font-mono text-xs pr-12"
                value={geminiKey3}
                onChange={(e) => setGeminiKey3(e.target.value)}
              />
              {geminiKey3 && (
                <button
                  type="button"
                  onClick={() => setGeminiKey3("")}
                  className="text-[10px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 bg-muted rounded"
                  title="Clear key to edit"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Puter.js AI & Image Generation Integration */}
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold">Puter.js AI & Image Generation Fallback</h2>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            ✓ Always Active (No API Key Required)
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Puter.js (<code className="font-mono text-indigo-500">https://js.puter.com/v2/</code>) is integrated natively. Whenever Google Gemini, OpenAI DALL-E, or OpenRouter APIs are missing, rate-limited, or unavailable, Last Topper automatically routes question generation, handwritten solution image rendering, and AI coaching completions to Puter AI.
        </p>
      </div>

      {/* 2. OpenRouter & xAI Grok Backups */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Key className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold">OpenRouter & xAI Grok Backups</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>OPENROUTER_API_KEY_1</span>
              {q.data?.has_openrouter_1 && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <Input
              type="text"
              placeholder="sk-or-v1-..."
              className="mt-1 font-mono text-xs"
              value={openRouterKey1}
              onChange={(e) => setOpenRouterKey1(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>OPENROUTER_API_KEY_2</span>
              {q.data?.has_openrouter_2 && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <Input
              type="text"
              placeholder="sk-or-v1-..."
              className="mt-1 font-mono text-xs"
              value={openRouterKey2}
              onChange={(e) => setOpenRouterKey2(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>XAI_API_KEY (xAI Grok 4 Fast)</span>
              {q.data?.has_xai && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <Input
              type="text"
              placeholder="xai-..."
              className="mt-1 font-mono text-xs"
              value={xaiKey}
              onChange={(e) => setXaiKey(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>FIRECRAWL_API_KEY (Web Search & NCERT Reference Sync)</span>
              {q.data?.has_firecrawl && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <Input
              type="text"
              placeholder="fc-..."
              className="mt-1 font-mono text-xs"
              value={firecrawlKey}
              onChange={(e) => setFirecrawlKey(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 3. Custom API / OmniRoute */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold">Custom API / OmniRoute (Self-Hosted / OpenAI Compatible)</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Custom API Base URL</label>
            <Input
              type="text"
              placeholder="https://your-custom-ai-server.com/v1"
              className="mt-1 font-mono text-xs"
              value={omniBase}
              onChange={(e) => setOmniBase(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Custom Model Name</label>
            <Input
              type="text"
              placeholder="e.g. llama-3.3-70b or gpt-4o"
              className="mt-1 font-mono text-xs"
              value={omniModel}
              onChange={(e) => setOmniModel(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Custom API Key</span>
              {q.data?.has_omniroute && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <Input
              type="text"
              placeholder="sk-..."
              className="mt-1 font-mono text-xs"
              value={omniKey}
              onChange={(e) => setOmniKey(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 4. Payment Gateway (Razorpay) */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <CreditCard className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold">Razorpay Payment Gateway</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">RAZORPAY_KEY_ID</label>
            <Input
              type="text"
              placeholder="rzp_live_..."
              className="mt-1 font-mono text-xs"
              value={razorpayKeyId}
              onChange={(e) => setRazorpayKeyId(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>RAZORPAY_KEY_SECRET</span>
              {q.data?.has_razorpay_secret && <span className="text-[10px] text-emerald-500 font-bold">✓ Configured</span>}
            </label>
            <Input
              type="text"
              placeholder="Secret..."
              className="mt-1 font-mono text-xs"
              value={razorpayKeySecret}
              onChange={(e) => setRazorpayKeySecret(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">RAZORPAY_WEBHOOK_SECRET</label>
            <Input
              type="text"
              placeholder="Webhook secret..."
              className="mt-1 font-mono text-xs"
              value={razorpayWebhookSecret}
              onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 5. Telegram Bot & Alerts */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Send className="h-4 w-4 text-sky-500" />
          <h2 className="text-sm font-semibold">Telegram Alert Bot</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>TELEGRAM_API_KEY (Bot Token)</span>
              {q.data?.has_telegram && <span className="text-[10px] text-emerald-500 font-bold">✓ Active</span>}
            </label>
            <Input
              type="text"
              placeholder="123456:ABC..."
              className="mt-1 font-mono text-xs"
              value={telegramKey}
              onChange={(e) => setTelegramKey(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">REPORT_TELEGRAM_CHAT_ID</label>
            <Input
              type="text"
              placeholder="-100..."
              className="mt-1 font-mono text-xs"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          size="default"
          disabled={save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-2 px-6"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving Configurations..." : "Save Configuration"}
        </Button>
      </div>
    </section>
  );
}
