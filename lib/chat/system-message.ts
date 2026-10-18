// The app writes notices into a chat ("Sam accepted Riley.") once, with first names, for both people to see. Each person
// should read them as addressed to them: "You accepted Riley." for the one who did it, "Sam accepted you." for the other.
// `fromMe` is whether this person is the one the notice was written as (the sender). Anything not recognized is shown as written.

const PICKUP = "You can plan the pickup here.";

export function personalizeSystemMessage(body: string, fromMe: boolean): string {
  // A rider accepted a driver's offer. The driver is the sender: "Riley accepted Sam's offer."
  let m = /^(.+?) accepted (.+?)'s offer\. (.+)$/.exec(body);
  if (m) return fromMe ? `${m[1]} accepted your offer. ${m[3]}` : `You accepted ${m[2]}'s offer. ${m[3]}`;

  // A driver accepted a rider. The driver is the sender: "Sam accepted Riley."
  m = /^(.+?) accepted (.+?)\. (.+)$/.exec(body);
  if (m && m[3] === PICKUP) return fromMe ? `You accepted ${m[2]}. ${m[3]}` : `${m[1]} accepted you. ${m[3]}`;

  // The sender did something themselves: the name opens the sentence.
  if (fromMe) {
    m = /^(.+?) cancelled their seat\.$/.exec(body);
    if (m) return "You cancelled your seat.";
    m = /^(.+?) cancelled this trip\.$/.exec(body);
    if (m) return "You cancelled this trip.";
    m = /^(.+?) changed the departure time\. (.+)$/.exec(body);
    if (m) return `You changed the departure time. ${m[2]}`;
  }
  return body;
}
