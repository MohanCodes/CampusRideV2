// Which parts of the app exist yet. Links and buttons to a part that isn't built are left out,
// not shown as dead ends. Each build step flips its flag.
export const FEATURES = {
  post: true,        // Step 5: offering a ride
  requestSeat: true,  // Step 6
  myRides: true,     // Step 6
  inbox: true,       // Step 6
  chat: true,        // Step 7
  inSearchOf: true,  // Step 8: asking for a ride and offering one
  profile: true,     // Step 11: /me, settings
  report: true,      // Step 10: report and block
  userProfile: true, // Step 10: other people's profiles
  admin: true,       // Step 10: admin pages
  safetyPage: true,  // Step 11
} as const;
