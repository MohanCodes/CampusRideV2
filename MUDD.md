# Campus Ride at Harvey Mudd and the 5Cs

Localization file for the Campus Ride app: real destinations, pickup points, copy, and seed data for launching at **Harvey Mudd College (HMC)** in Claremont, California, with room to grow to the other Claremont Colleges (the 5Cs).

Researched October 6, 2026. Each row is marked **Verified** (found in a source listed at the end) or **Verify** (plausible, but confirm before launch). Nothing here has coordinates yet; geocode addresses in the app (MapKit or Google Places) instead of hard-coding guesses.

---

## 1. Campus profile

| Field | Value | Status |
| --- | --- | --- |
| Campus name | Harvey Mudd College | Verified |
| Address | 301 Platt Blvd, Claremont, CA 91711 | Verified |
| Location | Northern edge of The Claremont Colleges, between the 210 Freeway and Interstate 10; about 35 miles east of Los Angeles | Verified |
| Time zone | America/Los_Angeles | Verified |
| Email domains | `hmc.edu` and `g.hmc.edu` both appear on HMC pages | Verify with HMC IT |
| Campus safety | 909-607-2000 (non-emergency), 911 for emergencies | Verified |
| Student life contact | Office of the Dean of Students, 301 Platt Blvd | Verified |
| Housing | 99% of students live on campus all four years, so most have no daily need for a car and many don't have one | Verified |
| Neighbors | Pomona, Scripps, Claremont McKenna, Pitzer (undergraduate), plus Claremont Graduate University and Keck Graduate Institute | Verified |

**Why this campus fits.** Nearly everyone lives on campus, a lot of errands (groceries, Target, the airport) need a car, and the closest options are free or cheap but limited (see section 7). Campus Ride fills the gap between "walk to Trader Joe's" and "pay for an Uber to the airport."

---

## 2. Destinations (seed Places)

These replace the generic "Target, Airport, Grocery, Downtown" list. Order matters: the first few become the feed's destination chips.

### Everyday errands

| Place | Category | Address | Notes | Status |
| --- | --- | --- | --- | --- |
| Trader Joe's Claremont | Grocery | 475 W Foothill Blvd, Claremont, CA 91711 | About 0.9 miles west of campus on Foothill Blvd, and a roughly 30-minute walk from Pomona's campus. Phone 909-625-8784. The most common reason to ride when someone has heavy bags | Verified |
| Target (Montclair) | Shopping | 9052 Central Ave, Montclair, CA 91763 | Default "Target." A short walk from Foothill Transit routes 480 and 492; the usual 5C orientation "Target Night" shuttles go to Montclair | Verified |
| Target (Upland) | Shopping | 1931 Campus Ave, Upland, CA 91784 | Near the 210 Freeway (exit 56) | Verified |
| Target (La Verne) | Shopping | 2462 Foothill Blvd, La Verne, CA 91750 | La Verne Town Center | Verified |
| Vons | Grocery | 81 W Foothill Blvd, Claremont, CA 91711 (and 1600 Foothill Blvd) | Listed on delivery apps; confirm which locations are open | Verify |
| Whole Foods Market | Grocery | Baseline Rd at Monte Vista Ave (listed as 590 E Baseline Rd) | The building is reported to be in Upland even though it's marketed as Claremont; confirm it's open and the exact address | Verify |
| Priceless Pets | Community | Just across Foothill Blvd from campus | Where the Mudders Make a Difference club does weekend dog-walking; a nice "volunteer trip" destination | Verified |

### Food and hangouts

| Place | Category | Address | Notes | Status |
| --- | --- | --- | --- | --- |
| Claremont Village | Food and shops | Around Indian Hill Blvd, Yale Ave, and Harvard Ave | About a mile south of campus. Cafes, restaurants, shops, and some student discounts. Walkable once you're there, but a long walk from campus | Verified |
| Claremont Farmers and Artisans Market | Market | Harvard Ave in the Village, between 1st St and Bonita Ave, across from City Hall | Sundays, 8 a.m. to 1 p.m., year-round. Some listings place it near Indian Hill Blvd and 2nd St, so confirm the exact spot | Verified (hours), Verify (spot) |
| Claremont Packing House | Food and shops | Next to the Village on First St | Restaurants, shops, and the Claremont Lewis Museum of Art | Verified |
| Rancho Santa Ana Botanic Garden | Outdoors | Claremont | A good low-cost weekend outing | Verified |

