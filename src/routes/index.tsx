import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Latex } from "@/components/Latex";
import logoAsset from "@/assets/logo.png";
import {
  GraduationCap,
  Brain,
  Trophy,
  Swords,
  Zap,
  Sparkles,
  Flame,
  Target,
  CheckCircle2,
  ArrowRight,
  BookMarked,
  ShieldCheck,
  Star,
  Users,
  ChevronDown,
  Repeat2,
  BookOpen,
  Award,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Last Topper — #1 AI Coach & Battle Arena for JEE & NEET" },
      {
        name: "description",
        content:
          "Master IIT-JEE (PCM) and NEET (PCB) with NCERT AI practice, 1v1 live quiz battles, mistake bank, and Sunday Mega Test. Beat your last self.",
      },
      { property: "og:title", content: "Last Topper — #1 AI Coach & Battle Arena for JEE & NEET" },
      {
        property: "og:description",
        content: "NCERT AI questions, 1v1 live quiz battles, mistake bank, and Sunday Mega Test.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [selectedExam, setSelectedExam] = useState<"neet" | "jee">("neet");
  const [demoSelectedOption, setDemoSelectedOption] = useState<string | null>(null);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        navigate({ to: "/home", replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-5 w-5 animate-spin text-primary" /> Loading Last Topper…
        </div>
      </div>
    );
  }

  const sampleQuestions = {
    neet: {
      question: "Which of the following cellular organelles is known as the 'Powerhouse of the Cell' and possesses its own circular DNA?",
      options: {
        A: "Endoplasmic Reticulum",
        B: "Mitochondria",
        C: "Golgi Apparatus",
        D: "Lysosome",
      },
      correct: "B",
      explanation: "Mitochondria generate ATP via oxidative phosphorylation and contain 70S ribosomes along with single circular DNA molecules, supporting the endosymbiotic theory.",
    },
    jee: {
      question: "For a projectile launched at an angle $\\theta = 45^\\circ$ with initial velocity $u$, what is the maximum height $H$ reached in terms of $g$?",
      options: {
        A: "$H = \\frac{u^2}{2g}$",
        B: "$H = \\frac{u^2}{4g}$",
        C: "$H = \\frac{u^2}{g}$",
        D: "$H = \\frac{2u^2}{g}$",
      },
      correct: "B",
      explanation: "Maximum height formula is $H = \\frac{u^2 \\sin^2 \\theta}{2g}$. Substituting $\\sin(45^\\circ) = \\frac{1}{\\sqrt{2}}$, we get $H = \\frac{u^2 (1/2)}{2g} = \\frac{u^2}{4g}$.",
    },
  };

  const activeSample = sampleQuestions[selectedExam];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl shadow-md shadow-primary/20 ring-1 ring-border">
              <img src={logoAsset} alt="Last Topper" className="h-full w-full object-cover" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight">Last Topper</span>
              <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                AI Coach 2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="text-xs font-semibold sm:text-sm">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full bg-primary font-semibold text-primary-foreground shadow-lg shadow-primary/25">
              <Link to="/auth">Start Practice Free 🚀</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
        <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-primary/30 via-purple-500/20 to-pink-500/10 blur-[120px]" />

        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          {/* Trust Pill */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary shadow-inner">
            <Flame className="h-4 w-4 text-orange-500 animate-pulse" />
            <span>Over 100,000+ NCERT Questions Solved This Week</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Stop Studying Blindly. <br />
            <span className="bg-gradient-to-r from-primary via-indigo-500 to-purple-500 bg-clip-text text-transparent">
              Master JEE & NEET with AI Precision.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-xl leading-relaxed">
            Instant NCERT-aligned AI questions, 1v1 live quiz battles, automatic mistake tracking, and Sunday Mega contests. <strong className="text-foreground font-semibold">Beat your last self every single day.</strong>
          </p>

          {/* Exam Badges Selection */}
          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedExam("neet")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                selectedExam === "neet"
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400"
                  : "border border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <Award className="h-4 w-4" />
              NEET-UG (PCB) NCERT
            </button>
            <button
              type="button"
              onClick={() => setSelectedExam("jee")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
                selectedExam === "jee"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400"
                  : "border border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <Zap className="h-4 w-4" />
              IIT-JEE (PCM) Main & Adv
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="h-12 w-full sm:w-auto rounded-full px-8 text-base font-bold shadow-xl shadow-primary/25">
              <Link to="/auth">
                Start Free NCERT Practice <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 w-full sm:w-auto rounded-full border-border bg-card/80 px-8 text-base font-semibold hover:bg-accent">
              <Link to="/auth">
                <Swords className="mr-2 h-5 w-5 text-indigo-500" /> Join Live 1v1 Battle
              </Link>
            </Button>
          </div>

          {/* Value props bullets */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 100% Free Daily Quota</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Official Class 11 & 12 NCERT</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No Credit Card Required</span>
          </div>
        </div>
      </section>

      {/* Interactive Sample Question Demo Card */}
      <section className="border-y border-border/80 bg-muted/20 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Interactive Demo
            </span>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Test Your Knowledge Right Now</h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Click an option below to see instant AI step-by-step verification.</p>
          </div>

          <div className="mantis-card overflow-hidden p-6 sm:p-8">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="uppercase tracking-wider">Exam: {selectedExam.toUpperCase()} · Chapter Practice</span>
              <span className="inline-flex items-center gap-1 text-primary"><Brain className="h-4 w-4" /> AI Verified</span>
            </div>

            <div className="mt-4 text-base font-semibold leading-relaxed sm:text-lg">
              <Latex>{activeSample.question}</Latex>
            </div>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {(["A", "B", "C", "D"] as const).map((key) => {
                const isSelected = demoSelectedOption === key;
                const isCorrect = key === activeSample.correct;
                let btnStyle = "border-border/80 bg-card hover:border-primary/50 hover:bg-accent/50";
                if (demoSelectedOption) {
                  if (isCorrect) btnStyle = "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold ring-1 ring-emerald-500";
                  else if (isSelected) btnStyle = "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium";
                }

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDemoSelectedOption(key)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${btnStyle}`}
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {key}
                    </span>
                    <span className="text-sm"><Latex>{activeSample.options[key]}</Latex></span>
                  </button>
                );
              })}
            </div>

            {demoSelectedOption && (
              <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <Brain className="h-4 w-4" /> AI Explanation:
                </div>
                <div className="mt-1 text-foreground/90 leading-relaxed">
                  <Latex>{activeSample.explanation}</Latex>
                </div>
                <div className="mt-4">
                  <Button asChild size="sm" className="rounded-xl font-bold">
                    <Link to="/auth">Practice 1,000+ Similar Questions Free →</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything You Need to Topple the Competition
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Designed specifically for high-yield JEE & NEET preparation. Replaces expensive test series and unguided cramming.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Brain className="h-6 w-6 text-indigo-500" />}
              badge="NCERT AI 2.0"
              title="Instant AI Question Generator"
              body="Generate unlimited NCERT Class 11 & 12 MCQs on any specific chapter or topic. Strictly zero out-of-syllabus questions."
            />
            <FeatureCard
              icon={<Swords className="h-6 w-6 text-fuchsia-500" />}
              badge="Live Arena"
              title="1v1 Real-Time Battles"
              body="Challenge friends or live online aspirants across India in timed 10-question speed duels. Real-time rank calculation."
            />
            <FeatureCard
              icon={<Target className="h-6 w-6 text-rose-500" />}
              badge="Spaced Repetition"
              title="Automated Mistake Bank"
              body="Every incorrect answer is logged automatically. Re-test yourself until your accuracy on hard concepts reaches 100%."
            />
            <FeatureCard
              icon={<Trophy className="h-6 w-6 text-amber-500" />}
              badge="Weekly Cash & Pro"
              title="Sunday Mega Test"
              body="Compete every Sunday in national mock tests. Top rankers earn Pro subscriptions and badge recognition."
            />
            <FeatureCard
              icon={<BookMarked className="h-6 w-6 text-emerald-500" />}
              badge="NCERT Summaries"
              title="Crisp Topic Revise Notes"
              body="High-yield NCERT formula sheets, reaction maps, and biological diagrams for quick 5-minute daily revision."
            />
            <FeatureCard
              icon={<Award className="h-6 w-6 text-sky-500" />}
              badge="10+ Years PYQs"
              title="Chapter-wise Past Papers"
              body="Practice previous year questions from NEET (1998-2025) and JEE Main/Advanced with detailed step-by-step solutions."
            />
          </div>
        </div>
      </section>

      {/* Social Proof / Stats Ticker */}
      <section className="border-y border-border/70 bg-card py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <StatTile number="100,000+" label="NCERT Questions" />
            <StatTile number="98.8%" label="NCERT Alignment" />
            <StatTile number="24 / 7" label="Instant AI Tutoring" />
            <StatTile number="4.9 ★" label="Aspirant Rating" />
          </div>
        </div>
      </section>

      {/* Student Testimonials */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">What Aspirants Say</h2>
            <p className="mt-2 text-sm text-muted-foreground">Real feedback from NEET & JEE toppers using Last Topper daily.</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <TestimonialCard
              quote="The Mistake Bank saved my Chemistry prep. Being able to review only the questions I got wrong cut my revision time by half."
              author="Aarav Sharma"
              tag="NEET 2026 Aspirant (680+ Mock Score)"
            />
            <TestimonialCard
              quote="1v1 battles made solving Physics numericals actually fun and addicting! Competing with live opponents improved my speed tremendously."
              author="Rohan Verma"
              tag="JEE Main 2026 aspirant (99.2%ile in mocks)"
            />
            <TestimonialCard
              quote="The AI explanation feature is incredible. It explains NCERT Biology diagrams step-by-step better than any textbook answer key."
              author="Priya Patel"
              tag="NEET 2026 Aspirant"
            />
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="border-t border-border/80 bg-muted/20 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
            <p className="mt-2 text-sm text-muted-foreground">Got questions? We've got answers.</p>
          </div>

          <div className="mt-10 space-y-3">
            <FaqItem
              index={1}
              open={faqOpen === 1}
              onToggle={() => setFaqOpen(faqOpen === 1 ? null : 1)}
              q="Is Last Topper free to use?"
              a="Yes! Last Topper provides 20 free questions per day for practice along with free 1v1 battle access, mistake bank tracking, and Sunday Mega Test participation. You can optionally upgrade to Pro for unlimited questions."
            />
            <FaqItem
              index={2}
              open={faqOpen === 2}
              onToggle={() => setFaqOpen(faqOpen === 2 ? null : 2)}
              q="Are questions strictly from the official NCERT syllabus?"
              a="100% yes. Our AI model is strictly instructed and verified against official Class 11 & 12 NCERT textbooks for NEET (Physics, Chemistry, Biology) and JEE (Physics, Chemistry, Math)."
            />
            <FaqItem
              index={3}
              open={faqOpen === 3}
              onToggle={() => setFaqOpen(faqOpen === 3 ? null : 3)}
              q="How do 1v1 battles and Sunday Mega Tests work?"
              a="1v1 battles match you in real time with another student for a 10-question speed duel. Sunday Mega Test is a national weekly contest where top rankers earn Pro subscriptions."
            />
            <FaqItem
              index={4}
              open={faqOpen === 4}
              onToggle={() => setFaqOpen(faqOpen === 4 ? null : 4)}
              q="How does the Mistake Bank help me improve?"
              a="Every question you answer incorrectly is automatically added to your Mistake Bank with spaced repetition intervals. Re-testing yourself on your weaknesses ensures you never repeat mistakes in the real exam."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Ready to Top Your Next Exam?</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            Join thousands of JEE & NEET aspirants practicing smarter today. It takes less than 10 seconds to get started.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="secondary" className="h-12 rounded-full px-8 text-base font-bold shadow-2xl">
              <Link to="/auth">Create Free Account 🚀</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10 text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img src={logoAsset} alt="Last Topper" className="h-6 w-6 rounded-md object-cover" />
            <span className="font-bold text-foreground">Last Topper</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link to="/refund" className="hover:text-foreground">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  badge,
  title,
  body,
}: {
  icon: React.ReactNode;
  badge: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mantis-card group relative p-6 transition-all hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 transition-transform group-hover:scale-110">
          {icon}
        </div>
        <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          {badge}
        </span>
      </div>
      <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function StatTile({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-black tracking-tight text-primary sm:text-4xl">{number}</div>
      <div className="mt-1 text-xs font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function TestimonialCard({ quote, author, tag }: { quote: string; author: string; tag: string }) {
  return (
    <div className="mantis-card flex flex-col justify-between p-6">
      <div>
        <div className="flex text-amber-400 gap-0.5">
          <Star className="h-4 w-4 fill-current" />
          <Star className="h-4 w-4 fill-current" />
          <Star className="h-4 w-4 fill-current" />
          <Star className="h-4 w-4 fill-current" />
          <Star className="h-4 w-4 fill-current" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-foreground/90 italic">"{quote}"</p>
      </div>
      <div className="mt-6 border-t border-border/60 pt-3">
        <div className="text-sm font-bold text-foreground">{author}</div>
        <div className="text-[11px] text-muted-foreground">{tag}</div>
      </div>
    </div>
  );
}

function FaqItem({
  index,
  open,
  onToggle,
  q,
  a,
}: {
  index: number;
  open: boolean;
  onToggle: () => void;
  q: string;
  a: string;
}) {
  return (
    <div className="mantis-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left text-sm font-bold transition-colors hover:bg-accent/40"
      >
        <span>{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180 text-primary" : "text-muted-foreground"}`} />
      </button>
      {open && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}
