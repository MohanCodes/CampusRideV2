import { StaticPage } from "@/components/StaticPage";

export const metadata = { title: "Privacy — CampusRide" };

// The policy text has to come from counsel (WEB_FLOWS.md Section 10). The list below only states what the app does
// today, as BUILD.md Section 11 describes it; it is not the policy.
export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy">
      <p role="note" className="card mb-6 p-4" data-testid="legal-pending">
        The privacy policy is being reviewed and will be published here before launch. Until then, there is no final text.
      </p>
      <h2 className="t-h2 mb-3">What the site does with your information, today</h2>
      <ul className="list-disc space-y-3 pl-5">
        <li><strong>What we keep:</strong> your school email, name, class year, college, bio, photo, trips, requests, offers, chat messages, reports, who you blocked, and your email settings.</li>
        <li><strong>What we never collect:</strong> your location, route data, payment details, contacts, or ratings.</li>
        <li><strong>What other students see:</strong> your first name, college, class year, bio, and photo. Never your last name or email.</li>
        <li><strong>How long:</strong> chat messages for 12 months. Trips and requests for 24 months.</li>
        <li><strong>Your data:</strong> Download my data and Delete account are in Profile. Deleting removes your name, bio, photo, and sign-in. Trips you took stay in other people&apos;s history as &ldquo;Deleted user&rdquo;.</li>
      </ul>
    </StaticPage>
  );
}