### Bigger shopping trips

| Place | Category | Where | Notes | Status |
| --- | --- | --- | --- | --- |
| Montclair Plaza | Mall | 5060 E Montclair Plaza Ln, Montclair, CA | Near the Montclair Target | Verified |
| Ontario Mills | Outlet mall | I-10 at I-15, Ontario | Largest outlet mall in the area | Verified |
| Victoria Gardens | Shopping | I-15 at Foothill Blvd, Rancho Cucamonga | Outdoor shopping center | Verified |

### Transit and travel

| Place | Category | Address | Notes | Status |
| --- | --- | --- | --- | --- |
| Ontario International Airport (ONT) | Airport | Ontario, CA | The closest major airport, about 10 miles and 15 to 20 minutes by car. HMC does not run a shuttle. Some students say they've moved from LAX to ONT for the shorter trip | Verified |
| Los Angeles International Airport (LAX) | Airport | Los Angeles, CA | About 1 hour 15 minutes by car with light traffic. The reason most "holiday break" rides are posted | Verified |
| Burbank, Long Beach, and John Wayne (SNA) airports | Airport | Various | Roughly an hour away; SNA is about 30 miles. Add later if requested | Verified |
| Claremont Metrolink Station (Claremont Depot) | Transit | 200 W 1st St, Claremont, CA 91711 | About a mile from campus. San Bernardino Line to LA Union Station. Reported 50% student discount; tickets sold on the platform. Connects to Foothill Transit routes 188, 197, 292, 480, and 492 | Verified |
| LA Union Station | Transit | Los Angeles, CA | Reachable by Metrolink in about an hour | Verified |

### Suggested feed chips for Harvey Mudd

`All` · `Trader Joe's` · `Target` · `The Village` · `Airport (ONT)` · `LA / LAX` · `Other`

Keep the chip row at 6 or fewer so it fits on one line. Move Vons, Whole Foods, and the malls under **Other** until demand shows they need their own chip.

---

## 3. Pickup points

The product spec requires fixed public pickup points so home addresses are never shared. On a campus where almost everyone lives in the same dozen buildings, the pickup list is just the campus map.

### Harvey Mudd

| Pickup point | Type | Notes | Status |
| --- | --- | --- | --- |
| Platt Campus Center | Hub | Student center; the best default pickup | Verified |
| Hoch-Shanahan Dining Commons | Hub | Everyone passes through at mealtimes | Verified |
| Linde Activities Center | Hub | Near the athletic and activity facilities | Verified |
| R. Michael Shanahan Center | Academic | Teaching and learning building; handy for weekday trips after class | Verified |
| Atwood Hall | Residence | Residence halls below are the nine HMC halls | Verified |
| Case Hall | Residence | | Verified |
| Drinkward Hall | Residence | | Verified |
| East Hall (Mudd Hall) | Residence | Oldest hall | Verified |
| Linde Hall | Residence | Farthest from the academic side | Verified |
| North Hall | Residence | | Verified |
| Sontag Hall | Residence | | Verified |
| South Hall (Marks) | Residence | | Verified |
| West Hall | Residence | | Verified |

Garrett House is private and should not be a pickup point.

### Shared 5C

| Pickup point | Notes | Status |
| --- | --- | --- |
| Honnold/Mudd Library | 800 N Dartmouth Ave; shared by all the colleges and the "Connection" desk where students pick up Foothill Transit passes | Verified |
| Smith Campus Center (Pomona) | Pomona's main student hub | Verified |
| Balch Hall (Scripps) | Scripps' formal entrance and administrative center | Verified |
| Claremont Depot (Metrolink) | 200 W 1st St | Verified |
| Pitzer and Claremont McKenna points | Add once launch expands; not researched yet | To add |

### Parking and pickup rules to confirm with HMC

