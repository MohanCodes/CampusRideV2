# Campus Ride Web: Screens and Flows

> **Purpose.** Campus Ride is a student carpooling site for the Claremont Colleges (the 5Cs). It does one job: help students **find each other** and **choose a place to meet**. Students who already plan to drive post a trip, students who need a ride find one or ask for one, they agree on an approved meetup spot and time in the app, and then the ride happens on their own. The site does not track trips, run the ride, or handle money.

---

## 1. Scope

**In the app**

- Verified students only (school email).
- Post a trip (**Offer a ride**) and ask for a ride (**In search of**).
- Browse the board, request a seat, accept or decline, send and answer offers.
- Choose an **approved meetup point** and a time; the exact spot is shared after a match.
- Chat with the person you matched with.
- Report and block, and a plain safety tips page.

**Not in the app (on purpose)**

- No live location, route tracking, check-ins, PIN, SOS button, or arrival confirmation.
- No payments and no payment status. The driver can suggest a split of gas and parking; people settle up themselves.
- No ratings or reviews, and no trip records with location history.
- No emergency contacts.

The site says this plainly: it connects students, it does not supervise rides. Anything that needs real-time safety is the phone's job (call 911 or campus safety).

**Platform assumptions**

- Responsive web app, mobile-first, usable from 360 px wide up to desktop.
- Works in current Chrome, Safari, Firefox, and Edge.
- Light and Dark mode, keyboard navigation, screen reader labels, and text that scales.
- Times show in the campus time zone, in relative form where possible ("Today 3:30 PM").
- Email notifications plus in-app badges. No browser notifications at launch.

---

## 2. Principles

1. **Board first.** The site opens on the ride board, because most visits start with "who is going to Trader Joe's?"
2. **Two clicks to a request.** Card, then **Request a seat**.
3. **Thirty seconds to post.** One form with smart defaults (next half hour, 3 seats, last used meetup point).
4. **Trust is visible.** Every card and profile shows the verified badge and first name and photo, so you can tell who you're meeting.
5. **Meet in public.** Meetups happen only at approved public points; there is no free-text address anywhere.
6. **Always say what happens next.** Every state shows a plain sentence and one clear action.
7. **Look without an account.** Visitors can browse the board; they sign in to request, post, or message.

---

## 3. Navigation and routes

| Nav item | Route | Notes |
| --- | --- | --- |
| Board (home) | `/` | Rides and In search of, switched by tabs |
| Post | `/post` | Chooser: **Offer a ride** or **Ask for a ride** |
| My Rides | `/rides` | Upcoming, Requests, Past |
| Inbox | `/inbox` | Seat requests, offers, chats |
| Profile | `/me` | Profile, settings, blocked users |

Other routes: `/trip/:id`, `/request/:id`, `/user/:id`, `/chat/:id`, `/safety`, `/admin` (meetup points, reports).

**Rules**

- Every screen has a shareable URL. Signed-out visitors opening a protected URL sign in first and then land back on it.
- Trip detail and profiles open from any list and have a back link.
- **Post** opens as a full page on phones and a large modal on desktop; leaving with unsaved input asks "Discard this trip?"
- **Request a seat** opens as a modal (desktop) or bottom sheet (phone) over Trip detail.
- A badge on Inbox counts unread messages, requests, and offers.
- Email links open the matching page directly.

---

## 4. Screens

Every list screen also has loading (skeleton rows) and error (message plus **Try again**) states.

### 4.1 Sign in and onboarding

1. **Landing** (signed out): logo, one line ("Rides with students you can trust."), **Sign in with school email**, and a read-only preview of the board.
2. **School email:** field plus **Send code**. A non-school address shows "Use your school email."
3. **Code entry:** six boxes, auto-advance, **Resend** after 30 seconds. A wrong code shakes the boxes and says "That code didn't work. Check it and try again."
4. **Profile:** photo (required, a clear photo of your face), first and last name, college, class year, optional short bio.
5. **Community pledge:** "Meet at approved spots, be on time, and report anything off." **I agree.**

### 4.2 Board (home)

1. Header: community name, search box.
2. Tabs: **Rides** and **In search of**.
3. Destination chips: All, Trader Joe's, Target, The Village, Airport (ONT), LA / LAX, Other.
4. Filters: date (Today, Tomorrow, Pick a date), college, and "Seats: 1+".
5. Trip cards sorted by departure time, grouped under date headers. On desktop, cards form a two- or three-column grid with a filter sidebar.

