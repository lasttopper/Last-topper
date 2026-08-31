import { createFileRoute } from "@tanstack/react-router";

/**
 * Withdrawal processor route — preserved for route tree compatibility.
 * Withdrawals are disabled in this system.
 */
export const Route = createFileRoute("/api/public/hooks/process-withdrawals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        return Response.json({ ok: true, processed: 0, message: "Withdrawals disabled" });
      },
    },
  },
});
