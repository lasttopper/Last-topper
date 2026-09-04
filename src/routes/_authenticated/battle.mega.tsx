import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trophy, Users, Clock, Sparkles } from "lucide-react";
import { getUpcomingMegaTest, joinMegaTest, startMegaSession } from "@/lib/battle.functions";
import { supabase } from "@/integrations/supabase/client";
import { failMessage } from "@/lib/friendly-error";

const MEGA_REGISTRATION_URL = "https://sub2unlock-topper.vercel.app/mega-register";
const MEGA_PLAYERS_REFRESH_MS = 5000;

type MegaCountResponse = {
  ok: true;
  participants: number;
};

export const Route = createFileRoute("/_authenticated/battle/mega")({
  head: () => ({
    meta: [
      { title: "Sunday Mega Test — Last Topper" },
      { name: "description", content: "180 questions, 3 hours, free entry every Sunday 10AM IST." },
      { property: "og:title", content: "Sunday Mega Test" },
      { property: "og:description", content: "180q · 3hr · free entry contest with Pro rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MegaTest,
});

function MegaTest() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["mega-test"],
    queryFn: () => getUpcomingMegaTest(),
    refetchInterval: MEGA_PLAYERS_REFRESH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  const megaTestId = q.data?.test?.id;
  const megaScheduledStart = q.data?.test?.scheduled_start;

  const liveCount = useQuery({
    queryKey: ["mega-player-count", megaTestId, megaScheduledStart],
    enabled: Boolean(megaTestId) && typeof window !== "undefined",
    queryFn: async () => {
      if (!megaTestId) throw new Error("Mega Test is not loaded yet");
      const url = new URL("/api/public/mega-count", window.location.origin);
      url.searchParams.set("mega_test_id", megaTestId);
      url.searchParams.set("_", String(Date.now()));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Could not refresh player count");
      return json as MegaCountResponse;
    },
    refetchInterval: MEGA_PLAYERS_REFRESH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const refreshMegaTest = () => {
      void qc.invalidateQueries({ queryKey: ["mega-test"] });
      void qc.invalidateQueries({ queryKey: ["mega-player-count"] });
    };

    const ch = supabase
      .channel("mega-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "mega_test_entries" }, refreshMegaTest)
      .on("postgres_changes", { event: "*", schema: "public", table: "mega_tests" }, refreshMegaTest)
      .subscribe();

    // Poll as a fallback so the joined-player count stays live even if the
    // database table is not enabled for Supabase Realtime publication.
    const fallback = setInterval(refreshMegaTest, MEGA_PLAYERS_REFRESH_MS);

    return () => {
      clearInterval(fallback);
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  const join = useMutation({
    mutationFn: (id: string) => joinMegaTest({ data: { mega_test_id: id } }),
    onSuccess: () => {
      toast.success("You're registered for Sunday Mega Test!");
      qc.setQueryData(["mega-test"], (old: any) => {
        if (!old) return old;
        const wasAlreadyJoined = Boolean(old.entry?.paid);
        return {
          ...old,
          entry: old.entry ? { ...old.entry, paid: true } : { paid: true, session_id: null, rank: null },
          participants: wasAlreadyJoined ? old.participants : Number(old.participants ?? 0) + 1,
        };
      });
      qc.invalidateQueries({ queryKey: ["mega-test"] });
      qc.invalidateQueries({ queryKey: ["mega-player-count"] });
    },
    onError: (e: Error) => toast.error(failMessage(e)),
  });

  const start = useMutation({
    mutationFn: (id: string) => startMegaSession({ data: { mega_test_id: id } }),
    onSuccess: (res) =>
      navigate({ to: "/battle/play/$sessionId", params: { sessionId: res.id } }),
    onError: (e: Error) => toast.error(failMessage(e)),
  });

  const [processedGatewayReturn, setProcessedGatewayReturn] = useState(false);

  useEffect(() => {
    if (processedGatewayReturn || !q.data || join.isPending) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("mega_unlocked") !== "1") return;

    const returnedMegaTestId = params.get("mega_test_id");
    const currentMegaTestId = q.data.test.id;
    if (returnedMegaTestId && returnedMegaTestId !== currentMegaTestId) return;

    setProcessedGatewayReturn(true);

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("mega_unlocked");
    cleanUrl.searchParams.delete("mega_test_id");
    window.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);

    if (!q.data.entry?.paid) {
      join.mutate(currentMegaTestId);
    } else {
      toast.success("You're already registered for Sunday Mega Test!");
    }
  }, [processedGatewayReturn, q.data, join]);

  if (q.isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;
  const info = q.data;
  if (!info) return <div className="battle-glass p-5 text-sm">Complete onboarding first.</div>;

  const { test, entry, participants } = info;


  const liveParticipants = liveCount.data?.participants ?? participants ?? 0;

  const startMs = new Date(test.scheduled_start).getTime();
  const endMs = new Date(test.scheduled_end).getTime();
  const isLive = now >= startMs && now < endMs;
  const isDone = now >= endMs;
  const untilStartMs = Math.max(0, startMs - now);
  const untilEndMs = Math.max(0, endMs - now);

  const handleRegisterClick = () => {
    const returnTo = new URL("/battle/mega", window.location.origin);
    returnTo.searchParams.set("mega_unlocked", "1");
    returnTo.searchParams.set("mega_test_id", test.id);

    const registrationUrl = new URL(MEGA_REGISTRATION_URL);
    registrationUrl.searchParams.set("mega_test_id", test.id);
    registrationUrl.searchParams.set("return_to", returnTo.toString());

    window.location.assign(registrationUrl.toString());
  };

  return (
    <div className="space-y-4">
      <div className="battle-glass battle-slide-up p-6">
        <div className="flex items-center gap-2 text-yellow-300">
          <Trophy className="h-5 w-5" />
          <span className="text-xs uppercase tracking-widest">Sunday Mega Test</span>
        </div>
        <h1 className="battle-title mt-2 text-2xl">
          Prove your skill.
        </h1>
        <p className="mt-2 inline-flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          180 questions · 3-hour window · <span className="font-semibold text-emerald-400">Free Entry</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Stat
            icon={<Users className="h-4 w-4" />}
            label="Joined Players"
            value={formatCount(liveParticipants)}
          />
          <Stat
            icon={<Clock className="h-4 w-4" />}
            label={isDone ? "Ended" : isLive ? "Ends in" : "Starts in"}
            value={isDone ? "—" : fmtDur(isLive ? untilEndMs : untilStartMs)}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {!entry?.paid && !isDone && !isLive && (
            <button
              className="battle-btn inline-flex items-center gap-2 font-bold"
              disabled={join.isPending}
              onClick={handleRegisterClick}
            >
              <Sparkles className="h-4 w-4" />
              {join.isPending ? "Registering…" : "Register for Free"}
            </button>
          )}
          {!entry?.paid && isLive && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-400/10 px-3 py-2 text-sm font-semibold uppercase tracking-widest text-emerald-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Test is live
            </div>
          )}

          {entry?.paid && !entry.session_id && isLive && (
            <button className="battle-btn" disabled={start.isPending} onClick={() => start.mutate(test.id)}>
              {start.isPending ? "Preparing…" : "Enter test"}
            </button>
          )}
          {entry?.paid && entry.session_id && isLive && (
            <button
              className="battle-btn"
              onClick={() => navigate({ to: "/battle/play/$sessionId", params: { sessionId: entry.session_id! } })}
            >Resume test</button>
          )}
          {entry?.paid && !isLive && !isDone && (
            <div className="rounded-xl border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-200">
              You're registered. Come back when the timer hits zero.
            </div>
          )}
          {isDone && entry?.rank && (
            <div className="inline-flex items-center gap-1 rounded-xl border border-yellow-400/60 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
              Rank #{entry.rank}
            </div>
          )}
        </div>
      </div>

      <div className="battle-glass p-5">
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Rewards</div>
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-center justify-between">
            <span>🥇 Rank 1</span>
            <span className="font-semibold text-primary">1 Week Pro Free (50+ players)</span>
          </li>
          <li className="flex items-center justify-between">
            <span>🥈 Rank 2</span>
            <span className="font-semibold text-foreground">50% OFF Pro Voucher</span>
          </li>
          <li className="flex items-center justify-between">
            <span>🥉 Rank 3</span>
            <span className="font-semibold text-foreground">25% OFF Pro Voucher</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Ranks 4–10</span>
            <span className="text-muted-foreground">15% OFF Pro Voucher</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function fmtDur(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