**States.** Empty Rides: illustration, "No rides to Trader Joe's yet," with **Post a trip**, **Ask for a ride**, and **Clear filters**. Full trips are hidden.

### 4.3 Trip detail

1. Destination and a small map of the meetup point.
2. Time block: "Today, 3:30 PM", "Back by 5:00 PM", seats left.
3. Driver row: photo, first name, college, verified badge; links to profile.
4. Meetup point: name and map, with "Exact meeting spot is shared after the driver accepts."
5. Car: make and color (plate shown only after acceptance).
6. Cost note and driver notes.
7. Action area (sticky on phones): **Request a seat**, and a menu with **Report trip**.

**States:** Not requested, Pending ("Request sent" with **Cancel request**), Accepted (**Message driver**, exact meetup spot, plate, **Copy trip details**), Declined or full ("This trip isn't available" with **Find another trip**), Own trip (**Edit trip**, **Cancel trip**, list of requests).

### 4.4 Request a seat (modal)

Seats stepper (1 to seats left), optional message ("Hi, I just need Trader Joe's and back, no big bags"), and a one-line cost reminder. **Send request** and **Cancel**. On success the modal closes and the page shows Pending with a toast.

### 4.5 Post a trip (Offer a ride)

One scrolling form:

1. Where to (place search, recent and popular first)
2. When (date and time, defaulting to the next half hour)
3. Back by (optional)
4. Seats open (default 3, max 6)
5. Meetup point (approved points only, from a map or list; defaults to last used)
6. Car (make, color, plate; plate is only shown after a rider is accepted)
7. Cost note (optional; "Suggested: split gas and parking, no profit")
8. Notes (optional)
9. **Post trip**, disabled until destination, time, and meetup point are set

Past times show an inline error. After posting, a confirmation page shows the trip card with **Copy link** and **Done**.

### 4.6 Ask for a ride (In search of)

Fields: where to, date and time, flexibility (Exactly, plus or minus 30 minutes, plus or minus 1 hour, anytime that day), seats needed (1 to 3), meetup point (approved only), **I'll chip in** toggle (no price field), optional note.

**Rules:** max 2 open requests; not in the past or more than 7 days ahead; phone numbers, emails, handles, and links in the note are blocked ("Keep contact details in the app chat"); riders need a verified account.

### 4.7 In search of: request card and offers

- **Driver view:** request card with rider photo, first name, college, destination, time window, seats, meetup point, **Will chip in** tag, and **Offer a ride**. The offer modal lets the driver **use one of my trips** (matching destination, inside the window, seats left) or **post a new trip for this** (pre-filled).
- **Rider view:** the request, its status, and a list of offers (driver, car, time, meetup point, message) with **Accept** and **Decline**, plus **Edit** and **Cancel request**.
- Accepting reserves the seat, reveals the exact meetup spot, and opens a chat, all in one server transaction. Other pending offers close.

### 4.8 My Rides

Tabs: **Upcoming**, **Requests**, **Past**. Compact rows with status badges (Open, Full, Pending, Accepted, Declined, Past, Cancelled). A trip moves to Past automatically 2 hours after its departure time. Empty state: "No rides yet. Find a ride or post one."

### 4.9 Inbox and chat