- HMC's parking map says Harvey Mudd lots are for the community only, and overnight parking on Claremont streets is not allowed. Student parking requires a pass, so require drivers to confirm they have one.
- Older HMC maps show public parking on Platt Blvd and Foothill Blvd. Ask Campus Safety where a short, quick pickup is allowed so drivers don't block fire lanes.
- There is an EV charging station in the northwest lot; useful if the driver is heading out in an EV.

---

## 4. What exists today (and how Campus Ride fits)

| Option | What it gives students | Gap Campus Ride fills |
| --- | --- | --- |
| Foothill Transit Class Pass | Free rides on Foothill Transit local and Silver Streak buses for enrolled Claremont Colleges students, picked up at the Connection in Honnold/Mudd Library | Buses are slow for grocery bags, and nothing runs late at night. Confirm the pass is still offered |
| Metrolink | Direct service to LA Union Station from the Claremont station, reported 50% off for students | Runs on a schedule and ends at Union Station, not the airport |
| Zipcar | Several locations on the Claremont Colleges | Costs money and needs a license and a booking |
| Dial-a-ride | Reported $2.50 for rides inside Claremont, booked 45 minutes ahead | Limited reach and advance notice |
| Walking and biking | Trader Joe's is under a mile away | Not great with heavy bags or in summer heat |
| Uber and Lyft | On demand | Expensive for a short Target run |
| Orientation Target Night | First-years get a shuttle to Target once | Only once a year |

**Positioning.** Campus Ride is not a replacement for any of these. It's the "I'm already going, want to come?" option, which costs almost nothing and gets people to the places buses and trains don't.

---

## 5. Copy updates

| Where | Generic copy | Harvey Mudd copy |
| --- | --- | --- |
| Tagline | Going somewhere? Bring a friend. | Heading to Trader Joe's? Bring a Mudder. |
| Welcome screen | Rides to Target, the airport, anywhere. | Rides to Trader Joe's, Target, the Village, and ONT. |
| School email error | Use your school email. | Use your hmc.edu email. |
| Empty feed | No rides to Target yet. | No rides to Trader Joe's yet. |
| Post a trip, default place | Target | Trader Joe's |
| Pickup hint | Meet at the pickup point. | Meet at Platt Campus Center or your hall's entrance. |
| Cost note helper | Suggested: share gas and parking. | Suggested: split gas and parking (about $3 each for a 3-person Target run). |
| Emergency sheet | 911 and campus safety | 911 and HMC Campus Safety (909-607-2000) |
| Safety pledge | Meet at pickup points, share your trip, report anything off. | Meet at a campus pickup point, share your trip, and report anything off to Campus Safety. |

**Honor Code idea (to check with HMC).** The college runs on an Honor Code. A short, optional line in onboarding that ties the safety pledge to community values could feel native to Mudd. Run it by the Dean of Students first, since the app shouldn't speak for the Honor Code.

---

## 6. Demand moments for launch

| Moment | Likely trip | Notes |
| --- | --- | --- |
| Move-in and orientation weeks | Target and Trader Joe's | First-years need supplies and don't know the area. The 5Cs already run Target shuttles, so promote Campus Ride for everything after that |
| Thanksgiving, winter, and spring breaks | ONT and LAX | Fill the airport chip with flights posted a week ahead |
| Sunday mornings | Farmers Market in the Village | Easy, cheap, social trip; the market runs 8 a.m. to 1 p.m. |
| Weekend afternoons | Trader Joe's, Montclair Plaza, Ontario Mills | Regular errands |
| Finals week | Grocery runs and late-night food | People are busy and short on time |

**Seed the first week** with a few real trips from your own friends: a Saturday Trader Joe's run, a Sunday Farmers Market run, and one airport trip before the next break, so the feed is never empty at launch.

---

## 7. Launch scope

1. **Phase 1: Harvey Mudd only.** Use the HMC email domain, the HMC pickup list, and the destinations in section 2.
2. **Phase 2: the other 5Cs.** Add each college's email domain and pickup points, and let riders see trips across all five colleges (they share the Library, many classes, and the Village).
3. **Phase 3: Claremont Graduate University and Keck Graduate Institute.**

Because everything in the data model is keyed by campus, adding a college means adding a Campus row, its email domain, and its pickup points, not rebuilding the app. Consider modeling the 5Cs as one "community" with several campuses so trips can be visible across them.

