import type { RefCallback } from "react";
import type { RoadmapStage as RoadmapStageModel, RoadmapStageId } from "./roadmapData";

function SceneHardware({ id, active }: { id: RoadmapStageId; active: boolean }) {
  const hero = `${import.meta.env.BASE_URL}binrat-hero.webp`;

  if (id === "sniff") {
    return (
      <div className="roadmap-scene roadmap-scene--sniff" data-active={active}>
        <div className="roadmap-scene__room" />
        <div className="roadmap-scene__terminal roadmap-scene__terminal--wide">
          <span className="roadmap-radar"><i /></span>
          <span className="roadmap-terminal-led roadmap-terminal-led--a" />
          <span className="roadmap-terminal-led roadmap-terminal-led--b" />
        </div>
        <div className="roadmap-scene__terminal roadmap-scene__terminal--small">
          <span className="roadmap-terminal-lines" />
        </div>
        <img className="roadmap-scene__rat roadmap-scene__rat--sniff" src={hero} alt="" />
        <div className="roadmap-scene__lamp" />
        <div className="roadmap-scene__foreground" />
        <div className="roadmap-scene__darkness" />
      </div>
    );
  }

  return (
    <div className="roadmap-scene roadmap-scene--remember" data-active={active}>
      <div className="roadmap-scene__room" />
      <div className="roadmap-archive" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
      <div className="roadmap-paper-stack" aria-hidden="true">
        <i /><i /><i />
      </div>
      <div className="roadmap-scene__terminal roadmap-scene__terminal--archive">
        <span className="roadmap-terminal-lines" />
      </div>
      <img className="roadmap-scene__rat roadmap-scene__rat--remember" src={hero} alt="" />
      <div className="roadmap-scene__lamp roadmap-scene__lamp--warm" />
      <div className="roadmap-scene__foreground" />
      <div className="roadmap-scene__darkness" />
    </div>
  );
}

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
    >
      <div className="roadmap-stage__scene">
        <SceneHardware id={stage.id} active={active} />
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
