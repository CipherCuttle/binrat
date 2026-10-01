import { useEffect, useRef, useState } from "react";
import { RoadmapSpine } from "./RoadmapSpine";
import { RoadmapStage } from "./RoadmapStage";
import { roadmapStages, type RoadmapStageId } from "./roadmapData";
import "./roadmap.css";

export function RoadmapPage({ navigate }: { navigate: (path: string) => void }) {
  const [activeStage, setActiveStage] = useState<RoadmapStageId>("sniff");
  const stageNodes = useRef(new Map<RoadmapStageId, HTMLElement>());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const centered = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const id = centered?.target.getAttribute("data-stage") as RoadmapStageId | null;
        if (id) setActiveStage(id);
      },
      {
        rootMargin: "-38% 0px -38% 0px",
        threshold: [0, 0.01, 0.1, 0.25],
      },
    );

    stageNodes.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="roadmap-page">
      <header className="roadmap-intro">
        <button className="roadmap-back" type="button" onClick={() => navigate("/")}>
          BINRAT ↗
        </button>
        <p>FROM SIGNAL TO MEMORY</p>
        <h1>DOWN THE RAT HOLE.</h1>
        <span>
          The roadmap is a trail of capabilities, not a promise calendar.
        </span>
      </header>

      <div
        className="roadmap-stages"
        style={{
          "--roadmap-stage-count": roadmapStages.length,
        } as React.CSSProperties}
      >
        <RoadmapSpine active={activeStage} />
        {roadmapStages.map((stage) => (
          <RoadmapStage
            key={stage.id}
            stage={stage}
            active={activeStage === stage.id}
            register={(node) => {
              if (node) stageNodes.current.set(stage.id, node);
              else stageNodes.current.delete(stage.id);
            }}
          />
        ))}
      </div>

      <footer className="roadmap-footer">
        <p>Prototype gate: SNIFF → REMEMBER.</p>
        <span>Receipts still decide truth.</span>
      </footer>
    </div>
  );
}
