// Which parts of the app exist yet. Links and buttons to a part that isn't built are left out,
// not shown as dead ends. Each build step flips its flag.
export const FEATURES = {
  post: true,        // Step 5: offering a ride
  requestSeat: true,  // Step 6
  myRides: true,     // Step 6
  inbox: true,       // Step 6
  chat: true,        // Step 7
  inSearchOf: false, // Step 8: offering a ride and asking for one
  profile: false,    // Step 10 and 11
  report: false,     // Step 10
  safetyPage: false, // Step 11
} as const;
