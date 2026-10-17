export const CAMPUS_TZ = "America/Los_Angeles";

export const CAMPUS_IDS = ["hmc", "pomona", "scripps", "cmc", "pitzer"] as const;
export type CampusId = (typeof CAMPUS_IDS)[number];

// Short names for cards and filters. Full names come from the campuses table.
export const CAMPUS_SHORT: Record<CampusId, string> = {
  hmc: "Harvey Mudd",
  pomona: "Pomona",
  scripps: "Scripps",
  cmc: "Claremont McKenna",
  pitzer: "Pitzer",
};

export const isCampusId = (v: unknown): v is CampusId => CAMPUS_IDS.includes(v as CampusId);
export const campusShortName = (id: string) => (isCampusId(id) ? CAMPUS_SHORT[id] : "Claremont Colleges");
