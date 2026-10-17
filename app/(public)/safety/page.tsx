import { StaticPage } from "@/components/StaticPage";
import { getMySafetyNumber } from "@/lib/data/me";

export const metadata = { title: "Safety — CampusRide" };

// WEB_FLOWS.md Sections 6.2 and 6.3. The sentence below is exact. This page makes no promise to watch over a ride.
export default async function SafetyPage() {
  const mine = await getMySafetyNumber();

  return (
    <StaticPage title="Safety">
      <p className="mb-8 text-[1.0625rem]" data-testid="safety-sentence">
        {"Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency."}
      </p>

      <section aria-labelledby="tips-heading" className="mb-10">
        <h2 id="tips-heading" className="t-h2 mb-3">Before you go</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Meet at the approved spot.</strong> Every meetup is at a public place on a short list. Don&apos;t agree to be picked up anywhere else.</li>
          <li><strong>Check that the car and driver match.</strong> After a driver accepts, you see their photo, first name, and the car&apos;s make, color, and plate. Look before you get in.</li>
          <li><strong>Tell a friend where you&apos;re going.</strong> On an accepted trip, Copy trip details makes a short note you can send.</li>
          <li><strong>Trust your gut, and say no.</strong> You can leave a trip, or not get in, at any point. You can also report or block anyone from their profile, a trip, a request, or a chat.</li>
        </ul>
      </section>

      <section aria-labelledby="emergency-heading" className="mb-10">
        <h2 id="emergency-heading" className="t-h2 mb-3">If something is wrong</h2>
        <ul className="list-disc space-y-3 pl-5">
          <li><strong>Emergency:</strong> call <a href="tel:911" className="link">911</a>.</li>
          <li>
            <strong>Not an emergency:</strong>{" "}
            {mine === null && "sign in to see your college's campus safety number."}
            {mine?.phone && <>call {mine.campusName} campus safety at <a href={`tel:${mine.phone.replace(/[^\d+]/g, "")}`} className="link" data-testid="campus-phone">{mine.phone}</a>.</>}
            {mine && !mine.phone && <>we don&apos;t have {mine.campusName}&apos;s campus safety number yet. Check your college&apos;s website.</>}
          </li>
          <li><strong>About a person on Campus Ride:</strong> use Report on their profile, trip, request, or chat. The team reads reports within 24 hours.</li>
        </ul>
      </section>

      <section aria-labelledby="does-heading" className="mb-10">
        <h2 id="does-heading" className="t-h2 mb-3">What Campus Ride does</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Lets only students with a school email from the Claremont Colleges post, ask for a seat, or message.</li>
          <li>Limits meetups to approved public places.</li>
          <li>Keeps your last name and email from other students.</li>
          <li>Puts Report and Block one tap away.</li>
        </ul>
      </section>

      <section aria-labelledby="doesnt-heading">
        <h2 id="doesnt-heading" className="t-h2 mb-3">What it doesn&apos;t do</h2>
        <p>It doesn&apos;t monitor rides, check driving records or insurance, or give emergency help. The ride and any cost-sharing happen outside the app, between you and the other student.</p>
      </section>
    </StaticPage>
  );
}
