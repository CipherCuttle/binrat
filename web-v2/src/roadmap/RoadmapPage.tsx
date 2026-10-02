import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RoadmapSpine } from "./RoadmapSpine";
import { RoadmapStage } from "./RoadmapStage";
import { roadmapStages, type RoadmapStageId } from "./roadmapData";
import "./roadmap.css";

export function RoadmapPage({ navigate }: { navigate: (path: string) => void }) {
  const [activeStage, setActiveStage] = useState<RoadmapStageId>("sniff");
  const stageNodes = useRef(new Map<RoadmapStageId, HTMLElement>());

  useEffect(() => {
    let frame = 0;

    const selectClosestStage = () => {
      frame = 0;
      const viewportCenter = window.innerHeight / 2;
      let closestId: RoadmapStageId | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const [id, node] of stageNodes.current.entries()) {
        const rect = node.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const distance = Math.abs(center - viewportCenter);
        if (distance < closestDistance) {
          closestId = id;
          closestDistance = distance;
        }
      }

      if (closestId !== null) setActiveStage(closestId);
    };

    const scheduleSelection = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(selectClosestStage);
    };

    const observer = new IntersectionObserver(scheduleSelection, {
      rootMargin: "-42% 0px -42% 0px",
      threshold: 0,
    });

    stageNodes.current.forEach((node) => observer.observe(node));
    window.addEventListener("scroll", scheduleSelection, { passive: true });
    window.addEventListener("resize", scheduleSelection);
    scheduleSelection();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scheduleSelection);
      window.removeEventListener("resize", scheduleSelection);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="roadmap-page">
      <header className="roadmap-intro">
        <button className="roadmap-back" type="button" onClick={() => navigate("/")}>
          BINRAT ↗
        </button>
        <p>BINRAT / CAPABILITY PATH</p>
        <h1>FOLLOW THE RECEIPTS.</h1>
        <span>
          Six capability chapters. No live status, no promise calendar, no invented evidence.
        </span>
      </header>

      <div
        className="roadmap-stages"
        style={{
          "--roadmap-stage-count": roadmapStages.length,
        } as CSSProperties}
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
        <p>Six chapters. Evidence state stays literal.</p>
        <span>Automation can assist. Receipts still decide truth.</span>
      </footer>
    </div>
  );
}
