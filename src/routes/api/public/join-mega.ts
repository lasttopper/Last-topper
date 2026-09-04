import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/join-mega")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { mega_test_id, user_id } = body || {};

          if (!mega_test_id || !user_id) {
            return Response.json({ ok: false, error: "Missing testId or userId" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: existing } = await supabaseAdmin
            .from("mega_test_entries")
            .select("id, paid")
            .eq("mega_test_id", mega_test_id)
            .eq("user_id", user_id)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin
              .from("mega_test_entries")
              .update({ paid: true })
              .eq("id", existing.id);
          } else {
            await supabaseAdmin
              .from("mega_test_entries")
              .insert({ mega_test_id, user_id, paid: true });
          }

          return Response.json({ ok: true, message: "Registration confirmed" });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message || "Registration failed" }, { status: 500 });
        }
      },
    },
  },
});
