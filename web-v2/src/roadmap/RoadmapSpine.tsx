import type { CSSProperties } from "react";
import { roadmapStages, type RoadmapStageId } from "./roadmapData";

export function RoadmapSpine({ active }: { active: RoadmapStageId }) {
  const activeIndex = roadmapStages.findIndex((stage) => stage.id === active);
  const style = {
    "--roadmap-active-index": activeIndex,
    "--roadmap-stage-count": roadmapStages.length,
    "--roadmap-active-accent": roadmapStages[activeIndex]?.accent ?? "#8fc7a5",
  } as CSSProperties;

  return (
    <div className="roadmap-spine" style={style} aria-hidden="true">
      <span className="roadmap-spine__base" />
      <span className="roadmap-spine__signal" />
      <span className="roadmap-spine__glow" />
    </div>
  );
}
