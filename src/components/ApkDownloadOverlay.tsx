import { useEffect, useState } from "react";
import { Download, ExternalLink, Globe2 } from "lucide-react";

const APK_DOWNLOAD_URL =
  "https://github.com/lasttopper/Last-topper/releases/latest/download/LastTopper-release-signed.apk";
const GITHUB_RELEASES_URL = "https://github.com/lasttopper/Last-topper/releases/latest";
const DISPLAY_DOMAIN = "last-topper.vercel.app";

/**
 * Small web-only floating header so browser visitors can quickly install the
 * Android APK. Hidden inside the Capacitor app to avoid advertising a download
 * button to users who are already in the native shell.
 */
export function ApkDownloadOverlay() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!cancelled) setShow(!Capacitor.isNativePlatform());
      } catch {
        if (!cancelled) setShow(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-3 sm:top-4">
      <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-white/25 bg-background/85 p-1.5 pl-2.5 text-foreground shadow-2xl shadow-black/15 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <a
          href="https://last-topper.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Open Last Topper web domain"
        >
          <Globe2 className="h-3.5 w-3.5" />
          <span className="hidden min-[360px]:inline">{DISPLAY_DOMAIN}</span>
        </a>
        <a
          href={GITHUB_RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground min-[430px]:flex"
          aria-label="Open GitHub release page"
        >
          GitHub release
          <ExternalLink className="h-3 w-3" />
        </a>
        <a
          href={APK_DOWNLOAD_URL}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Download Last Topper Android APK from GitHub release"
        >
          <Download className="h-3.5 w-3.5" />
          Download APK
        </a>
      </div>
    </div>
  );
}
