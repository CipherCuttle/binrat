import type { CSSProperties } from "react";
import { roadmapStages, type RoadmapStageId } from "./roadmapData";

export function RoadmapSpine({ active }: { active: RoadmapStageId }) {
  const activeIndex = roadmapStages.findIndex((stage) => stage.id === active);
  return (
    <div className="roadmap-spine" style={{
      "--roadmap-active-position": `${((activeIndex + 0.5) / roadmapStages.length) * 100}%`,
    } as CSSProperties} aria-hidden="true">
      <span className="roadmap-spine__base" /><span className="roadmap-spine__focus" />
    </div>
  );
}
