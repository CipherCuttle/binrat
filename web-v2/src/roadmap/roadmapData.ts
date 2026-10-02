export type RoadmapStageId =
  | "sniff"
  | "remember"
  | "investigate"
  | "watch"
  | "connect"
  | "autonomous_rat";

export type RoadmapStage = {
  id: RoadmapStageId;
  index: number;
  title: string;
  headline: string;
  literal: string;
  receipt: string;
  side: "left" | "right";
  accent: "copper" | "mint" | "bruise" | "bone" | "eye";
  crop: string;
  scale: number;
};

// This is an experiential capability sequence, not a live-status projection.
// It intentionally consumes no runtime product data.
export const roadmapStages: RoadmapStage[] = [
  { id: "sniff", index: 1, title: "SNIFF", headline: "A TRAIL STARTS WITH A TRACE.", literal: "Notice the first observable signal before the surrounding story gets louder.", receipt: "FIRST TRACE / ROADMAP CANDIDATE", side: "left", accent: "copper", crop: "48% 48%", scale: 1.34 },
  { id: "remember", index: 2, title: "REMEMBER", headline: "KEEP WHAT THE TRAIL LEAVES.", literal: "Retain a readable record so a later claim can be compared with what was visible then.", receipt: "RETAINED CONTEXT / NOT A LIVE CLAIM", side: "right", accent: "mint", crop: "24% 48%", scale: 1.26 },
  { id: "investigate", index: 3, title: "INVESTIGATE", headline: "PUT THE RECEIPT BEFORE THE THEORY.", literal: "Turn an observed trace into a bounded question with source, coverage and unknowns intact.", receipt: "CASE SHAPE / SOURCE REQUIRED", side: "left", accent: "bruise", crop: "54% 34%", scale: 1.46 },
  { id: "watch", index: 4, title: "WATCH", headline: "NOTICE WHEN THE TRAIL MOVES AGAIN.", literal: "Follow a defined observation over time without treating attention as a recommendation.", receipt: "CHANGE DETECTED / INTERPRETATION SEPARATE", side: "right", accent: "bone", crop: "77% 42%", scale: 1.28 },
  { id: "connect", index: 5, title: "CONNECT", headline: "LET RECEIPTS TRAVEL WITH CONTEXT.", literal: "Connect people to a source trail while keeping evidence state visible at every handoff.", receipt: "SOURCE CHAIN / STATE PRESERVED", side: "left", accent: "mint", crop: "50% 67%", scale: 1.40 },
  { id: "autonomous_rat", index: 6, title: "AUTONOMOUS RAT", headline: "GIVE IT A QUESTION. KEEP THE RECEIPTS.", literal: "Automation can help gather and organize material; it never turns missing evidence into truth.", receipt: "ASSISTED WORK / HUMAN REVIEW REMAINS", side: "right", accent: "eye", crop: "49% 46%", scale: 1.16 },
];
