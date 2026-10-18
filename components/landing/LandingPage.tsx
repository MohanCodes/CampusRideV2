import Link from "next/link";
import { TripCard } from "@/components/board/TripCard";
import { Eyebrow } from "@/components/Eyebrow";
import { LegalLinks } from "@/components/LegalLinks";
import { Logo } from "@/components/Logo";
import { demoTrips } from "@/lib/data/mock";

const COLLEGES = ["Harvey Mudd", "Claremont McKenna", "Pomona", "Pitzer", "Scripps"];

const STEPS = [
  {
    n: "01",
    title: "Share your trip",
    body: "Already driving somewhere? Post where you're going, when you leave, and how many seats are open.",
  },
  {
    n: "02",
    title: "Find your direction",
    body: "Need a ride? Browse student trips that fit your destination and schedule, or ask for one.",
  },
  {
    n: "03",
    title: "Meet and go",
    body: "Pick an approved public meetup point and a time. The ride itself, and any gas money, is between you.",
  },
];

const DESTINATIONS = [
  { name: "Grocery runs", where: "Trader Joe's, Target" },
  { name: "Airport trips", where: "Ontario (ONT), LAX" },
  { name: "Time off campus", where: "The Village, Farmers Market" },
];

const FAQ = [
  {
    q: "Is CampusRide available yet?",
    a: "Not yet. We're building it now, starting with the Claremont Colleges. This page shows what's coming.",
  },
  {
    q: "Who is CampusRide for?",
    a: "Students at the 5Cs with a school email. Drivers already have a trip planned and share empty seats. Riders find someone heading the same way.",
  },
  {
    q: "How is this different from ride-hailing?",
    a: "Every trip is one a student driver was already making. You're not requesting a professional driver. You're joining a classmate.",
  },
  {
    q: "How much will a ride cost?",
    a: "Drivers can suggest a split of gas and parking, never a profit. CampusRide doesn't handle money, so you settle up with each other.",
  },
  {
    q: "What about safety?",
    a: "Campus Ride connects students. It doesn't supervise rides or run background checks. Use your judgment, and call 911 in an emergency.",
  },
];

