import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Last Topper" },
      { name: "description", content: "The rules for using Last Topper quizzes, battles, and community." },
      { property: "og:title", content: "Terms & Conditions — Last Topper" },
      { property: "og:description", content: "The rules for using Last Topper quizzes, battles, and community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">← Home</Link>
      <h1 className="mt-4 text-3xl font-semibold">Terms &amp; Conditions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated: August 31, 2026</p>

      <section className="prose prose-slate mt-8 max-w-none space-y-6 text-sm leading-6 text-foreground">
        <p>
          These Terms govern your use of Last Topper (the "Service"). By signing in you
          agree to these Terms and our Privacy Policy.
        </p>

        <h2 className="text-lg font-semibold">1. Eligibility</h2>
        <p>You must be at least 13 years old. Users under 18 need parent/guardian consent.</p>

        <h2 className="text-lg font-semibold">2. Your account</h2>
        <ul className="list-disc pl-5">
          <li>Sign in with Google. Keep your account secure — you're responsible for activity on it.</li>
          <li>Provide accurate onboarding info (phone, profession).</li>
          <li>One account per person. Multi-accounting to farm rewards is prohibited.</li>
        </ul>

        <h2 className="text-lg font-semibold">3. Learning content &amp; AI</h2>
        <p>
          Questions are AI-generated from NCERT Class 11 &amp; 12 content. Explanations and
          hints are provided for study; errors may occur. Report incorrect items via the
          in-app "Report" button. Do not rely on the Service for final exam answers.
        </p>

        <h2 className="text-lg font-semibold">4. Quiz Battles &amp; Mega Test</h2>
        <ul className="list-disc pl-5">
          <li>Quick Battle and Sunday Mega Test are free to enter.</li>
          <li>Mega Test runs Sunday 10:00 AM – 1:00 PM IST. Late joiners cannot enter after start.</li>
          <li>Prizes and Pro access rewards are awarded once results are finalized.</li>
          <li>Cheating (screenshots, copying, scripts, multi-device, external help) results in disqualification and possible ban.</li>
        </ul>

        <h2 className="text-lg font-semibold">5. Community rules</h2>
        <ul className="list-disc pl-5">
          <li>Be respectful. No harassment, hate speech, spam, or sexually explicit content.</li>
          <li>No sharing of copyrighted material you don't own.</li>
          <li>No leaking of Mega Test questions during a live session.</li>
          <li>Moderators may remove content or restrict accounts that violate these rules.</li>
        </ul>

        <h2 className="text-lg font-semibold">6. Intellectual property</h2>
        <p>
          The Service, brand, and UI are owned by Last Topper. Content you post remains
          yours, but you grant us a non-exclusive license to display it within the Service.
        </p>

        <h2 className="text-lg font-semibold">7. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms. You may stop using
          the Service at any time.
        </p>

        <h2 className="text-lg font-semibold">8. Disclaimers</h2>
        <p>
          The Service is provided "as is" without warranties. We do not guarantee exam
          results, uninterrupted availability, or that AI-generated content is error-free.
        </p>

        <h2 className="text-lg font-semibold">9. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Last Topper is not liable for indirect,
          incidental, or consequential damages arising from your use of the Service.
        </p>

        <h2 className="text-lg font-semibold">10. Changes</h2>
        <p>We may update these Terms. Continued use after changes means you accept them.</p>

        <h2 className="text-lg font-semibold">11. Governing law</h2>
        <p>These Terms are governed by the laws of India.</p>
      </section>
    </main>
  );
}
