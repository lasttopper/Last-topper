import { useState, useEffect } from "react";
import { Youtube, Send, ExternalLink, CheckCircle2, Lock, Sparkles, X, ShieldCheck, PlayCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Sub2UnlockConfig = {
  enabled: boolean;
  monetag_direct_link: string;
  monetag_script_id?: string;
  youtube_sub_url: string;
  telegram_channel_url: string;
  timer_seconds: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  config: Sub2UnlockConfig;
  megaTestId: string;
  onCompleteRegistration: () => Promise<void>;
  isRegistering: boolean;
};

export function SundayMegaUnlockModal({
  isOpen,
  onClose,
  config,
  megaTestId,
  onCompleteRegistration,
  isRegistering,
}: Props) {
  const timerSec = Math.max(3, config.timer_seconds || 10);
  const storageKey = `sub2unlock_mega_${megaTestId}`;

  // Step completion states
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [step3Done, setStep3Done] = useState(false);

  // Active timers
  const [activeTimerStep, setActiveTimerStep] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // Load saved progress
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step1) setStep1Done(true);
        if (parsed.step2) setStep2Done(true);
        if (parsed.step3) setStep3Done(true);
      }
    } catch (e) {
      console.error(e);
    }
  }, [isOpen, storageKey]);

  // Save progress
  const markStepDone = (stepNum: number) => {
    let s1 = step1Done;
    let s2 = step2Done;
    let s3 = step3Done;

    if (stepNum === 1) { setStep1Done(true); s1 = true; }
    if (stepNum === 2) { setStep2Done(true); s2 = true; }
    if (stepNum === 3) { setStep3Done(true); s3 = true; }

    try {
      localStorage.setItem(storageKey, JSON.stringify({ step1: s1, step2: s2, step3: s3 }));
    } catch (e) {
      console.error(e);
    }
  };

  // Timer countdown handler
  useEffect(() => {
    if (activeTimerStep === null || countdown <= 0) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          markStepDone(activeTimerStep);
          setActiveTimerStep(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimerStep, countdown]);

  if (!isOpen) return null;

  const totalCompleted = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);
  const isAllDone = step1Done && step2Done && step3Done;
  const progressPercent = Math.round((totalCompleted / 3) * 100);

  const startStepAction = (stepNum: number, targetUrl: string) => {
    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
    setActiveTimerStep(stepNum);
    setCountdown(timerSec);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 overflow-hidden">
        {/* Top Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-500">
            <Sparkles className="h-3.5 w-3.5" /> Sunday Mega Test Gate
          </div>
          <h2 className="text-xl font-bold tracking-tight">Unlock Test Registration</h2>
          <p className="text-xs text-muted-foreground">
            Complete the 3 quick steps below to verify your entry for this Sunday's national contest.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Step Progress</span>
            </span>
            <span className="font-bold text-primary">{totalCompleted} / 3 Completed ({progressPercent}%)</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-primary to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {/* Step 1: YouTube */}
          <div className={`rounded-xl border p-3.5 transition-all ${
            step1Done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card hover:border-border/80"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500">
                  <Youtube className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    Step 1: Subscribe YouTube Channel
                    {step1Done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Subscribe to Last Topper channel for exam alerts
                  </p>
                </div>
              </div>

              {step1Done ? (
                <span className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Done
                </span>
              ) : activeTimerStep === 1 ? (
                <div className="shrink-0 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Verifying ({countdown}s)</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  className="shrink-0 text-xs font-semibold"
                  onClick={() => startStepAction(1, config.youtube_sub_url)}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Subscribe
                </Button>
              )}
            </div>
          </div>

          {/* Step 2: Monetag Sponsored Ad */}
          <div className={`rounded-xl border p-3.5 transition-all ${
            step2Done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card hover:border-border/80"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
                  <PlayCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    Step 2: Visit Partner Link (Monetag Ad)
                    {step2Done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Visit sponsor ad link for 10 seconds
                  </p>
                </div>
              </div>

              {step2Done ? (
                <span className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Done
                </span>
              ) : activeTimerStep === 2 ? (
                <div className="shrink-0 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Verifying ({countdown}s)</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                  onClick={() => startStepAction(2, config.monetag_direct_link)}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Visit Sponsor
                </Button>
              )}
            </div>
          </div>

          {/* Step 3: Telegram */}
          <div className={`rounded-xl border p-3.5 transition-all ${
            step3Done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card hover:border-border/80"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
                  <Send className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    Step 3: Join Telegram Community
                    {step3Done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Join Telegram for instant test updates & solutions
                  </p>
                </div>
              </div>

              {step3Done ? (
                <span className="shrink-0 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Done
                </span>
              ) : activeTimerStep === 3 ? (
                <div className="shrink-0 flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Verifying ({countdown}s)</span>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold"
                  onClick={() => startStepAction(3, config.telegram_channel_url)}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Join Telegram
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Final Register CTA */}
        <div className="pt-2">
          <Button
            size="lg"
            className={`w-full font-bold text-sm h-12 shadow-lg transition-all ${
              isAllDone
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25 ring-2 ring-emerald-400"
                : "opacity-60 cursor-not-allowed"
            }`}
            disabled={!isAllDone || isRegistering}
            onClick={async () => {
              if (isAllDone && !isRegistering) {
                await onCompleteRegistration();
              }
            }}
          >
            {isRegistering ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Registering Entry...
              </span>
            ) : isAllDone ? (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> UNLOCK & REGISTER NOW
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Complete All 3 Steps Above to Register
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
