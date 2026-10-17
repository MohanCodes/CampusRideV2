export const seatsLeftText = (n: number) => `${n} ${n === 1 ? "seat" : "seats"} left`;
export const seatsText = (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`;

export function initials(firstName: string): string {
  return (firstName.trim()[0] ?? "?").toUpperCase();
}

// WEB_FLOWS.md Section 6.2: the short text a rider can send to a friend.
export function tripSummary(t: {
  driverFirstName: string; carMake: string; carColor: string; plate: string;
  destination: string; when: string; meetupPoint: string; standAt: string | null;
}): string {
  return [
    `${t.driverFirstName} is driving to ${t.destination}, ${t.when}.`,
    `Car: ${t.carColor} ${t.carMake}, plate ${t.plate}.`,
    `Meet at ${t.meetupPoint}${t.standAt ? ` (${t.standAt})` : ""}.`,
  ].join("\n");
}
