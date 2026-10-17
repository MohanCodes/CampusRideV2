import { StaticPage } from "@/components/StaticPage";

export const metadata = { title: "Terms — CampusRide" };

// The legal text has to come from counsel (WEB_FLOWS.md Section 10). Nothing here is invented: this page says so.
export default function TermsPage() {
  return (
    <StaticPage title="Terms">
      <p role="note" className="card mb-6 p-4" data-testid="legal-pending">
        The terms of use are being reviewed and will be published here before launch. Until then, there is no final text.
      </p>
      <p>
        {"Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency."}
      </p>
    </StaticPage>
  );
}
