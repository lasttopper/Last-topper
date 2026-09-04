import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

const EXTERNAL_MEGA_REGISTRATION_URL = "https://sub2unlock-topper.vercel.app/mega-register";

export const Route = createFileRoute("/mega-register")({
  head: () => ({
    meta: [
      { title: "Mega Test Registration — Last Topper" },
      { name: "description", content: "Redirecting to the Last Topper Mega Test registration gateway." },
    ],
  }),
  component: MegaRegisterRedirect,
});

function MegaRegisterRedirect() {
  const targetUrl = useMemo(() => {
    if (typeof window === "undefined") return EXTERNAL_MEGA_REGISTRATION_URL;

    const current = new URL(window.location.href);
    const target = new URL(EXTERNAL_MEGA_REGISTRATION_URL);

    current.searchParams.forEach((value, key) => {
      target.searchParams.set(key === "testId" ? "mega_test_id" : key, value);
    });

    if (!target.searchParams.get("return_to")) {
      const returnTo = new URL("/battle/mega", window.location.origin);
      returnTo.searchParams.set("mega_unlocked", "1");
      const testId = target.searchParams.get("mega_test_id");
      if (testId) returnTo.searchParams.set("mega_test_id", testId);
      target.searchParams.set("return_to", returnTo.toString());
    }

    return target.toString();
  }, []);

  useEffect(() => {
    window.location.replace(targetUrl);
  }, [targetUrl]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Opening Mega Test Registration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please wait while we open the secure registration gateway.
        </p>
        <a
          href={targetUrl}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Open registration <ExternalLink className="h-4 w-4" />
        </a>
        <div className="mt-4 text-xs text-muted-foreground">
          <Link to="/battle/mega" className="underline hover:text-foreground">Back to Mega Test</Link>
        </div>
      </div>
    </main>
  );
}
