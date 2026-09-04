import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  GraduationCap,
  Atom,
  Dna,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { saveSignupDetails, setProfession, completeOnboarding } from "@/lib/user.functions";
import { applyReferralCode } from "@/lib/referral.functions";
import { getPendingReferral, clearPendingReferral } from "@/lib/referral-link";
import { useUserStore, type Profession } from "@/store/user";
import { failMessage } from "@/lib/friendly-error";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      throw redirect({ to: "/auth" });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("onboarded, phone, profession")
      .eq("id", data.user.id)
      .maybeSingle();

    const onboardingComplete = Boolean(profile?.onboarded && profile?.phone && profile?.profession);
    if (onboardingComplete) {
      throw redirect({ to: "/home" });
    }

    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Student Registration — Last Topper" },
      { name: "description", content: "Complete your one-time registration for Last Topper." },
    ],
  }),
  component: RegisterPage,
});

const DRAFT_KEY = "last_topper_external_registration_draft";

type RegistrationDraft = {
  step: "details" | "profession" | "success";
  fullName: string;
  dob: string;
  phone: string;
  refCode: string;
  acceptTerms: boolean;
  prof: Profession | null;
};

function loadDraft(): Partial<RegistrationDraft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(draft: RegistrationDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* silent */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* silent */
  }
}

function RegisterPage() {
  const navigate = useNavigate();
  const patch = useUserStore((s) => s.patchProfile);
  const profile = useUserStore((s) => s.profile);

  const initialDraft = loadDraft();

  const [step, setStep] = useState<"details" | "profession" | "success">(
    () => initialDraft?.step ?? "details"
  );

  const [fullName, setFullName] = useState<string>(
    () => initialDraft?.fullName ?? profile?.full_name ?? ""
  );
  const [dob, setDob] = useState<string>(() => initialDraft?.dob ?? "");
  const [phone, setPhone] = useState<string>(
    () => initialDraft?.phone ?? profile?.phone ?? ""
  );
  const [acceptTerms, setAcceptTerms] = useState<boolean>(
    () => initialDraft?.acceptTerms ?? false
  );
  const [prof, setProf] = useState<Profession | null>(
    () => initialDraft?.prof ?? profile?.profession ?? null
  );
  const [refCode, setRefCode] = useState<string>(
    () => initialDraft?.refCode ?? getPendingReferral()
  );

  const [saving, setSaving] = useState(false);
  const [hasResumedDraft] = useState<boolean>(() => Boolean(initialDraft));

  // Save progress draft on input changes
  useEffect(() => {
    if (step !== "success") {
      saveDraft({ step, fullName, dob, phone, refCode, acceptTerms, prof });
    }
  }, [step, fullName, dob, phone, refCode, acceptTerms, prof]);

  async function submitDetails() {
    if (fullName.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      toast.error("Please enter your date of birth.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!acceptTerms) {
      toast.error("Please accept the Terms & Privacy Policy to continue.");
      return;
    }

    setSaving(true);
    try {
      await saveSignupDetails({
        data: {
          full_name: fullName.trim(),
          phone: cleanPhone,
          country_code: "+91",
          date_of_birth: dob,
          accept_terms: true,
        },
      });
      patch({
        full_name: fullName.trim(),
        phone: cleanPhone,
        country_code: "+91",
        date_of_birth: dob,
      });

      const code = refCode.trim().toUpperCase();
      if (code.length >= 4) {
        try {
          const res = await applyReferralCode({ data: { code } });
          if (res.ok) {
            toast.success("Referral code applied");
            clearPendingReferral();
          }
        } catch (err) {
          toast.error(failMessage(err, "Invalid referral code"));
        }
      }

      setStep("profession");
    } catch (e) {
      console.error(e);
      toast.error(failMessage(e, "Could not save profile details. Try again."));
    } finally {
      setSaving(false);
    }
  }

  async function chooseProfessionAndComplete(p: Profession) {
    setSaving(true);
    try {
      await setProfession({ data: { profession: p } });
      await completeOnboarding();

      patch({ profession: p, onboarded: true });
      setProf(p);
      clearDraft(); // Registration successful, clear draft!

      setStep("success");
      toast.success("Registration Successful!");

      // Fallback redirect to main application after API confirmation
      setTimeout(() => {
        navigate({ to: "/home", replace: true });
      }, 1500);
    } catch (e) {
      console.error(e);
      toast.error(failMessage(e, "Could not complete registration. Try again."));
    } finally {
      setSaving(false);
    }
  }

  const maxDob = new Date(Date.now() - 8 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-primary/15 via-primary/5 to-indigo-500/10 px-6 py-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/25">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Last Topper Student Registration</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete registration to unlock NCERT JEE &amp; NEET practice
          </p>

          {hasResumedDraft && step !== "success" && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Resumed saved registration progress!</span>
            </div>
          )}
        </div>

        {/* Form Container */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <Label className="text-xs font-semibold">Full Name</Label>
                  <Input
                    className="mt-1"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    maxLength={80}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Date of Birth</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={dob}
                    max={maxDob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Mobile Phone Number</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-xs font-medium text-muted-foreground">
                      +91
                    </span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={15}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Referral Code (Optional)</Label>
                  <Input
                    className="mt-1 font-mono uppercase tracking-widest"
                    value={refCode}
                    onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCD1234"
                    maxLength={16}
                  />
                </div>

                <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                  <Checkbox
                    checked={acceptTerms}
                    onCheckedChange={(v) => setAcceptTerms(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      Terms &amp; Conditions
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>

                <Button className="mt-6 w-full" size="lg" onClick={submitDetails} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Details…
                    </>
                  ) : (
                    <>
                      Continue to Track Choice <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {step === "profession" && (
              <motion.div
                key="profession"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center">
                  <h2 className="text-base font-semibold text-foreground">Select Your Target Exam Track</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    This tailors your daily question sets and practice modules.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => chooseProfessionAndComplete("pcm")}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                      prof === "pcm" ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:bg-accent"
                    } disabled:opacity-60`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                      <Atom className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">IIT-JEE — PCM</div>
                      <div className="text-xs text-muted-foreground">Physics · Chemistry · Mathematics</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => chooseProfessionAndComplete("pcb")}
                    className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                      prof === "pcb" ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "border-border hover:bg-accent"
                    } disabled:opacity-60`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                      <Dna className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">NEET — PCB</div>
                      <div className="text-xs text-muted-foreground">Physics · Chemistry · Biology</div>
                    </div>
                  </button>
                </div>

                {saving && (
                  <div className="flex items-center justify-center gap-2 pt-4 text-xs font-semibold text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" /> Completing Registration API Call…
                  </div>
                )}
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center space-y-3"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/10">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Registration Successful!</h2>
                <p className="text-xs text-muted-foreground">
                  Your profile has been saved. Redirecting to Last Topper main app...
                </p>
                <div className="flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-primary">
                  <Sparkles className="h-4 w-4 animate-spin text-amber-500" /> Redirecting now…
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/40 px-6 py-3.5 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified NCERT Learning System
        </div>
      </div>
    </main>
  );
}
