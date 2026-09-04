import { supabase } from "@/integrations/supabase/client";

export type PostAuthRedirectPath = "/register" | "/home";

/**
 * Decide where an authenticated user should land after sign-in.
 *
 * New/incomplete users must finish `/register`; fully-onboarded users go to
 * `/home`. If the profile row is not available yet, default to `/register`
 * so the registration guard can let the user complete onboarding.
 */
export async function getPostAuthRedirectPath(userId?: string | null): Promise<PostAuthRedirectPath> {
  let uid = userId ?? null;

  if (!uid) {
    const { data } = await supabase.auth.getUser();
    uid = data.user?.id ?? null;
  }

  if (!uid) return "/register";

  const { data: profile, error } = await supabase
    .from("users")
    .select("onboarded, phone, profession")
    .eq("id", uid)
    .maybeSingle();

  if (error) {
    console.warn("[post-auth-redirect] Could not load profile; sending to registration", error);
    return "/register";
  }

  return profile?.onboarded && profile?.phone && profile?.profession ? "/home" : "/register";
}
