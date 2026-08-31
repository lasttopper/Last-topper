import { createFileRoute } from "@tanstack/react-router";

/**
 * Telegram withdrawal webhook handler — preserved for route tree compatibility.
 * Withdrawals are disabled in this system.
 */
export const Route = createFileRoute("/api/public/hooks/telegram-withdrawal")({
  server: {
    handlers: {
      POST: async () => {
        return Response.json({ ok: true, message: "Withdrawals disabled" });
      },
    },
  },
});
