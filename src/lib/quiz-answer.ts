export const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export type OptionKey = (typeof OPTION_KEYS)[number];
export type QuizAnswer = string;
export type QuizOptions = Record<OptionKey, string> & { __correct?: string; __mode?: string };

export function hasUsableOptions(options: unknown): options is QuizOptions {
  if (!options || typeof options !== "object") return false;
  const row = options as Partial<Record<OptionKey, unknown>>;
  return OPTION_KEYS.every((key) => typeof row[key] === "string" && row[key]!.trim().length > 0);
}

export function getCorrectOptionLetters(correct: unknown): OptionKey[] {
  const raw = String(correct ?? "").trim().toUpperCase();
  if (!raw) return [];

  const compact = raw.replace(/\bAND\b/g, "").replace(/[\s,;|+&/]/g, "").replace(/[()]/g, "");
  if (/^[ABCD]+$/.test(compact)) {
    return Array.from(new Set(compact.split(""))) as OptionKey[];
  }

  const labelled = raw.match(/(?:ANSWER|ANS|OPTION|CORRECT)\s*[:\-]?\s*([ABCD])\b/);
  if (labelled) return [labelled[1] as OptionKey];

  return [];
}

export function normalizeChoiceAnswer(answer: unknown): string {
  const letters = getCorrectOptionLetters(answer);
  return letters.length ? letters.sort().join("") : "";
}

export function isMultiCorrect(correct: unknown): boolean {
  return getCorrectOptionLetters(correct).length > 1;
}

export function getEffectiveCorrect(options: unknown, fallbackCorrect: unknown): string {
  if (options && typeof options === "object") {
    const metadata = (options as { __correct?: unknown }).__correct;
    if (metadata !== null && metadata !== undefined && String(metadata).trim()) {
      return String(metadata).trim();
    }
  }
  return String(fallbackCorrect ?? "").trim();
}

export function isNumericQuestion(options: unknown, correct: unknown): boolean {
  return !hasUsableOptions(options) || getCorrectOptionLetters(correct).length === 0;
}

function parsePlainNumber(value: unknown): number | null {
  const text = String(value ?? "")
    .trim()
    .replace(/,/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function normalizeTextAnswer(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\.0+$/, "");
}

export function isCorrectQuizAnswer(answer: unknown, correct: unknown): boolean {
  const correctLetters = normalizeChoiceAnswer(correct);
  if (correctLetters) return normalizeChoiceAnswer(answer) === correctLetters;

  const answerNumber = parsePlainNumber(answer);
  const correctNumber = parsePlainNumber(correct);
  if (answerNumber !== null && correctNumber !== null) {
    return Math.abs(answerNumber - correctNumber) <= Math.max(1e-6, Math.abs(correctNumber) * 1e-6);
  }

  return normalizeTextAnswer(answer) === normalizeTextAnswer(correct);
}

export function toggleOptionAnswer(current: unknown, letter: OptionKey, multi: boolean): string | null {
  if (!multi) return letter;
  const selected = new Set(getCorrectOptionLetters(current));
  if (selected.has(letter)) selected.delete(letter);
  else selected.add(letter);
  const next = OPTION_KEYS.filter((key) => selected.has(key)).join("");
  return next || null;
}
