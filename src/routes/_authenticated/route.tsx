// This file is integration-managed. It gates the /_authenticated subtree.
import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAppNotifications } from "@/lib/useAppNotifications";

function AuthedLayout() {
  useAppNotifications();
  return <Outlet />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        throw redirect({ to: "/auth" });
      }
      return { user: data.user };
    } catch (err) {
      if (isRedirect(err)) throw err;
      // Any auth error (invalid token, network glitch) redirects cleanly to /auth
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthedLayout,
});