export function LandingPage() {
  const now = new Date();
  const sampleTrips = demoTrips(now)
    .filter((t) => !t.isOwn)
    .slice(0, 3)
    .map((t) => ({ ...t, myStatus: null }));
  return (
    <>
      <header>
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-[78px] max-w-[1280px] items-center justify-between px-4 sm:px-[25px] min-[651px]:h-[92px] lg:px-12"
        >
          <Logo />
          <div className="flex items-center gap-[15px] text-sm min-[651px]:gap-8">
            <a href="#about" className="hidden min-[651px]:inline">
              About
            </a>
            <a href="#how" className="hidden min-[651px]:inline">
              How it works
            </a>
            <a href="#faq" className="hidden min-[651px]:inline">
              FAQ
            </a>
            <Link href="/sign-in" className="btn-secondary">
              Sign in
            </Link>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto w-[calc(100%-2rem)] max-w-[1320px] overflow-hidden rounded-[28px] bg-mint px-6 pt-12 sm:w-[calc(100%-3rem)] md:px-16 md:pt-[72px]">
          <div className="grid items-center gap-6">
            <div className="text-center">
              <Eyebrow center>For students at the 5Cs</Eyebrow>
              <h1 className="t-display mb-[25px] mt-[29px]">
                Same direction.
                <br />
                <em className="font-serif font-normal">Better together.</em>
              </h1>
              <p className="mx-auto max-w-[435px] text-lg text-muted">
                Rides with students you can trust. Find someone already heading your way, then
                choose an approved public place to meet.
              </p>
              <a href="#how" className="btn-primary mt-[18px]">
                See how it works <span aria-hidden="true">↗</span>
              </a>
              <p className="t-small mb-6 mt-[17px] text-muted">Built by students.</p>
            </div>

            <div
              role="img"
              aria-label="Illustration of the CampusRide board showing two trips: Trader Joe's and Ontario Airport"
              className="relative mx-auto grid min-h-[440px] w-full max-w-[560px] place-items-center md:min-h-[488px]"
            >
              <div
                aria-hidden="true"
                className="absolute size-[320px] rounded-full border border-line md:size-[420px]"
              >
                <div className="absolute inset-[44px] rounded-full border border-dashed border-line" />
              </div>

              <div
                aria-hidden="true"
                className="absolute right-[8%] top-[55px] z-[3] max-[650px]:hidden rotate-[-5deg] rounded-[13px] border border-line bg-surface px-[19px] py-[15px] text-xs soft-shadow md:right-0 md:top-20"
              >
                Already making the trip?
                <b className="mt-1 block text-sm">Bring someone along. ↗</b>
              </div>

              <div
                aria-hidden="true"
                className="relative z-[2] w-[245px] rotate-[5deg] rounded-[36px] border-[7px] border-ink bg-surface p-4 soft-shadow"
              >
                <div className="-mt-[7px] mb-5 ml-auto mr-auto h-[14px] w-[67px] rounded-full bg-ink" />
                <div className="mb-[23px] text-[13px] font-bold">↗ CampusRide</div>
                <div className="text-[10px] text-muted">YOUR NEXT TRIP</div>
                <div className="mb-[5px] mt-[10px] text-[23px] tracking-[-0.04em]">Where to?</div>
                <div className="text-[10px] text-muted">Find students heading your way.</div>
                <div className="relative -mx-[2px] my-[15px] h-[119px] overflow-hidden rounded-xl bg-pale">
                  <svg viewBox="0 0 220 130" className="size-full">
                    <path
                      d="M0 25H220M0 65H220M0 105H220M40 0V130M100 0V130M160 0V130"
                      fill="none"
                      className="stroke-surface"
                      strokeWidth="12"
                    />
                    <path
                      d="M42 99V65H157V27"
                      fill="none"
                      className="stroke-green"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="5 5"
                    />
                    <circle cx="42" cy="99" r="8" className="fill-ink stroke-surface" strokeWidth="3" />
                    <circle cx="157" cy="27" r="8" className="fill-ink stroke-surface" strokeWidth="3" />
                  </svg>
                </div>
                {[
                  { to: "Trader Joe's", when: "Grocery run · This afternoon", seats: "2 open seats", who: "S" },
                  { to: "Ontario Airport", when: "Airport trip · This weekend", seats: "1 open seat", who: "J" },
                ].map((t) => (
                  <div key={t.to} className="mt-[9px] rounded-xl border border-line bg-surface p-3">
                    <strong className="text-xs">Claremont → {t.to}</strong>
                    <p className="my-[6px] text-[10px] leading-normal text-muted">{t.when}</p>
                    <div className="flex justify-between border-t border-line pt-[9px] text-[9px]">
                      <span>
                        <span className="inline-grid size-5 place-items-center rounded-full bg-mint text-[9px]">
                          {t.who}
                        </span>{" "}
                        Student driver
                      </span>
                      <span className="tabular">{t.seats}</span>
                    </div>
                  </div>
                ))}
                <div className="mb-px mt-[15px] text-center text-[9px] text-muted">
                  Illustrative concept
                </div>
              </div>

              <div
                aria-hidden="true"
                className="absolute bottom-[35px] left-[3%] z-[3] max-[650px]:hidden rotate-[-5deg] rounded-[13px] border border-line bg-surface px-[19px] py-[15px] text-xs soft-shadow md:bottom-[78px] md:left-0"
              >
                One trip. A shared destination.
                <b className="mt-1 block text-sm">Fewer empty seats.</b>
              </div>
            </div>
          </div>

          <div className="mt-[25px] border-t border-line py-6 md:mt-10 md:flex md:items-center md:justify-between">
            <span className="t-label">Our first community</span>
            <ul className="mt-[10px] flex flex-wrap gap-x-[15px] gap-y-1 text-[13px] font-semibold md:mt-0 md:gap-[26px]">
              {COLLEGES.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* 01 Why */}
        <section id="about" className="mx-auto max-w-[1180px] px-4 py-[70px] sm:px-[25px] md:py-[100px]">
          <div className="grid gap-10 md:grid-cols-2 md:gap-[100px]">
            <div>
              <Eyebrow>01 / Why CampusRide</Eyebrow>
              <h2 className="t-h1 my-[22px]">
                Getting off campus
                <br />
                should feel simple.
              </h2>
            </div>
            <div className="text-[1.0625rem] text-muted md:mt-[43px]">
              <p>
                A grocery run, a flight home, a day in LA. Students without cars often face
                expensive rides or slow transit. Meanwhile, other students are making the same
                trips with empty seats.
              </p>
              <p>CampusRide helps those students find each other.</p>
              <div className="flex gap-10 pt-[22px] md:gap-[60px]">
                <div>
                  <strong className="tabular text-[2.5rem] font-medium leading-none tracking-[-0.05em] text-ink">
                    40+
                  </strong>
                  <span className="t-small mt-[7px] block">Student discovery interviews</span>
                </div>
                <div>
                  <strong className="tabular text-[2.5rem] font-medium leading-none tracking-[-0.05em] text-ink">
                    8
                  </strong>
                  <span className="t-small mt-[7px] block">Prototype testers</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 How it works */}
        <section id="how" className="border-y border-line bg-bg-alt">
          <div className="mx-auto max-w-[1180px] px-4 py-[70px] sm:px-[25px] md:py-[100px]">
            <div className="items-end justify-between gap-[30px] md:flex">
              <div>
                <Eyebrow>02 / How it works</Eyebrow>
                <h2 className="t-h1 my-[22px]">
                  A shared ride starts
                  <br />
                  with a shared plan.
                </h2>
              </div>
              <p className="t-small max-w-[335px] text-muted">
                CampusRide connects planned student trips with people going the same way, at a
                similar time.
              </p>
            </div>
            <ol className="mt-[46px] grid gap-[25px] md:grid-cols-3 md:gap-[45px]">
              {STEPS.map((s) => (
                <li key={s.n} className="border-t border-line pt-[22px]">
                  <span className="font-serif text-lg text-green">{s.n}</span>
                  <h3 className="t-h2 mb-[15px] mt-[15px] md:mt-8">{s.title}</h3>
                  <p className="t-small text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Sample board: a read-only look at the cards. Real trips are for signed-in students. */}
        <section aria-labelledby="preview-heading" className="mx-auto max-w-[1180px] px-4 pt-[70px] sm:px-[25px] md:pt-[100px]">
          <Eyebrow>Sample trips</Eyebrow>
          <h2 id="preview-heading" className="t-h1 my-[22px]">
            A look at the board.
          </h2>
          <p className="max-w-[52ch] text-muted">
            These are examples, not real trips. Sign in with your school email to see what students are posting.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {sampleTrips.map((t) => (
              <TripCard key={t.id} trip={t} now={now} href={null} />
            ))}
          </div>
        </section>

        {/* 03 Destinations + mission */}
        <section className="mx-auto max-w-[1180px] px-4 py-[70px] sm:px-[25px] md:py-[100px]">
          <div className="grid items-center gap-[25px] md:grid-cols-[0.9fr_1.1fr] md:gap-[90px]">
            <div>
              <Eyebrow>03 / Beyond campus</Eyebrow>
              <h2 className="t-h1 my-[22px]">
                Everyday errands.
                <br />
                Weekend plans.
                <br />A way home.
              </h2>
              <p className="max-w-[345px] text-muted">
                Built around the places students actually need to go, starting with the Claremont
                Colleges.
              </p>
            </div>
            <ul className="border-t border-line">
              {DESTINATIONS.map((d) => (
                <li
                  key={d.name}
                  className="flex justify-between gap-4 border-b border-line py-6 text-[1.3125rem]"
                >
                  <span>{d.name}</span>
                  <small className="self-center text-right text-xs text-muted">{d.where}</small>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel-ink mt-[55px] grid gap-[15px] rounded-[22px] p-[35px] md:mt-[75px] md:grid-cols-[1.2fr_0.8fr] md:gap-[70px] md:p-[60px]">
            <div>
              <Eyebrow>Built by students</Eyebrow>
              <h2 className="t-h1 mb-0 mt-[22px] text-[2rem] md:text-[2.4rem]">
                Starting in Claremont.
                <br />
                Thinking beyond it.
              </h2>
            </div>
            <div className="panel-ink-muted text-[0.9375rem]">
              <p>
                We&rsquo;re a student team building CampusRide around what we&rsquo;ve heard from
                our own campus community.
              </p>
              <p>
                Our first focus is the 5Cs. Over time, we want to help students at more colleges
                share the trips they&rsquo;re already making.
              </p>
            </div>
          </div>
        </section>

        {/* 04 FAQ */}
        <section id="faq" className="mx-auto max-w-[1180px] px-4 pb-[70px] sm:px-[25px] md:pb-[100px]">
          <div className="grid gap-[5px] md:grid-cols-[1fr_1.3fr] md:gap-20">
            <div>
              <Eyebrow>04 / A few things to know</Eyebrow>
              <h2 className="t-h1 my-[22px]">
                Before the
                <br />
                first ride.
              </h2>
            </div>
            <div>
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0} className="group border-b border-line py-[22px]">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-5 text-[1.0625rem] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span
                      aria-hidden="true"
                      className="text-2xl text-green group-open:before:content-['−'] before:content-['+']"
                    />
                  </summary>
                  <p className="t-small mt-3 max-w-[530px] text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="bg-mint px-4 py-[70px] text-center sm:px-[25px]">
          <Eyebrow center>The road ahead</Eyebrow>
          <h2 className="t-h1 my-[22px] text-[2.7rem] md:text-[3.5rem]">
            More places. More possibilities.
          </h2>
          <p className="text-[0.9375rem] text-muted">A student carpooling site for life beyond campus.</p>
          <div className="t-small mt-[13px] inline-flex items-center gap-[9px] rounded-full border border-line px-5 py-[13px]">
            <span aria-hidden="true" className="size-[7px] rounded-full bg-green" />
            CampusRide · In development
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-[30px] sm:px-[25px] md:flex-row md:items-center md:justify-between lg:px-12">
        <Logo />
        <LegalLinks />
        <p className="t-small text-muted">
          © 2026 CampusRide.
        </p>
      </footer>
    </>
  );
}
