import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mega-count")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = {
          "cache-control": "no-store, max-age=0, must-revalidate",
          "content-type": "application/json; charset=utf-8",
        };

        try {
          const url = new URL(request.url);
          const megaTestId = url.searchParams.get("mega_test_id");
          const scheduledStart = url.searchParams.get("scheduled_start");
          const { getMegaParticipantSummary } = await import("@/lib/mega-count.server");
          const summary = await getMegaParticipantSummary({ megaTestId, scheduledStart });
          return new Response(JSON.stringify({ ok: true, ...summary }), { headers });
        } catch (e: any) {
          return new Response(
            JSON.stringify({ ok: false, error: e?.message || "Could not load Mega Test player count" }),
            { status: 500, headers },
          );
        }
      },
    },
  },
});