---

## 8. Seed data (JSON)

Load this as mock data for the feed, place search, and pickup picker. Coordinates are left null on purpose; fill them in with geocoding.

```json
{
  "campus": {
    "id": "hmc",
    "name": "Harvey Mudd College",
    "emailDomains": ["hmc.edu", "g.hmc.edu"],
    "timezone": "America/Los_Angeles",
    "address": "301 Platt Blvd, Claremont, CA 91711",
    "campusSafetyPhone": "909-607-2000"
  },
  "places": [
    { "id": "tj-claremont", "name": "Trader Joe's", "category": "grocery", "address": "475 W Foothill Blvd, Claremont, CA 91711", "chip": "Trader Joe's", "lat": null, "lng": null },
    { "id": "target-montclair", "name": "Target (Montclair)", "category": "shopping", "address": "9052 Central Ave, Montclair, CA 91763", "chip": "Target", "lat": null, "lng": null },
    { "id": "target-upland", "name": "Target (Upland)", "category": "shopping", "address": "1931 Campus Ave, Upland, CA 91784", "chip": "Target", "lat": null, "lng": null },
    { "id": "target-laverne", "name": "Target (La Verne)", "category": "shopping", "address": "2462 Foothill Blvd, La Verne, CA 91750", "chip": "Target", "lat": null, "lng": null },
    { "id": "village", "name": "Claremont Village", "category": "food", "address": "Indian Hill Blvd and Yale Ave, Claremont, CA 91711", "chip": "The Village", "lat": null, "lng": null },
    { "id": "farmers-market", "name": "Claremont Farmers Market (Sundays 8am-1pm)", "category": "market", "address": "Harvard Ave, Claremont, CA 91711", "chip": "The Village", "lat": null, "lng": null },
    { "id": "ont", "name": "Ontario International Airport (ONT)", "category": "airport", "address": "Ontario, CA", "chip": "Airport (ONT)", "lat": null, "lng": null },
    { "id": "lax", "name": "Los Angeles International Airport (LAX)", "category": "airport", "address": "Los Angeles, CA", "chip": "LA / LAX", "lat": null, "lng": null },
    { "id": "union-station", "name": "LA Union Station", "category": "transit", "address": "Los Angeles, CA", "chip": "LA / LAX", "lat": null, "lng": null },
    { "id": "claremont-depot", "name": "Claremont Metrolink Station", "category": "transit", "address": "200 W 1st St, Claremont, CA 91711", "chip": "Other", "lat": null, "lng": null },
    { "id": "montclair-plaza", "name": "Montclair Plaza", "category": "mall", "address": "5060 E Montclair Plaza Ln, Montclair, CA", "chip": "Other", "lat": null, "lng": null },
    { "id": "ontario-mills", "name": "Ontario Mills", "category": "mall", "address": "I-10 at I-15, Ontario, CA", "chip": "Other", "lat": null, "lng": null },
    { "id": "victoria-gardens", "name": "Victoria Gardens", "category": "mall", "address": "I-15 at Foothill Blvd, Rancho Cucamonga, CA", "chip": "Other", "lat": null, "lng": null },
    { "id": "priceless-pets", "name": "Priceless Pets", "category": "community", "address": "Foothill Blvd, Claremont, CA", "chip": "Other", "lat": null, "lng": null }
  ],
  "pickupPoints": [
    { "id": "platt", "name": "Platt Campus Center", "type": "hub", "default": true },
    { "id": "hoch-shanahan", "name": "Hoch-Shanahan Dining Commons", "type": "hub" },
    { "id": "linde-activities", "name": "Linde Activities Center", "type": "hub" },
    { "id": "shanahan", "name": "Shanahan Center", "type": "academic" },
    { "id": "atwood", "name": "Atwood Hall", "type": "residence" },
    { "id": "case", "name": "Case Hall", "type": "residence" },
    { "id": "drinkward", "name": "Drinkward Hall", "type": "residence" },
    { "id": "east", "name": "East Hall", "type": "residence" },
    { "id": "linde-hall", "name": "Linde Hall", "type": "residence" },
    { "id": "north", "name": "North Hall", "type": "residence" },
    { "id": "sontag", "name": "Sontag Hall", "type": "residence" },
    { "id": "south", "name": "South Hall", "type": "residence" },
    { "id": "west", "name": "West Hall", "type": "residence" },
    { "id": "honnold", "name": "Honnold/Mudd Library", "type": "shared-5c" },
    { "id": "smith", "name": "Smith Campus Center (Pomona)", "type": "shared-5c" },
    { "id": "balch", "name": "Balch Hall (Scripps)", "type": "shared-5c" },
    { "id": "depot", "name": "Claremont Depot (Metrolink)", "type": "transit" }
  ],
  "feedChips": ["All", "Trader Joe's", "Target", "The Village", "Airport (ONT)", "LA / LAX", "Other"]
}
```

