import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro({
      preset: process.env.VERCEL ? "vercel" : undefined,
    }),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "pwa-sw.js",
      devOptions: { enabled: false },
      includeAssets: ["app-icon-512.png"],
      manifest: false,
      workbox: {
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "html-nav", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/assets\/.+\.(?:js|css|woff2|png|svg)$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "static-assets" },
          },
        ],
      },
    }),
  ],
});