Sections: **Offers**, **Seat requests** (with **Accept** and **Decline**), and **Chats**. On desktop, chats use a two-pane layout (list left, thread right). Chat has quick replies (**On my way**, **Running 5 min late**, **I'm here**) and system messages when someone joins or cancels. Chats close 24 hours after the trip's departure time.

### 4.10 Profile, settings, safety

- **Profile:** photo, first name, college, class year, bio, and a verified badge. Others' profiles add **Report** and **Block**.
- **Settings:** notification emails, blocked users, privacy, help, **Sign out**, **Delete account**.
- **Safety page** (`/safety`, linked from the footer and every trip detail): plain tips, 911, and the user's campus safety number (see Section 6).

---

## 5. Flows

### A. First visit to first request (rider)

1. Visitor lands on the board and browses.
2. Clicks a card, then **Request a seat**; the site asks them to sign in.
3. Onboarding: school email, code, profile, pledge.
4. They return to the same trip and the request modal opens.
5. **Send request**; the page shows "Request sent. We'll let you know when Maya replies."
6. Driver accepts; rider gets an email and an inbox badge.
7. Trip detail now shows the exact meetup spot, the car's plate, and the chat.

**Exceptions.** Decline: "Maya can't take you this time. Here are other rides to Trader Joe's." Cancel: **Cancel request** returns the button to **Request a seat**. Trip fills first: "This trip just filled up" and back to the board.

### B. Post a trip (driver)

1. Click **Post**, choose **Offer a ride**.
2. Fill the form (defaults pre-filled).
3. **Post trip**; confirmation shows the trip card.
4. **Done** returns to the board, where the trip appears.

**Exceptions.** Leaving with input asks to discard. An overlapping trip shows "You already have a trip at this time" with edit or post anyway.

### C. Handle a request (driver)

1. Email and inbox badge: "Alex wants a seat to Trader Joe's at 3:30 PM."
2. Open the request with the rider's photo, first name, college, and message.
3. **Accept**: seat count drops, the exact meetup spot is shared, chat opens. Or **Decline**: rider is told with no reason shown.

Unanswered requests expire 30 minutes before departure with a note to the rider.

### D. Ask for a ride and get an offer

1. **Post**, then **Ask for a ride**; fill and **Post request**.
2. Drivers browse **In search of** and send offers.
3. Rider gets an email and inbox badge, reviews offers, and accepts one.
4. The request becomes **Matched**, the exact meetup spot is shared, and a chat opens.

### E. Meetup day

1. Two hours before departure, both get an email reminder with the meetup point, time, and a link to the chat.
2. They message in the chat if anything changes (late, can't make it).
3. They meet at the approved meetup point and go. The site's job is done.
4. If plans change, either person taps **Cancel** on the trip or request; the other person is emailed.

**Exceptions.** Driver cancels: riders are emailed and the trip moves to Cancelled. No-show: the driver can tap **Rider didn't show** after the departure time; it is logged for the team and counts toward a warning policy (see Section 10).

### F. Report or block

1. Open the menu on any profile, trip, request, or chat.
2. Choose **Report** or **Block**.
3. Report: reason (Unsafe driving, Harassment, No-show, Fake profile, Other), details, **Submit**; confirmation says "Thanks. Our team will review this."
4. Block: confirm; the person disappears from the board, Inbox, and chats.

---

## 6. Meetup points and safety

### 6.1 Approved meetup points

- A trip or request must use an **approved meetup point** for the college. Users choose from a map and list; there is no free-text address for meetups.
- Good meetup points are public, visible from a road or walkway, lit and busy at typical times, safe for a car to stop for a minute or two, and allowed by the college.
- The map shows all approved points as pins, nearest first. Tapping a pin shows its name and where exactly to stand.
- The exact point is shown to the rider only after the driver accepts.
- Destinations can be any public place (a store, an airport, a train station) but not a private residence.
- Admins add, edit, suspend, or retire points on `/admin`. A suspended point disappears from new trips; existing trips keep theirs.

### 6.2 What the site does for safety

- Only verified students from the allowed colleges can request, post, or message.
- Meetups are limited to approved public points.
- Riders see the driver's photo, first name, college, car, and plate (after accept) so they can check they're getting in the right car.
- **Copy trip details** (on an accepted trip) copies a short text summary (driver first name, car, plate, destination, time, meetup point) so a person can send it to a friend.
- Report and Block are one click away on every profile, trip, request, and chat.
- A **Safety page** with plain tips: meet at the approved spot, check the car and driver match the posting, tell a friend where you're going, trust your gut and say no, and call 911 in an emergency or your campus safety number for non-emergencies.

### 6.3 What the site does not do

The site does not monitor rides, verify driving records or insurance, or provide emergency help. Wording on the safety page, terms, and every trip detail says so in plain language: "Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency."

### 6.4 Reports and moderation

Reports go to a moderation page on `/admin`. The team can warn, suspend, or remove an account. Repeat no-shows get a warning on the second report and a short suspension on the third. Reporters never see each other's contact details, and blocked users never see each other's trips or requests.

---

## 7. Visual direction and tone

The look comes from the CampusRide landing page: calm mint and deep forest green, large light headlines with a serif accent word, thin hairline dividers, generous white space, and a small arrow (↗) as the signature mark. It should feel quiet, local, and trustworthy, like a campus noticeboard that grew up. Warm, rounded, plain language, real faces, never loud.

**Brand pieces**

- **Logo:** a circle filled with Ink and an arrow (↗) in Mint, followed by the wordmark "CampusRide" in bold sans with tight letter spacing. Wordmark is one word, as on the landing page.
- **Signature motifs** (use sparingly, mostly on landing, onboarding, and empty states): the arrow ↗ on primary links and buttons, a thin circular "orbit" outline with a dashed inner ring behind hero art, a dashed route line between two dots on maps, and softly rotated floating cards (about 5 degrees) for marketing visuals only. Never rotate cards inside the working app screens.
- **Eyebrow labels:** small uppercase labels with a green dot or a number ("01 / Why CampusRide") above section headings on marketing pages. In the app, use the same style only for tiny section labels.
- **Taglines (pick one per surface):** "Same direction. Better together." / "Student carpooling, starting at the 5Cs."

**Color.** Define every color as a CSS variable and never hard-code hex values in components.

| Name | Token | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| Ink | `--ink` | #17392E | #EAF5EE | Main text, filled primary buttons, logo circle |
| On Ink | `--on-ink` | #FFFFFF | #17392E | Text and icons on filled Ink buttons |
| Forest | `--green` | #276E50 | #6FCB9F | Links, numbers, dots, selected states, focus accents |
| Mint | `--mint` | #DDF9EA | #1D3A2E | Hero and highlight panels, avatar fill, selected chips |
| Pale | `--pale` | #EAF9F1 | #172A21 | Soft tints, hover fills |
| Page | `--bg` | #FCFDF9 | #0F1A15 | Page background |
| Sage | `--bg-alt` | #F0F4EE | #15231C | Alternating section bands |
| Card | `--surface` | #FFFFFF | #172620 | Cards, modals, inputs |
| Muted | `--muted` | #5D7168 | #9DB3A7 | Captions, timestamps, secondary text |
| Line | `--line` | #CEDCD3 | #2A3D34 | Hairline dividers and card borders |
| Focus | `--focus` | #36805B | #6FCB9F | Focus ring (3 px outline, 6 px offset) |
| Danger | `--danger` | #B42318 | #F87171 | Declines, reports, destructive actions |
| Highlight | `--star` | #F59E0B | #FBBF24 | Small "New" and highlight tags only |

The landing page has no danger color, highlight color, or dark mode, so those rows (Danger, Highlight, and every Dark column) are new additions chosen to match the palette. Check them against the rules below before launch.

**Color rules**

- Ink marks the one main action on a screen. Never put two filled Ink buttons side by side; the second action is an outlined or text button.
- Forest is the accent: links, step numbers, the small dots, selected tabs, and focus. It is not a second button color.
- Mint is for panels and soft emphasis, never for text.
- Danger is reserved for declines, reports, and destructive actions, always with a word or icon. Never use it for decoration or generic warnings.
- Success states (Accepted, Completed, Verified) use Forest with a check icon and a word, since there is no separate green.
- Highlight color is only for small tags; never for text, and never with white text on it.
- Proportions: about 75% Page, Card, and Sage, 15% Ink and Muted, 8% Mint and Forest, 2% Danger and Highlight. If a screen feels busy, remove color before adding anything.
- Every text pairing needs 4.5:1 contrast (3:1 for large text and UI outlines) in both Light and Dark. Never use color alone to carry meaning.

**Type.** Plus Jakarta Sans for everything, with Newsreader (italic) for one emphasized word in a headline and for step numbers. Both are served from the site itself (npm font packages), with Arial and Georgia as fallbacks. Text sizes use `rem` so they scale.

| Style | Size / weight | Letter spacing | Use |
| --- | --- | --- | --- |
| Display | clamp(3.6rem, 6.4vw, 5.5rem) / 500 | -0.045em | Landing page headline only |
| Heading 1 | 3rem / 500, line height 1.08 | -0.03em | Section headings, page titles on desktop |
| Heading 2 | 1.44rem / 500 | -0.02em | Card titles, step titles, screen headings in the app |
| Body | 1rem / 400, line height 1.65 | normal | Messages, notes, descriptions |
| Small | 0.875rem / 400 | normal | Captions, times, seat counts |
| Label | 0.6875rem / 700, uppercase | 0.18em | Eyebrows and tiny section labels |

On phones, step headings down (Display about 4rem, Heading 1 about 2.4rem). Keep body lines under about 60 characters, left-aligned, sentence case. Seat counts and times use tabular numbers so they don't jump. The tiny sizes used inside the landing page's phone illustration are decoration only; real app text never goes below 0.75rem.

**Layout and shape**

- **Spacing** in multiples of 4 px (4, 8, 12, 16, 24, 32, 48, 64). Page margins are 16 px on phones, 25 to 48 px on larger screens.
- **Width:** sections and app content max 1180 px, centered; the hero panel can run to 1320 px. Section padding is generous (about 100 px top and bottom on desktop, 70 px on phones).
- **Corners:** large panels 22 to 28 px, cards 12 to 16 px, buttons 7 px, chips, status pills, and the nav status tag fully rounded, avatars circles.
- **Buttons:** filled Ink with white text and an arrow (↗) on the main call to action, 17 px by 23 px padding, hover shifts the fill to Forest. Secondary buttons are outlined with a Line border.
- **Depth:** prefer hairlines and flat fills to shadows. Cards are white with a 1 px Line border and, at most, a very faint shadow in Light mode. No shadows in Dark mode.
- **Panels:** the hero and closing sections sit on a rounded Mint panel; the "How it works" style band sits on Sage with hairline top and bottom borders; the mission block is a dark Ink panel with Mint text (in Dark mode, use the Mint dark value as the panel fill).
- **Dividers:** thin 1 px Line rules separate list items, steps, and FAQ rows instead of boxes.
- **Navigation:** 92 px tall on desktop (78 px on phones), logo left, links and a pill status tag right; links collapse on phones.
- **Icons:** one outlined icon set at one weight, filled when selected. Icons are never the only label for an important action.
- **Imagery:** profile photos are the only photos. They must be real, clear, and of the user's face. No stock images. Illustrations are flat, simple shapes in the palette only, with no faces.

**Motion.** Short and purposeful: 120 to 200 ms for feedback, 250 to 400 ms for layout changes, ease-out only, no bounce. Confirm, don't decorate. Smooth scrolling for in-page links. Respect `prefers-reduced-motion` by swapping movement for a quick fade. Report and Block respond instantly and never celebrate.

**Voice.** Short, friendly, specific. Talk like a classmate, not a company. Use first names and plain words ("ride," "seat," "pickup point"). Say what happened and what to do next in one or two sentences. Never blame the user; no exclamation marks or humor in errors or safety moments. Emoji at most one in celebratory moments, never in errors or safety screens.

**Accessibility**

- 44 px minimum tap targets, visible focus ring on every interactive element (3 px Focus outline), labels on every icon button.
- Page language, landmarks (`nav`, `main`, `footer`), and a skip link; decorative graphics are hidden from screen readers.
- Works with keyboard only, at 200% zoom, in Light and Dark, and with reduced motion on.

**States for every screen:** loading (skeleton rows shaped like the content), empty (small illustration, one line, one action), error (plain message and **Try again**), offline banner ("You're offline. Trips may be out of date."), success (quiet confirmation: a check, a toast, or a state change on the button), disabled (reduced opacity plus a reason when it isn't obvious).

**CSS variables to start from**

```css
:root {
  --ink: #17392e;
  --on-ink: #ffffff;
  --green: #276e50;
  --mint: #ddf9ea;
  --pale: #eaf9f1;
  --bg: #fcfdf9;
  --bg-alt: #f0f4ee;
  --surface: #ffffff;
  --muted: #5d7168;
  --line: #cedcd3;
  --focus: #36805b;
  --danger: #b42318;
  --star: #f59e0b;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ink: #eaf5ee;
    --on-ink: #17392e;
    --green: #6fcb9f;
    --mint: #1d3a2e;
    --pale: #172a21;
    --bg: #0f1a15;
    --bg-alt: #15231c;
    --surface: #172620;
    --muted: #9db3a7;
    --line: #2a3d34;
    --focus: #6fcb9f;
    --danger: #f87171;
    --star: #fbbf24;
  }
}
```

---

## 8. Components

| Component | Contents | Variants |
| --- | --- | --- |
| TripCard | Destination, relative time, seats left, meetup point, driver photo, name, college, cost note | Default, Full, Pending, Accepted, Compact |
| RequestCard | Rider photo, name, college, destination, window, seats, meetup point, Will chip in | Default, Own, Matched |
| StatusBadge | Colored pill with a status word | Open, Full, Pending, Accepted, Declined, Past, Cancelled |
| UserRow | Photo, name, college, verified badge | Plain, With Accept/Decline, With Message |
| TagChip, DestinationChip | Pills | Selectable, Selected, Read-only |
| Button | Primary, Secondary, Destructive | Default, Disabled, Loading |
| MeetupPointMap | Map with pins and names | Static, Interactive |
| Modal / BottomSheet | Title, content, actions | Desktop modal, phone sheet |
| SafetyNotice | Short plain note with a link to the Safety page | Inline, Footer |
| Toast, EmptyState, ErrorState, SkeletonRow | Standard feedback pieces | Per screen |

**Suggested build order:** design tokens, then TripCard, RequestCard, UserRow, and buttons; then screens in this order: Board, Trip detail, Request modal, Post, My Rides, Inbox and Chat, Profile, Sign in, Safety page, Admin. Use mock data until the flows feel right, then add the backend (auth, trips, requests, chat, email, meetup point admin).

---

## 9. Acceptance criteria

- [ ] A signed-out visitor can browse the board but must sign in to request, post, or message.
- [ ] Only school email addresses from allowed colleges can sign in.
- [ ] A rider can reach **Request a seat** in two clicks from the board.
- [ ] Posting a trip works from one form and uses approved meetup points only; no free-text meetup address exists anywhere.
- [ ] The exact meetup spot and the car's plate are hidden until the driver accepts.
- [ ] Accepting a request or offer reserves the seat, reveals the meetup spot, and opens chat in one transaction; overbooking is impossible.
- [ ] A rider can have no more than 2 open requests, none in the past or more than 7 days ahead, and notes with phone numbers, emails, handles, or links are blocked.
- [ ] Trips move to Past 2 hours after departure and chats close 24 hours after departure.
- [ ] Report and Block are reachable from every profile, trip, request, and chat, and blocked users never see each other.
- [ ] The Safety page is linked from the footer and every trip detail, and states plainly that the site does not supervise rides.
- [ ] No location, tracking, PIN, SOS, rating, or payment feature appears anywhere.
- [ ] Every page works at 360 px wide, in Light and Dark, with keyboard only, and with reduced motion on.

---

## 10. Decisions and launch checklist

### Decisions (these are the defaults to build)

- **Scope.** The site only matches students and picks a meetup point. Everything after the meetup is outside the app.
- **Community.** The five undergraduate colleges (Harvey Mudd, Pomona, Scripps, Claremont McKenna, Pitzer) are one community from day one. Each college is a campus with its own email domain and meetup points, and trips are visible across all five. Claremont Graduate University and Keck Graduate Institute come later.
- **Allowed sign-in domains.** `hmc.edu`, `g.hmc.edu`, `pomona.edu`, `scrippscollege.edu`, `cmc.edu`, `claremontmckenna.edu`, and `pitzer.edu`. Stored in a campus table so adding one needs no code change.
- **Notifications.** Email plus in-app badges.
- **Costs.** Drivers can only suggest a split of gas, tolls, and parking, capped at the actual estimate. The site never handles money and never lets anyone name a profit.
- **Moderation.** The founding team reviews reports within 24 hours.
- **Data kept.** Profiles, trips, requests, and chat messages. Chat messages are kept 12 months, and trips and requests 24 months. No location data is collected. Account deletion removes the profile and keeps trip and report history with the person's details removed.
- **Who can use it.** Verified students 18 or older with a school email. Drivers confirm they hold a valid license and insurance, and a parking pass where their campus requires one.

### Before launch

- [ ] Confirm each college's email domain with its IT office.
- [ ] Get written approval, or at least no objection, from each college's Dean of Students for using the college name and email domain.
- [ ] Confirm each college's campus safety phone number and show it on the Safety page.
- [ ] Confirm where a short pickup is allowed at each approved meetup point, so drivers never block fire lanes.
- [ ] Have counsel review the terms, the Safety page wording, the cost-sharing language, data retention, insurance disclosures for drivers, and whether anyone under 18 may use the site.
- [ ] Seed the board with a few real trips (a Trader Joe's run, a Sunday Farmers Market run, an airport trip before the next break) so it is never empty on day one.
