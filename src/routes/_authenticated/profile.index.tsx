import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/user.functions";
import { useUserStore } from "@/store/user";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile/")({
  component: ProfileIndexRedirect,
});

function ProfileIndexRedirect() {
  const navigate = useNavigate();
  const setProfile = useUserStore((s) => s.setProfile);
  const q = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (q.data?.id) {
      setProfile(q.data as any);
      void navigate({ to: "/profile/$userId", params: { userId: q.data.id }, replace: true });
    } else if (q.isError) {
      void navigate({ to: "/home", replace: true });
    }
  }, [q.data, q.isError, navigate, setProfile]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Redirecting to your profile…
      </div>
    </div>
  );
}
