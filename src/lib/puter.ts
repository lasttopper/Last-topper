/**
 * Puter.js Integration Module for Last Topper
 * Internal fallback helpers for offline question generation and text completions.
 * Never triggers Puter login modals or client auth popups.
 */

import { getStaticFallbackQuestions } from "@/lib/static-questions";
import { getOfflineAssistantResponse } from "@/lib/topper-ai-fallback";

export interface PuterQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: "A" | "B" | "C" | "D";
  hint: string;
  explanation: string;
}

/** Always false so browser client never opens Puter.js sign-in popups */
export function isPuterClientAvailable(): boolean {
  return false;
}

/**
 * Generates chat completions fallback without requiring Puter account login.
 */
export async function puterAiChat(
  messages: Array<{ role: string; content: string }>,
  _model: string = "gpt-4o-mini"
): Promise<string> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  return getOfflineAssistantResponse(lastUserMsg);
}

/**
 * Generates an image using Puter / Pollinations AI image models without requiring Puter account login.
 */
export async function puterGenerateImage(prompt: string): Promise<string> {
  const seed = Math.floor(Math.random() * 900000) + 100000;
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
  return pollinationsUrl;
}

/**
 * Generates NCERT-only questions fallback for PCM/PCB.
 */
export async function puterGenerateQuestions(
  profession: string,
  chapterNames: string[],
  count: number
): Promise<PuterQuestion[]> {
  const subject = profession === "pcm" ? "physics" : "biology";
  const staticList = getStaticFallbackQuestions(subject, count);
  return staticList.map((q) => ({
    question: q.question,
    options: q.options,
    correct: q.correct,
    hint: q.hint || "Review the core NCERT textbook concepts.",
    explanation: q.explanation || "Based on standard NCERT syllabus formulas.",
  }));
}
