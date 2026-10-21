export const staCapabilities = [
  "TEACHING",
  "ASSESSMENT",
  "PLANNING",
  "COMMUNICATION",
  "ADMIN",
  "WELLBEING",
  "ATLAS",
  "RESEARCH",
  "INNOVATION",
] as const;

export type StaCapability = (typeof staCapabilities)[number];

export type StaRoute = {
  capability: StaCapability;
  handler: "SPACECASE" | "ATLAS_ADAPTER";
  requiresLearnerAuthority: boolean;
};

const routes: Record<StaCapability, StaRoute> = {
  TEACHING: { capability: "TEACHING", handler: "SPACECASE", requiresLearnerAuthority: false },
  ASSESSMENT: { capability: "ASSESSMENT", handler: "SPACECASE", requiresLearnerAuthority: true },
  PLANNING: { capability: "PLANNING", handler: "SPACECASE", requiresLearnerAuthority: false },
  COMMUNICATION: { capability: "COMMUNICATION", handler: "SPACECASE", requiresLearnerAuthority: false },
  ADMIN: { capability: "ADMIN", handler: "SPACECASE", requiresLearnerAuthority: false },
  WELLBEING: { capability: "WELLBEING", handler: "SPACECASE", requiresLearnerAuthority: true },
  ATLAS: { capability: "ATLAS", handler: "ATLAS_ADAPTER", requiresLearnerAuthority: true },
  RESEARCH: { capability: "RESEARCH", handler: "SPACECASE", requiresLearnerAuthority: false },
  INNOVATION: { capability: "INNOVATION", handler: "SPACECASE", requiresLearnerAuthority: false },
};

export function routeStaCapability(capability: StaCapability): StaRoute {
  return routes[capability];
}
