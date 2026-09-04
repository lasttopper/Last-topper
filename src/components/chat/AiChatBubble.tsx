import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  PenLine,
  Plus,
  History,
  Trash2,
  FileDown,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getAiChatQuota } from "@/lib/chatbot.functions";
import { isAiLimit } from "@/lib/friendly-error";
import { ProChip } from "@/components/ProLock";
import avatarSrc from "@/assets/topper-ai-avatar.jpg";

import { chatWithTopperAi } from "@/lib/chatbot.functions";
import {
  listChatThreads,
  createChatThread,
  deleteChatThread,
  getChatMessages,
  saveChatTurn,
  generateHandwrittenImage,
} from "@/lib/topper-chat.functions";
import { Latex } from "@/components/Latex";
import { exportTextSolutionToPdf, downloadHandwrittenPdf } from "@/lib/handwriting-pdf";

type Msg = { id?: string; role: "user" | "assistant"; content: string; image_url?: string | null };

const INTRO: Msg = {
  role: "assistant",
  content:
    "Namaste! I am **Topper AI** ✨\n\nAsk me any **NCERT Physics, Chemistry, Math, or Biology** doubt, or type `/generate handwritten image [topic]` to generate 1-click handwritten study notes!",
};

const QUICK_PROMPTS = [
  { label: "✍️ Handwritten Notes: Cell Division", query: "/generate handwritten image Cell Division Biology" },
  { label: "⚡ Coulomb Law Formula Notes", query: "/generate handwritten image Coulomb Law Physics" },
  { label: "🧬 Nucleus NCERT Notes", query: "NCERT summary for Nucleus in Biology and Physics" },
  { label: "🧪 IUPAC Priority Rules", query: "Explain IUPAC functional group priority order" },
];

/** Clean helper to trigger PNG download of image data URL without breaking navigation. */
function downloadImageDataUrl(url: string, filename = "topper-handwritten-note.png") {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    console.warn("Download failed, opening window:", e);
    window.open(url, "_blank");
  }
}

