import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ReferralCard } from "@/components/ReferralCard";
import { getMyVouchers } from "@/lib/referral.functions";
import { AppShell, defaultNavGroups } from "@/components/shell/AppShell";
import { useUserStore } from "@/store/user";
import { amIAdmin } from "@/lib/admin.functions";
import { Gift, Sparkles, Users, Award, ShieldCheck, Ticket } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invite")({
  head: () => ({
    meta: [
      { title: "Invite & Earn — Last Topper" },
      { name: "description", content: "Invite friends to Last Topper and earn free Pro access and discount vouchers." },
      { property: "og:title", content: "Invite & Earn — Last Topper" },
      { property: "og:description", content: "Earn free Pro subscription rewards by inviting friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();
  const profile = useUserStore((s) => s.profile);
  const admin = useQuery({ queryKey: ["am-i-admin"], queryFn: () => amIAdmin() });
  const vouchersQ = useQuery({ queryKey: ["my-vouchers"], queryFn: () => getMyVouchers() });

  const groups = defaultNavGroups({ profileUserId: profile?.id, admin: admin.data?.admin });

  return (
    <AppShell
      header="Invite & Earn Center"
      groups={groups}
      footerNote={<>© {new Date().getFullYear()} Last Topper — Learn. Compete. Earn.</>}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Page Banner */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-amber-500/10 p-6 space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            <Gift className="h-3.5 w-3.5" /> Official Referral Rewards
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Invite Friends, Get Free Pro</h1>
          <p className="text-xs text-muted-foreground max-w-xl">
            Help your friends master JEE & NEET. Every friend who signs up with your invite code brings you closer to 1-Week Pro Passes & Vouchers.
          </p>
        </div>

        {/* Main Interactive Referral Card */}
        <ReferralCard />

        {/* How it Works Grid */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> How Referrals Work
          </h2>
          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-1">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs grid place-items-center mb-2">1</span>
              <div className="font-bold text-foreground">Share Your Link</div>
              <p className="text-muted-foreground">Copy your code or link and send it to your friends on WhatsApp or Telegram.</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-1">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs grid place-items-center mb-2">2</span>
              <div className="font-bold text-foreground">Friends Join</div>
              <p className="text-muted-foreground">When they sign up with your code, they get registered as your referral.</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 space-y-1">
              <span className="h-6 w-6 rounded-full bg-amber-500/10 text-amber-500 font-bold text-xs grid place-items-center mb-2">3</span>
              <div className="font-bold text-foreground">Earn Pro Days</div>
              <p className="text-muted-foreground">For every 10 referrals, unlock 7 days of Pro access & 50% OFF vouchers.</p>
            </div>
          </div>
        </div>

        {/* Earned Vouchers Section */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Ticket className="h-4 w-4 text-emerald-500" /> Your Earned Discount Vouchers
          </h2>
          {vouchersQ.data?.vouchers && vouchersQ.data.vouchers.length > 0 ? (
            <div className="space-y-2">
              {vouchersQ.data.vouchers.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-xl border border-border p-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold text-primary">{v.code}</span>
                    <p className="text-muted-foreground">{v.note || `${v.percent}% OFF Voucher`}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                    {v.percent}% OFF
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              No active vouchers yet. Invite friends to start earning discount vouchers!
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
