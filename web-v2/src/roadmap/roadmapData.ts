export type RoadmapStageId = "sniff" | "remember";

export type RoadmapStage = {
  id: RoadmapStageId;
  index: number;
  title: string;
  kicker: string;
  body: string[];
  side: "left" | "right";
  accent: string;
};

export const roadmapStages: RoadmapStage[] = [
  {
    id: "sniff",
    index: 1,
    title: "SNIFF",
    kicker: "Find the launch.",
    body: ["Observe new launches.", "Follow the trail."],
    side: "left",
    accent: "#8fc7a5",
  },
  {
    id: "remember",
    index: 2,
    title: "REMEMBER",
    kicker: "Keep the trail.",
    body: ["Creator history.", "Recurrence. Chronology."],
    side: "right",
    accent: "#cf9567",
  },
];
