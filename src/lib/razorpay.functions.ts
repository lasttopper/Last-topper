import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Razorpay integration:
 * - Pro subscription plans (Weekly ₹49, Monthly ₹149, Yearly ₹1499)
 *
 * Flow:
 *   1. Client calls createRazorpayOrder -> returns { order_id, key_id, amount }
 *   2. Client opens Razorpay checkout with those params
 *   3. On success handler, client calls verifyRazorpayPayment with signature
 *      -> server verifies HMAC(order_id|payment_id, KEY_SECRET) and applies Pro access
 *   4. Webhook /api/public/hooks/razorpay is a redundant safety net
 */

type Purpose = "pro" | "pro_yearly" | "pro_weekly";

function amountFor(purpose: Purpose): number {
  if (purpose === "pro_weekly") return 4900; // ₹49 / week
  if (purpose === "pro") return 14900; // ₹149 / month
  if (purpose === "pro_yearly") return 149900; // ₹1499 / year
  throw new Error("Unknown purpose");
}

export const getRazorpayKeyId = createServerFn({ method: "GET" }).handler(async () => {
  const id = process.env.RAZORPAY_KEY_ID;
  if (!id) throw new Error("Razorpay not configured");
  return { key_id: id };
});

const createOrderSchema = z.object({
  purpose: z.enum(["pro", "pro_yearly", "pro_weekly"]),
  voucher_code: z.string().trim().min(4).max(24).optional(),
  promo_code: z.string().trim().min(2).max(32).optional(),
});

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createOrderSchema.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key || !secret) throw new Error("Razorpay not configured");

    let amount = amountFor(data.purpose);
    let discountPercent = 0;
    if (data.voucher_code) {
      const { findRedeemableVoucher } = await import("@/lib/voucher.server");
      const v = await findRedeemableVoucher(context.userId, data.voucher_code);
      if (!v) throw new Error("This discount code is not valid or already used");
      discountPercent = v.percent;
      amount = Math.max(100, Math.round((amount * (100 - discountPercent)) / 100));
    }
    if (data.promo_code && discountPercent === 0) {
      const { findValidPromo } = await import("@/lib/promo.server");
      const promo = await findValidPromo(data.promo_code, data.purpose, context.userId);
      if (!promo) throw new Error("This promo code is not valid for this plan");
      discountPercent = promo.percent;
      amount = Math.max(100, Math.round((amount * (100 - discountPercent)) / 100));
    }
    const auth = Buffer.from(`${key}:${secret}`).toString("base64");
    const receipt = `${data.purpose}_${context.userId.slice(0, 8)}_${Date.now()}`;

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount,
        currency: "INR",
        receipt,
        notes: { user_id: context.userId, purpose: data.purpose },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[razorpay] order create failed", res.status, t);
      if (res.status === 401) {
        throw new Error("Payment gateway not configured correctly. Please contact support (invalid Razorpay keys).");
      }
      throw new Error(`Failed to create order: ${res.status}`);
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return { order_id: order.id, amount: order.amount, currency: order.currency, key_id: key, discount_percent: discountPercent };
  });

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  purpose: z.enum(["pro", "pro_yearly", "pro_weekly"]),
  voucher_code: z.string().trim().min(4).max(24).optional(),
  promo_code: z.string().trim().min(2).max(32).optional(),
});

function verifySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!verifySignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature)) {
      throw new Error("Invalid payment signature");
    }

    const days = data.purpose === "pro_yearly" ? 365 : data.purpose === "pro_weekly" ? 7 : 30;
    const until = new Date(Date.now() + days * 86400_000).toISOString();
    await context.supabase
      .from("users")
      .update({ is_pro: true, pro_since: new Date().toISOString(), pro_until: until })
      .eq("id", context.userId);
    if (data.voucher_code) {
      const { findRedeemableVoucher, consumeVoucher } = await import("@/lib/voucher.server");
      const v = await findRedeemableVoucher(context.userId, data.voucher_code);
      if (v) await consumeVoucher(v.id);
    }
    if (data.promo_code) {
      const { findValidPromo, redeemPromo } = await import("@/lib/promo.server");
      const promo = await findValidPromo(data.promo_code, data.purpose, context.userId);
      if (promo) await redeemPromo(promo, context.userId, data.purpose);
    }
    return { ok: true as const, purpose: data.purpose };
  });