export function AiChatBubble() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([INTRO]);
  const [input, setInput] = useState("");
  const [penOpen, setPenOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // In-app Lightbox Image Zoom Modal
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);

  const handwrittenUrls = messages
    .map((m) => m.image_url)
    .filter((u): u is string => Boolean(u));

  const exportAllHandwrittenPdf = async () => {
    if (!handwrittenUrls.length) return;
    setPdfBusy(true);
    try {
      await downloadHandwrittenPdf(handwrittenUrls, "topper-ai-all-notes.pdf");
    } catch {
      /* silent */
    } finally {
      setPdfBusy(false);
    }
  };

  const exportMessagePdf = async (m: Msg, index: number) => {
    setPdfBusy(true);
    try {
      if (m.image_url) {
        await downloadHandwrittenPdf([m.image_url], `topper-ai-handwritten-${index}.pdf`);
      } else {
        const titleMatch = m.content.match(/^([^\n]+)/);
        const title = titleMatch ? titleMatch[1] : "NCERT AI Notes";
        await exportTextSolutionToPdf(title, m.content, `topper-ai-notes-${index}.pdf`);
      }
    } catch {
      /* silent */
    } finally {
      setPdfBusy(false);
    }
  };

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const quota = useQuery({ queryKey: ["ai-chat-quota"], queryFn: () => getAiChatQuota() });
  const isPro = !!quota.data?.is_pro;

  const threads = useQuery({
    queryKey: ["ai-chat-threads"],
    queryFn: () => listChatThreads(),
    enabled: open,
  });

  // Pick / create the active thread
  useEffect(() => {
    if (!open || threadId || !threads.data) return;
    if (threads.data.length > 0) {
      setThreadId(threads.data[0].id);
    } else {
      createChatThread()
        .then((t) => {
          setThreadId(t.id);
          qc.invalidateQueries({ queryKey: ["ai-chat-threads"] });
        })
        .catch(() => {});
    }
  }, [open, threadId, threads.data, qc]);

  // Load messages of active thread
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    getChatMessages({ data: { threadId } })
      .then((rows) => {
        if (cancelled) return;
        setMessages(
          rows.length
            ? rows.map((r) => ({ role: r.role, content: r.content, image_url: r.image_url }))
            : [INTRO],
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const send = useMutation({
    mutationFn: (history: Msg[]) =>
      chatWithTopperAi({
        data: { messages: history.map((m) => ({ role: m.role, content: m.content })) },
      }),
    onSuccess: (res) => {
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      quota.refetch();
      if (threadId)
        saveChatTurn({ data: { threadId, role: "assistant", content: res.reply } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["ai-chat-threads"] });
    },
    onError: (e) =>
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: isAiLimit(e)
            ? "You've reached your free Topper AI limit for today 🔒\n\n**Upgrade to Pro** for unlimited NCERT tutor chat and 1-click handwritten solutions."
            : "Something went wrong. Please try again.",
        },
      ]),
  });

  const handwrite = useMutation({
    mutationFn: (v: { text: string; mode: "notes" | "solution" }) =>
      generateHandwrittenImage({ data: { threadId: threadId ?? undefined, ...v } }),
    onSuccess: (res) => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "✍️ Here is your handwritten notebook page:", image_url: res.url },
      ]);
      if (threadId) {
        saveChatTurn({
          data: {
            threadId,
            role: "assistant",
            content: "✍️ Here is your handwritten notebook page:",
          },
        }).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: ["ai-chat-threads"] });
    },
    onError: () => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Could not generate handwritten page right now. Please try again.",
        },
      ]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, send.isPending, handwrite.isPending, open]);

  const busy = send.isPending || handwrite.isPending;

  const runHandwriting = (mode: "notes" | "solution", customText?: string) => {
    setPenOpen(false);
    const targetText =
      customText || input.trim() || [...messages].reverse().find((m) => m.role === "user")?.content;
    if (!targetText || busy) return;

    setMessages((m) => [
      ...m,
      {
        role: "user",
        content:
          mode === "solution"
            ? `✍️ Create handwritten solution for: ${targetText.slice(0, 100)}`
            : `✍️ Create handwritten notes page for: ${targetText.slice(0, 100)}`,
      },
    ]);
    setInput("");
    handwrite.mutate({ text: targetText, mode });
  };

  const submitText = (textToSubmit: string) => {
    const text = textToSubmit.trim();
    if (!text || busy) return;

    // Command Interceptor: /generate handwritten image [topic] or generate handwritten notes
    const isHandwriteCmd = /^\/?(generate\s+handwritten|handwrite|handwritten\s+notes|handwritten\s+image)/i.test(
      text
    );
    if (isHandwriteCmd) {
      const topic = text
        .replace(
          /^\/?(generate\s+handwritten(\s+image|\s+notes)?|handwrite|handwritten\s+notes|handwritten\s+image)/i,
          ""
        )
        .trim();
      runHandwriting("notes", topic || text);
      return;
    }

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    if (threadId) saveChatTurn({ data: { threadId, role: "user", content: text } }).catch(() => {});
    send.mutate(next.filter((m) => !m.image_url).filter((_, i) => i > 0));
  };

  const startNewThread = async () => {
    const t = await createChatThread().catch(() => null);
    if (!t) return;
    setThreadId(t.id);
    setMessages([INTRO]);
    setShowThreads(false);
    qc.invalidateQueries({ queryKey: ["ai-chat-threads"] });
  };

  const copyText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <>
      {/* Lightbox Image Preview Modal (Rendered via React Portal directly on document.body for top z-index layer) */}
      {previewImageUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-black/92 p-4 backdrop-blur-md">
            {/* Lightbox Controls */}
            <div className="absolute top-4 right-4 z-[1000000] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(s + 0.3, 3))}
                className="rounded-full bg-white/15 p-2.5 text-white hover:bg-white/30 transition-colors shadow-lg"
                title="Zoom In"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(s - 0.3, 0.7))}
                className="rounded-full bg-white/15 p-2.5 text-white hover:bg-white/30 transition-colors shadow-lg"
                title="Zoom Out"
              >
                <ZoomOut className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => downloadImageDataUrl(previewImageUrl, "topper-handwritten-note.png")}
                className="rounded-full bg-emerald-600 p-2.5 text-white hover:bg-emerald-500 transition-colors shadow-lg"
                title="Download Image"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewImageUrl(null);
                  setZoomScale(1);
                }}
                className="rounded-full bg-red-600/80 p-2.5 text-white hover:bg-red-500 transition-colors shadow-lg"
                title="Close Preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex max-h-[88vh] max-w-[94vw] items-center justify-center overflow-auto rounded-2xl p-2">
              <img
                src={previewImageUrl}
                alt="Handwritten Note Full View"
                style={{ transform: `scale(${zoomScale})` }}
                className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-200"
              />
            </div>
          </div>,
          document.body
        )}

      {open && (
        <div className="fixed inset-x-2 bottom-20 z-50 flex h-[82vh] max-h-[660px] flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-2xl backdrop-blur-2xl transition-all duration-300 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border/80 bg-gradient-to-r from-primary/20 via-primary/10 to-indigo-500/10 px-3.5 py-3">
            <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-tr from-primary to-indigo-600 ring-2 ring-primary/30">
              <img src={avatarSrc} alt="Topper AI" className="h-full w-full object-cover" />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-foreground">Topper AI</span>
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  PRO ✨
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>NCERT Tutor</span>
                <span className="text-[10px] font-medium text-amber-500">· 24h Auto-Expiry 🕒</span>
                {isPro ? (
                  <ProChip />
                ) : quota.data ? (
                  <button
                    type="button"
                    onClick={() => nav({ to: "/pricing" })}
                    className="font-medium text-amber-500 underline decoration-dotted hover:text-amber-400"
                  >
                    {quota.data.remaining} free left
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowThreads((v) => !v)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Chat History"
              >
                <History className="h-4 w-4" />
              </button>
              {handwrittenUrls.length > 0 && (
                <button
                  onClick={exportAllHandwrittenPdf}
                  disabled={pdfBusy}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
                  title="Download All Handwritten Pages PDF"
                >
                  <FileDown className="h-4 w-4 text-primary" />
                </button>
              )}
              <button
                onClick={startNewThread}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="New Chat"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* History Drawer */}
          {showThreads && (
            <div className="max-h-56 overflow-y-auto border-b border-border bg-muted/40 p-2.5 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>Saved Chat Threads</span>
                <span className="text-[10px] font-normal lowercase text-amber-500">
                  🕒 Auto-deletes after 24 hours
                </span>
              </div>
              {(threads.data ?? []).length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">No saved chats yet.</div>
              )}
              {(threads.data ?? []).map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    t.id === threadId
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setThreadId(t.id);
                      setShowThreads(false);
                    }}
                    className="flex-1 truncate text-left"
                  >
                    {t.title}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteChatThread({ data: { threadId: t.id } }).catch(() => {});
                      if (t.id === threadId) {
                        setThreadId(null);
                        setMessages([INTRO]);
                      }
                      qc.invalidateQueries({ queryKey: ["ai-chat-threads"] });
                    }}
                    className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages Container */}
          <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-3.5 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`relative max-w-[94%] rounded-2xl px-3.5 py-2.5 shadow-sm transition-all ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground font-medium rounded-br-xs"
                      : "border border-border/80 bg-muted/70 text-foreground backdrop-blur-sm rounded-bl-xs"
                  }`}
                >
                  {/* Handwritten Image Card */}
                  {m.image_url ? (
                    <div className="mb-2 overflow-hidden rounded-xl border border-primary/30 bg-background p-1.5 shadow-md">
                      <button
                        type="button"
                        onClick={() => setPreviewImageUrl(m.image_url!)}
                        className="group relative block w-full overflow-hidden rounded-lg bg-muted text-left focus:outline-none"
                      >
                        <img
                          src={m.image_url}
                          alt="Handwritten NCERT Page"
                          className="max-h-80 w-full object-contain transition-transform duration-300 group-hover:scale-102"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                            <Maximize2 className="h-3.5 w-3.5" />
                            Click to View Full Image
                          </span>
                        </div>
                      </button>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 px-1">
                        <span className="text-[11px] font-semibold text-primary">✍️ Handwritten Page</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              downloadImageDataUrl(m.image_url!, `topper-handwritten-note-${i}.png`)
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400 transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download PNG
                          </button>
                          <button
                            type="button"
                            disabled={pdfBusy}
                            onClick={() => exportMessagePdf(m, i)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            {pdfBusy ? "Preparing..." : "Export PDF"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Message Content (Parsed Markdown + KaTeX) */}
                  {m.role === "assistant" ? <Latex>{m.content}</Latex> : m.content}

                  {/* Action Bar under Assistant Messages */}
                  {m.role === "assistant" && i > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(m.content, i)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
                        >
                          {copiedIdx === i ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedIdx === i ? "Copied" : "Copy"}
                        </button>

                        <button
                          type="button"
                          disabled={pdfBusy}
                          onClick={() => exportMessagePdf(m, i)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <FileDown className="h-3 w-3 text-indigo-500" />
                          Export PDF
                        </button>
                      </div>

                      {!m.image_url && (
                        <button
                          type="button"
                          onClick={() => runHandwriting("notes", m.content)}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <PenLine className="h-3 w-3" />
                          ✍️ Convert to Handwritten Page
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Quick Prompts */}
            {messages.length === 1 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Quick High-Yield NCERT Prompts:
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {QUICK_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => submitText(qp.query)}
                      className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/40 transition-colors"
                    >
                      <span>{qp.label}</span>
                      <Send className="h-3 w-3 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/80 px-3.5 py-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Topper AI is writing NCERT response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitText(input);
            }}
            className="relative flex items-center gap-2 border-t border-border/80 bg-card p-3"
          >
            {/* Handwriting Options Popup */}
            {penOpen && (
              <div className="absolute bottom-16 left-3 z-10 w-64 overflow-hidden rounded-2xl border border-primary/30 bg-popover/95 p-1 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2 text-xs font-bold text-foreground">
                  <PenLine className="h-3.5 w-3.5 text-primary" />
                  Handwritten Page Generator
                </div>
                <button
                  type="button"
                  onClick={() => runHandwriting("notes")}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  ✍️ **Handwritten Notes Page**
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Converts input or topic into lined notebook notes
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => runHandwriting("solution")}
                  className="block w-full rounded-xl px-3 py-2.5 text-left text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  📄 **Handwritten Worked Solution**
                  <div className="text-[10px] text-muted-foreground font-normal">
                    Step-by-step NCERT solution in blue ink handwriting
                  </div>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPenOpen((v) => !v)}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-all ${
                penOpen
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Generate Handwritten Page"
            >
              <PenLine className="h-4 w-4" />
            </button>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type /generate handwritten image [topic] or ask doubt..."
              className="min-w-0 flex-1 rounded-full border border-input bg-background/80 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />

            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-40 transition-transform active:scale-95"
              title="Send Message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Trigger FAB Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary via-indigo-600 to-primary/80 text-primary-foreground shadow-2xl shadow-primary/40 ring-4 ring-primary/20 transition-all duration-300 hover:scale-108 active:scale-95 sm:bottom-6 sm:right-6"
        aria-label="Open Topper AI"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative h-full w-full">
            <img src={avatarSrc} alt="Topper AI" className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
        )}
      </button>
    </>
  );
}