---

## 9. Confirm before launch

- [ ] Email domains for HMC (and each 5C when added) with each college's IT.
- [ ] Which Vons locations are open, and whether the Baseline Rd Whole Foods is open and where it actually is.
- [ ] Exact spot and current hours of the Sunday Farmers Market.
- [ ] Whether the Foothill Transit Class Pass is still offered and how it works now.
- [ ] Dial-a-ride price and rules, and the current Metrolink student discount.
- [ ] Campus Safety phone number (909-607-2000) for the emergency sheet.
- [ ] HMC parking rules for pickups, and whether drivers need a parking pass.
- [ ] Whether HMC allows a student rideshare app to use its name or email domain (ask the Dean of Students).
- [ ] Insurance and liability (see the Product Spec's legal section).
- [ ] Which Pitzer and Claremont McKenna pickup points to add.

---

## Sources

- [Harvey Mudd, Visit Campus](https://www.hmc.edu/about-hmc/visit-campus/)
- [Harvey Mudd, Travel Information](https://hmc.edu/student-life/?p=3977)
- [Harvey Mudd, A Mile From Mudd](https://hmc.edu/admission/?p=23869)
- [Harvey Mudd, Campus map handout](https://hmc.edu/about/wp-content/uploads/sites/2/2024/08/Campus-map-handout.pdf)
- [Harvey Mudd, Parking map and directory](https://www.hmc.edu/facilities-maintenance/wp-content/uploads/sites/17/2021/08/accessible_HMC-MAP-and-Parking-Directory-2021-FINAL.pdf)
- [Harvey Mudd, Residence Halls](https://www.hmc.edu/residential/halls)
- [Harvey Mudd, Housing and Residential Life](https://www.hmc.edu/student-life/residence-life/)
- [Harvey Mudd, Foothill Transit Class Pass](https://www.hmc.edu/about/?p=6232)
- [Trader Joe's Claremont listing](https://allstays.com/c/trader-joes-california-locations.htm)
- [Target Montclair](https://www.storeopeninghours.com/target-montclair-ca)
- [Target Upland](https://www.storeopeninghours.com/target-upland-ca)
- [Target La Verne](https://www.storeopeninghours.com/target-la-verne-ca)
- [Pomona student blog, Car-Less in Claremont](https://voices.pomona.edu/2021/01/car-less-in-claremont/)
- [Claremont McKenna shopping guide](https://Claremontmckenna.edu/sites/default/files/orientation/ShoppingGuide.pdf)
- [Pomona public transportation guide](https://www.pomona.edu/sites/default/files/public-transportation-guide.pdf)
- [Metrolink, Claremont Village](https://metrolinktrains.com/explore/destinations/claremont-village/)
- [City of Claremont, Metrolink Station](https://www.claremontca.gov/City-Services/Roads/Transportation/Metrolink-Station)
- [Claremont station (Wikipedia)](https://en.wikipedia.org/wiki/Claremont_station_(California))
- [Scripps College, Getting Around](https://www.scrippscollege.edu/sustainability/getting-around)
- [Scripps College, Getting to Campus](https://www.scrippscollege.edu/life/creating-community/international-students/getting-to-campus)
- [Pitzer College, Campus Map and Directions](https://www.pitzer.edu/about/maps-directions/)
- [Claremont Farmers Market listing](https://marketspread.com/market/33534/claremont-farmers-artisans-market)
- [Claremont Courier, Whole Foods in Claremont](https://claremont-courier.com/?p=34235)