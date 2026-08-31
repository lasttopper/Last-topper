import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Last Topper" },
      { name: "description", content: "How refunds work for Last Topper Pro subscriptions." },
      { property: "og:title", content: "Refund Policy — Last Topper" },
      { property: "og:description", content: "How refunds work for Last Topper Pro subscriptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-semibold">Refund Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: August 31, 2026</p>

      <section className="prose prose-slate mt-8 max-w-none space-y-6 text-sm leading-6 text-foreground">
        <p>
          This page explains how refunds work across Last Topper. It is maintained
          by the Last Topper team and may be updated as the product evolves.
        </p>

        <h2 className="text-lg font-semibold">1. Pro subscription</h2>
        <ul className="list-disc pl-5">
          <li>Pro subscriptions are processed securely via Razorpay.</li>
          <li>You can cancel or let your pass expire at any time.</li>
          <li>We generally do not refund partial or unused subscription periods. If you were charged in error or hit a technical issue that blocked usage, contact support within 7 days of the charge and we'll review it.</li>
        </ul>

        <h2 className="text-lg font-semibold">2. Sunday Mega Test</h2>
        <ul className="list-disc pl-5">
          <li>Sunday Mega Test is free to enter for all registered users.</li>
          <li>No payment or fee is required to participate.</li>
        </ul>

        <h2 className="text-lg font-semibold">3. How to request support</h2>
        <p>
          Contact us from the email linked to your account with the payment ID
          and a short description of the issue. We aim to respond within 24–48 hours.
        </p>

        <h2 className="text-lg font-semibold">4. Changes</h2>
        <p>We may update this policy. Material changes will be communicated in-app.</p>

        <p className="text-xs text-muted-foreground">
          See also: <Link to="/terms" className="underline">Terms &amp; Conditions</Link> ·{" "}
          <Link to="/privacy" className="underline">Privacy Policy</Link>
        </p>
      </section>
    </main>
  );
}
