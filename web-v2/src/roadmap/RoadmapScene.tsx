import type { CSSProperties } from "react";
import ratZero from "../../../docs/design/brand-v1/canon/rat-zero.jpg";
import type { RoadmapStage } from "./roadmapData";

export function RoadmapScene({ stage, active }: { stage: RoadmapStage; active: boolean }) {
  return (
    <div className="roadmap-scene" data-scene-art="canonical-raster" data-scene-id={stage.id}
      data-scene-active={active} aria-hidden="true"
      style={{ "--roadmap-rat-position": stage.crop, "--roadmap-rat-scale": stage.scale } as CSSProperties}>
      <div className="roadmap-scene__matte" />
      <img className="roadmap-scene__rat-zero" src={ratZero} alt="" decoding="async"
        loading={stage.index === 1 ? "eager" : "lazy"} />
      <div className="roadmap-scene__exposure" />
      <div className="roadmap-scene__practical" />
      <div className="roadmap-scene__evidence"><span>0{stage.index} / {stage.title}</span><b>{stage.receipt}</b></div>
      <div className="roadmap-scene__occlusion" />
    </div>
  );
}
