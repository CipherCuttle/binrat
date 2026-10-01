import type { CSSProperties, RefCallback } from "react";
import type { RoadmapStage as RoadmapStageModel } from "./roadmapData";

export function RoadmapStage({
  stage,
  active,
  register,
}: {
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
      style={{ "--roadmap-active-accent": stage.accent } as CSSProperties}
    >
      <div className="roadmap-stage__scene">
        <div className="roadmap-scene" data-scene-art="empty" aria-hidden="true" />
      </div>

      <div className="roadmap-stage__node" aria-hidden="true">
        <span />
      </div>

      <div className="roadmap-stage__copy">
        <span className="roadmap-stage__index">{String(stage.index).padStart(2, "0")}</span>
        <h2>{stage.title}</h2>
        <p className="roadmap-stage__kicker">{stage.kicker}</p>
        <div className="roadmap-stage__body">
          {stage.body.map((line) => <p key={line}>{line}</p>)}
        </div>
      </div>
    </section>
  );
}
