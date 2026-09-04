import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseOAuthCallback } from "@/lib/native-auth";
import { getPostAuthRedirectPath, type PostAuthRedirectPath } from "@/lib/post-auth-redirect";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/verified")({
  head: () => ({
    meta: [
      { title: "Email verified — Last Topper" },
      { name: "description", content: "Your Last Topper sign-in link has been verified." },
      { property: "og:title", content: "Email verified — Last Topper" },
      { property: "og:description", content: "Your Last Topper sign-in link has been verified." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: VerifiedPage,
});

function VerifiedPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "ok" | "fail">("working");
  const [redirectTarget, setRedirectTarget] = useState<PostAuthRedirectPath>("/home");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finishSignIn = async (userId?: string | null) => {
      const target = await getPostAuthRedirectPath(userId);
      if (cancelled) return;
      setRedirectTarget(target);
      setStatus("ok");
      timer = setTimeout(() => navigate({ to: target, replace: true }), 1200);
    };

    void (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const get = (k: string) => url.searchParams.get(k) ?? hash.get(k);

      // 1) Tokens delivered directly in the URL (implicit flow).
      const parsed = parseOAuthCallback(window.location.href);
      if (parsed && !parsed.error) {
        const { data, error } = await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
        if (!error) {
          await finishSignIn(data.user?.id);
          return;
        }
      }

      // 2) One-time email token (works even when opened in another browser).
      const tokenHash = get("token_hash") ?? get("token");
      const type = get("type");
      if (tokenHash && type) {
        const { data, error } = await supabase.auth.verifyOtp({
          type: type as any,
          token_hash: tokenHash,
        });
        if (!error) {
          await finishSignIn(data.user?.id);
          return;
        }
      }

      // 3) PKCE code exchange.
      const code = get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          await finishSignIn(data.session?.user.id ?? data.user?.id);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await finishSignIn(data.session.user.id);
      } else {
        setStatus("fail");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [navigate]);

  const targetLabel = redirectTarget === "/register" ? "registration" : "dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card/80 p-8 text-center shadow-lg backdrop-blur-md">
        {status === "working" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Verifying your sign-in link…</p>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="mt-4 text-xl font-semibold">Sign-in successful</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Redirecting you to Last Topper {targetLabel}…
            </p>
            <Button
              className="mt-6 w-full"
              onClick={() => navigate({ to: redirectTarget, replace: true })}
            >
              Continue to {targetLabel === "registration" ? "Registration" : "Dashboard"}
            </Button>
          </>
        )}
        {status === "fail" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Link expired or invalid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This sign-in link is invalid or expired. Please request a new sign-in link.
            </p>
            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Back to Sign In
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
