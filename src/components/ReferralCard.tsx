import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMyReferral, applyReferralCode } from "@/lib/referral.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Check, Share2, Users, Gift, Sparkles, Send } from "lucide-react";
import { failMessage } from "@/lib/friendly-error";

export function ReferralCard({ className = "" }: { className?: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["referral-info"], queryFn: () => getMyReferral() });

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputCode, setInputCode] = useState("");

  const applyMutation = useMutation({
    mutationFn: (code: string) => applyReferralCode({ data: { code } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Referral code applied successfully!");
        setInputCode("");
        qc.invalidateQueries({ queryKey: ["referral-info"] });
      } else {
        toast.error(res.error || "Failed to apply referral code.");
      }
    },
    onError: (e: Error) => toast.error(failMessage(e)),
  });

  if (q.isLoading) {
    return <div className="rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">Loading referral details…</div>;
  }

  const ref = q.data;
  if (!ref) return null;

  const code = ref.code || "TOPPER";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://last-topper.vercel.app";
  const shareUrl = `${baseUrl}/auth?ref=${code}`;
  const whatsappMsg = `Join me on Last Topper! Practice IIT-JEE & NEET with NCERT AI questions & live battles. Use my invite code: ${code}\n${shareUrl}`;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success(`Invite code ${code} copied!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareWhatsapp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMsg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`rounded-2xl border border-indigo-500/30 bg-card p-5 space-y-4 shadow-xl shadow-indigo-500/5 relative overflow-hidden ${className}`}>
      {/* Background Accent */}
      <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              Invite Friends & Earn Pro <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Earn free Pro access & vouchers for every 10 friends who join with your link.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Code & Link Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Invite Code */}
        <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Your Invite Code
          </span>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-extrabold text-foreground tracking-wide">{code}</span>
            <Button size="sm" variant="outline" onClick={copyCode} className="h-8 px-2.5 text-xs font-semibold">
              {copiedCode ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copiedCode ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Share Referral Link */}
        <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Your Referral Link
          </span>
          <div className="flex items-center justify-between gap-1.5">
            <Button size="sm" variant="secondary" onClick={copyLink} className="h-8 flex-1 text-xs font-semibold">
              {copiedLink ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
              {copiedLink ? "Link Copied" : "Copy Link"}
            </Button>
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold" onClick={shareWhatsapp}>
              <Send className="mr-1 h-3.5 w-3.5" /> WhatsApp
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-background p-3 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Invited</div>
          <div className="text-base font-bold text-foreground mt-0.5">{ref.invited}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Joined</div>
          <div className="text-base font-bold text-primary mt-0.5">{ref.converted}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Pro Rewards</div>
          <div className="text-base font-bold text-amber-500 mt-0.5">{ref.milestones_earned} Wk</div>
        </div>
      </div>

      {/* Apply Invite Code Form if not referred yet */}
      {!ref.referred_by && (
        <div className="pt-1 border-t border-border/70 space-y-2">
          <span className="text-[11px] font-medium text-muted-foreground block">
            Have a friend's referral code?
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="e.g. TOPPER-7890"
              className="font-mono text-xs h-9 uppercase"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!inputCode.trim() || applyMutation.isPending}
              onClick={() => applyMutation.mutate(inputCode)}
              className="h-9 px-4 text-xs font-semibold shrink-0"
            >
              {applyMutation.isPending ? "Applying..." : "Apply Code"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
