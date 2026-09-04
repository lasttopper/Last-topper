import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp, startNativeGoogleSignIn } from "@/lib/native-auth";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { GraduationCap, Mail, Loader2, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Last Topper" },
      { name: "description", content: "Sign in to Last Topper with Google or an email sign-in link and start practicing for JEE & NEET." },
      { property: "og:title", content: "Sign in — Last Topper" },
      { property: "og:description", content: "Sign in to Last Topper with Google or email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();

  const [googleLoading, setGoogleLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Email state
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const goAfterAuth = async (userId?: string | null) => {
      const target = await getPostAuthRedirectPath(userId);
      if (!cancelled) navigate({ to: target, replace: true });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goAfterAuth(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void goAfterAuth(session.user.id);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      if (await isNativeApp()) {
        await startNativeGoogleSignIn();
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              access_type: "offline",
              prompt: "consent",
            },
          },
        });
        if (error) {
          toast.error(error.message || "Failed to sign in with Google.");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to Google. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verified`,
          shouldCreateUser: true,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setEmailSent(true);
        toast.success("Sign-in link sent! Check your inbox.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send sign-in link.");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex h-16 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome to Last Topper</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to start practicing for IIT-JEE &amp; NEET
          </p>
        </div>

        {/* Primary Auth: Google Sign-In */}
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="relative flex h-12 w-full items-center justify-center gap-3 rounded-xl border-border bg-card font-medium text-foreground shadow-sm transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.99]"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            <span className="text-sm font-semibold">
              {googleLoading ? "Connecting to Google…" : "Continue with Google"}
            </span>
          </Button>

          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Instant 1-click sign in
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Free practice
            </span>
          </div>

          {/* Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full border-t border-border" />
            <span className="absolute bg-background px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              or
            </span>
          </div>

          {/* Email sign-in link section */}
          {!showEmailForm ? (
            <Button
              variant="ghost"
              size="default"
              onClick={() => setShowEmailForm(true)}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground border border-border/60 hover:bg-accent hover:text-foreground rounded-xl"
            >
              <Mail className="h-4 w-4 text-indigo-500" />
              Sign in with Email Link
            </Button>
          ) : (
            <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-indigo-500" />
                  Email Sign-in Link
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(false);
                    setEmailSent(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Close
                </button>
              </div>

              {emailSent ? (
                <div className="text-center py-2 space-y-2">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ✉️ Sign-in link sent to {email}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Click the link in your email inbox to log in instantly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleEmailSignIn} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailBusy}
                    required
                  />
                  <Button type="submit" disabled={emailBusy} className="w-full" size="default">
                    {emailBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {emailBusy ? "Sending link…" : "Send Sign-in Link"}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="/terms" className="underline hover:text-foreground">Terms</a> and{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
