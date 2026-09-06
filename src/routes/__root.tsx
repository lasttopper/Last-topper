import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  isRedirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { registerPWA } from "@/lib/pwa-register";
import { storeReferralFromUrl } from "@/lib/referral-link";
import { getPostAuthRedirectPath } from "@/lib/post-auth-redirect";
import {
  parseOAuthCallback,
  closeNativeBrowser,
  clearStoredOAuthState,
  nativeRouteFromUrl,
  hideNativeSystemBars,
} from "@/lib/native-auth";

import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppUpdateDialog } from "@/components/AppUpdateDialog";
import { ApkDownloadOverlay } from "@/components/ApkDownloadOverlay";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error("[ErrorComponent caught error]:", error);

  const errObj = (error && typeof error === "object" ? error : {}) as any;

  const isRedir =
    isRedirect(error) ||
    errObj.status === 307 ||
    errObj.status === 302 ||
    errObj.statusCode === 307 ||
    errObj.statusCode === 302 ||
    errObj.routerCode === "REDIRECT" ||
    Boolean(errObj.to) ||
    Boolean(errObj.href) ||
    Boolean(errObj.location) ||
    Boolean(errObj.options?.to) ||
    Boolean(errObj.options?.href) ||
    Boolean(errObj.isRedirect);

  const rawStr = [
    errObj.message,
    errObj.name,
    errObj.cause,
    errObj.error,
    String(error),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isAuthError =
    rawStr.includes("jwt") ||
    rawStr.includes("token") ||
    rawStr.includes("not authenticated") ||
    rawStr.includes("unauthorized") ||
    rawStr.includes("401") ||
    rawStr.includes("403") ||
    rawStr.includes("session") ||
    rawStr.includes("auth") ||
    rawStr.includes("redirect");

  const isChunkError =
    rawStr.includes("dynamically imported module") ||
    rawStr.includes("loading chunk") ||
    rawStr.includes("failed to fetch module") ||
    rawStr.includes("import");

  const extractedTarget =
    errObj.to ||
    errObj.href ||
    errObj.location ||
    errObj.options?.to ||
    errObj.options?.href;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const isAuthedPath =
        path.startsWith("/_authenticated") ||
        path === "/home" ||
        path.startsWith("/profile") ||
        path.startsWith("/battle") ||
        path.startsWith("/community") ||
        path.startsWith("/learning") ||
        path.startsWith("/mistakes") ||
        path.startsWith("/daily") ||
        path.startsWith("/quiz") ||
        path.startsWith("/results") ||
        path.startsWith("/analytics") ||
        path.startsWith("/history") ||
        path.startsWith("/review") ||
        path.startsWith("/pyq") ||
        path.startsWith("/revise") ||
        path.startsWith("/admin");

      if (isRedir || isAuthError || isAuthedPath) {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("sb-") || k.includes("supabase")) localStorage.removeItem(k);
          });
        } catch {
          /* empty */
        }
        const dest = extractedTarget || "/auth";
        if (path !== dest) {
          window.location.href = dest;
        } else {
          window.location.href = "/";
        }
      } else if (isChunkError) {
        window.location.reload();
      } else {
        window.location.href = "/";
      }
    }
  }, [isRedir, isAuthError, isChunkError, extractedTarget]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-3 text-center text-sm font-medium text-muted-foreground">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Loading Last Topper…</span>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#4F46E5" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Last Topper" },
      { title: "Last Topper" },
      { name: "description", content: "IIT-JEE & NEET practice, battles, and AI coaching." },
      { name: "author", content: "Last Topper" },
      { property: "og:title", content: "Last Topper" },
      { property: "og:description", content: "IIT-JEE & NEET practice, battles, and AI coaching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "icon", href: "/app-icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    void registerPWA();
    storeReferralFromUrl();
    void hideNativeSystemBars();
  }, []);

  // Deep links opened while the native app
  // is running: keep the user in-app and capture any ?ref= invite code.
  useEffect(() => {
    const removers: Array<() => void> = [];
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const openNativeUrl = (url: string) => {
          storeReferralFromUrl(url);
          void hideNativeSystemBars();
          void (async () => {
            // Google sign-in finished in the system browser and handed the
            // tokens back to the app — set the session here.
            const tokens = parseOAuthCallback(url);
            if (tokens && !tokens.error) {
              await closeNativeBrowser();
              void hideNativeSystemBars();
              const { data, error } = await supabase.auth.setSession({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
              });
              clearStoredOAuthState();
              if (!error) {
                const target = await getPostAuthRedirectPath(data.user?.id);
                void router.navigate({ to: target, replace: true });
                return;
              }
            }
            const path = nativeRouteFromUrl(url);
            if (path) void router.navigate({ href: path });
          })();
        };
        const handle = await App.addListener("appUrlOpen", ({ url }) => openNativeUrl(url));
        removers.push(() => void handle.remove());
        const resumeHandle = await App.addListener("resume", () => {
          void hideNativeSystemBars();
        });
        removers.push(() => void resumeHandle.remove());

        // Handles links that launched the app from a fully closed state before
        // React and the appUrlOpen listener had mounted.
        const launch = await App.getLaunchUrl();
        if (launch?.url) openNativeUrl(launch.url);
      } catch {
        /* not running natively */
      }
    })();
    return () => removers.forEach((remove) => remove());
  }, [router]);

  // Android hardware/system back button: go one step back in history instead
  // of closing the app or jumping home. Exits only when history is empty.
  useEffect(() => {
    let remove: (() => void) | undefined;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) window.history.back();
          else void App.exitApp();
        });
        remove = () => void handle.remove();
      } catch {
        /* not running natively */
      }
    })();
    return () => remove?.();
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ApkDownloadOverlay />
        <div className="app-surface relative z-[1]">
          <Outlet />
        </div>
        <AppUpdateDialog />
        <Toaster richColors position="top-center" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
