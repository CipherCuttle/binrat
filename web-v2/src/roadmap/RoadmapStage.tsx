import type { CSSProperties, RefCallback } from "react";
import { RoadmapScene } from "./RoadmapScene";
import type { RoadmapStage as RoadmapStageModel } from "./roadmapData";

const accentToken = {
  copper: "var(--br-copper)",
  mint: "var(--br-oxidized-mint)",
  bruise: "var(--br-bruise)",
  bone: "var(--br-bone)",
  eye: "var(--br-rat-eye)",
} as const;

export function RoadmapStage({ stage, active, register }: {
  stage: RoadmapStageModel;
  active: boolean;
  register: RefCallback<HTMLElement>;
}) {
  return (
    <section
      ref={register}
      className={`roadmap-stage roadmap-stage--${stage.side}`}
      data-stage={stage.id}
      data-active={active}
      aria-current={active ? "step" : undefined}
      style={{ "--roadmap-active-accent": accentToken[stage.accent] } as CSSProperties}
    >
      <RoadmapScene stage={stage} active={active} />
      <div className="roadmap-stage__node" aria-hidden="true"><span /></div>
      <div className="roadmap-stage__copy">
        <span className="roadmap-stage__index">{String(stage.index).padStart(2, "0")} / CAPABILITY PATH</span>
        <h2>{stage.title}</h2>
        <p className="roadmap-stage__kicker">{stage.headline}</p>
        <p className="roadmap-stage__body">{stage.literal}</p>
        <p className="roadmap-stage__receipt">{stage.receipt}</p>
      </div>
    </section>
  );
}
