import { supabase } from "@/integrations/supabase/client";

/**
 * Google sign-in for the native Android/iOS shell.
 *
 * Google blocks OAuth inside embedded WebViews, so on native we ask Supabase
 * for the provider URL without redirecting the WebView, then open that URL in
 * the real device browser / Custom Tab. Supabase returns to /auth/callback,
 * which either opens the installed app through Android App Links or bounces
 * back through lasttopper:// as a fallback.
 */
export const NATIVE_CALLBACK_PATH = "/auth/callback";

/** Custom URL scheme registered by the native app (lasttopper://…). */
export const APP_SCHEME = "lasttopper";

/** Public URL marker that survives the OAuth broker's own state handling. */
export const NATIVE_CALLBACK_MARKER = "native_app";

/** Deep link that always re-opens the installed app with the OAuth tokens. */
export function appSchemeCallbackUrl(params: Record<string, string>) {
  return `${APP_SCHEME}://auth/callback?${new URLSearchParams(params).toString()}`;
}

export async function isNativeApp(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function clearStoredOAuthState() {
  try {
    window.localStorage.removeItem("lt-oauth-state");
  } catch {
    /* ignore */
  }
}

/** Opens the Google consent flow outside the WebView. */
export async function startNativeGoogleSignIn() {
  const redirectTo = `${window.location.origin}${NATIVE_CALLBACK_PATH}?${NATIVE_CALLBACK_MARKER}=1`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("Google sign-in URL was not returned.");

  // Preferred: hand the URL to the device's default browser app (Chrome /
  // Safari), so Google sees a real browser and the app is fully backgrounded.
  try {
    const { InAppBrowser } = await import("@capacitor/inappbrowser");
    await InAppBrowser.openInExternalBrowser({ url: data.url });
    return;
  } catch {
    /* plugin unavailable — fall back below */
  }

  // Fallback: Chrome Custom Tab / SFSafariViewController.
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
    return;
  } catch {
    /* fall through */
  }

  window.location.href = data.url;
}

/** Maps a native/custom/App Link URL to an in-app route. */
export function nativeRouteFromUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (url.protocol === `${APP_SCHEME}:`) {
    if (url.hostname === "app") return "/home";
    if (url.hostname === "auth") return `${NATIVE_CALLBACK_PATH}${url.search}${url.hash}`;
    const customPath = `/${url.hostname}${url.pathname}${url.search}${url.hash}`;
    return customPath === "/" ? "/home" : customPath;
  }

  if (url.protocol === "https:") {
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path === "/" ? "/home" : path;
  }

  return null;
}

export async function closeNativeBrowser() {
  try {
    const { InAppBrowser } = await import("@capacitor/inappbrowser");
    await InAppBrowser.close();
  } catch {
    /* not open / not native */
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    /* browser already closed or not native */
  }
}

export async function restoreNativeSystemBars() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
  } catch {
    /* status bar plugin unavailable / non-native */
  }
}

export type OAuthCallbackTokens = {
  access_token: string;
  refresh_token: string;
  state: string | null;
  error: string | null;
};

/** Reads OAuth tokens from a callback URL (query string or hash). */
export function parseOAuthCallback(href: string): OAuthCallbackTokens | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const fromSearch = url.searchParams;
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = (k: string) => fromSearch.get(k) ?? fromHash.get(k);

  const error = get("error_description") ?? get("error");
  const access_token = get("access_token");
  const refresh_token = get("refresh_token");
  if (!access_token || !refresh_token) {
    return error ? { access_token: "", refresh_token: "", state: get("state"), error } : null;
  }
  return { access_token, refresh_token, state: get("state"), error: null };
}
