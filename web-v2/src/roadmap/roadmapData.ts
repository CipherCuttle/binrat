import capabilityManifest from "../../../docs/CAPABILITY_MANIFEST_V0.json";
import projection from "./roadmapProjection.json";

export type RoadmapStageId =
  | "sniff"
  | "remember"
  | "watch"
  | "hunt"
  | "organize"
  | "autonomous_rat";

export type RoadmapFeatureStatus = "LIVE" | "BUILDING" | "PLANNED" | "EXPERIMENT";

export type RoadmapFeature = {
  id: string;
  label: string;
  status?: RoadmapFeatureStatus;
};

export type RoadmapStage = {
  id: RoadmapStageId;
  index: number;
  title: string;
  headline: string;
  literal: string;
  ratLine?: string;
  features: RoadmapFeature[];
  kicker: string;
  body: string[];
  side: "left" | "right";
  accent: string;
};

type ProjectionStage = {
  id: string;
  index: number;
  title: string;
  headline: string;
  literal: string;
  ratLine?: string;
  features: Array<{ id: string; label: string }>;
  side: "left" | "right";
  accent: string;
};

const capabilities = capabilityManifest.capabilities;

function resolveFeatureStatus(id: string): RoadmapFeatureStatus | undefined {
  if (id === "pons_live_intelligence") {
    return capabilities.robinhoodLiveIntelligenceV1.engineeringStatus === "BUILDING"
      ? "BUILDING"
      : undefined;
  }

  if (id === "rat_radar") {
    if (capabilities.ratRadarV0.currentRailReplacementStatus === "BUILDING_ON_PONS_4663") {
      return "BUILDING";
    }
    return capabilities.ratRadarV0.publicStatus === "PUBLIC_LIVE_BETA"
      ? "LIVE"
      : undefined;
  }

  if (id === "replay_lab") {
    return capabilities.replayLab.publicStatus === "PUBLIC_LIVE_BETA"
      ? "LIVE"
      : undefined;
  }

  if (id === "rat_watch") {
    if (capabilities.ratWatchV0.currentRailRevalidationRequired) return "BUILDING";
    return capabilities.ratWatchV0.deploymentStatus === "CLOUDFLARE_SUBSCRIPTION_LIVE_VERIFIED"
      ? "LIVE"
      : undefined;
  }

  if (id === "dumpster_raids") {
    return capabilities.dumpsterRaidsV0.engineeringStatus === "EXPERIMENTAL"
      ? "EXPERIMENT"
      : undefined;
  }

  if (id === "rat_den") {
    return capabilities.ratDenV0.engineeringStatus === "PLANNED"
      ? "PLANNED"
      : undefined;
  }

  return undefined;
}

export const roadmapStages: RoadmapStage[] = (projection.stages as ProjectionStage[]).map((stage) => ({
  ...stage,
  id: stage.id as RoadmapStageId,
  kicker: stage.headline,
  body: [stage.literal],
  features: stage.features.map((feature) => ({
    ...feature,
    status: resolveFeatureStatus(feature.id),
  })),
}));
