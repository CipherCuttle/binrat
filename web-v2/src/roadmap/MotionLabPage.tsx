import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import "./motion-lab.css";

const milestones = [
  { title: "SNIFF", kicker: "Find the launch.", accent: "var(--green)" },
  { title: "REMEMBER", kicker: "Keep the trail.", accent: "var(--orange)" },
  { title: "INVESTIGATE", kicker: "Turn the trail into a case.", accent: "var(--bone)" },
  { title: "WATCH", kicker: "Notice when the pattern moves again.", accent: "var(--orange)" },
  { title: "CONNECT", kicker: "See structure across cases.", accent: "var(--purple)" },
  { title: "AUTONOMOUS RAT", kicker: "Give the rat a bounded investigation.", accent: "var(--red)" },
] as const;

type Milestone = (typeof milestones)[number];

function rangesFor(index: number) {
  const target = index / (milestones.length - 1);
  if (index === 0) {
    return {
      input: [0, 0.09, 0.2],
      opacity: [1, 0.7, 0.14],
      scale: [1.2, 1.04, 0.82],
      y: [0, -3, -12],
    };
  }
  if (index === milestones.length - 1) {
    return {
      input: [0.8, 0.91, 1],
      opacity: [0.14, 0.7, 1],
      scale: [0.82, 1.04, 1.2],
      y: [12, 3, 0],
    };
  }
  return {
    input: [target - 0.17, target - 0.065, target, target + 0.065, target + 0.17],
    opacity: [0.12, 0.52, 1, 0.52, 0.12],
    scale: [0.82, 0.96, 1.22, 0.96, 0.82],
    y: [12, 4, 0, -4, -12],
  };
}

function MotionMilestone({
  milestone,
  index,
  progress,
  active,
}: {
  milestone: Milestone;
  index: number;
  progress: MotionValue<number>;
  active: boolean;
}) {
  const ranges = rangesFor(index);
  const opacity = useTransform(progress, ranges.input, ranges.opacity);
  const scale = useTransform(progress, ranges.input, ranges.scale);
  const y = useTransform(progress, ranges.input, ranges.y);

  return (
    <div
      className={`motion-lab__milestone motion-lab__milestone--${index % 2 ? "right" : "left"}`}
      data-motion-milestone={index}
      data-active={active}
      aria-current={active ? "step" : undefined}
      style={{ top: `${index * 20}%`, "--motion-accent": milestone.accent } as React.CSSProperties}
    >
      <motion.div className="motion-lab__label" style={{ opacity, y }}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{milestone.title}</strong>
        <small>{milestone.kicker}</small>
      </motion.div>

      <div className="motion-lab__node-wrap" aria-hidden="true">
        <motion.span className="motion-lab__node-halo" style={{ opacity, scale }} />
        <motion.span className="motion-lab__node-core" style={{ opacity, scale }}>
          {String(index + 1).padStart(2, "0")}
        </motion.span>
      </div>
    </div>
  );
}

function ReducedTimeline({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="motion-lab-page motion-lab-page--reduced" data-motion-lab data-reduced-motion="true">
      <button className="motion-lab__back" type="button" onClick={() => navigate("/roadmap")}>
        ROADMAP ↗
      </button>
      <h1 className="motion-lab__sr-title">ROADMAP MOTION LAB</h1>
      <div className="motion-lab__reduced-list">
        {milestones.map((milestone, index) => (
          <div className="motion-lab__reduced-row" key={milestone.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <i aria-hidden="true" />
            <div>
              <strong>{milestone.title}</strong>
              <small>{milestone.kicker}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MotionLabPage({ navigate }: { navigate: (path: string) => void }) {
  const runwayRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  const [docked, setDocked] = useState(false);
  const settleTimer = useRef<number | null>(null);
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 32,
    mass: 0.22,
    restDelta: 0.001,
  });
  const railY = useTransform(progress, [0, 1], ["50svh", "-62svh"]);
  const pulseTop = useTransform(progress, [0, 1], ["0%", "100%"]);
  const pulseOpacity = useTransform(progress, [0, 0.97, 0.994, 1], [1, 1, 0.72, 0]);
  const pulseScale = useTransform(progress, [0, 0.97, 0.994, 1], [1, 1, 1.42, 0.42]);

  useMotionValueEvent(progress, "change", (latest) => {
    setActiveIndex(Math.max(0, Math.min(milestones.length - 1, Math.round(latest * (milestones.length - 1)))));
    setDocked(latest >= 0.9985);
    if (latest < 0.9985) setMoving(true);
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setMoving(false), 130);
  });

  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
  }, []);

  if (reducedMotion) return <ReducedTimeline navigate={navigate} />;

  return (
    <div
      className="motion-lab-page"
      data-motion-lab
      data-reduced-motion="false"
      data-active-index={activeIndex}
      data-moving={moving}
      data-docked={docked}
      style={{ "--motion-live-accent": milestones[activeIndex].accent } as React.CSSProperties}
    >
      <button className="motion-lab__back" type="button" onClick={() => navigate("/roadmap")}>
        ROADMAP ↗
      </button>
      <h1 className="motion-lab__sr-title">ROADMAP MOTION LAB</h1>

      <section ref={runwayRef} className="motion-lab__runway" aria-label="BINRAT roadmap motion prototype">
        <div className="motion-lab__sticky">
          <div className="motion-lab__rail-frame">
            <motion.div className="motion-lab__rail" style={{ y: railY }}>
              <div className="motion-lab__spine-base" aria-hidden="true" />
              <motion.div
                className="motion-lab__spine-signal"
                aria-hidden="true"
                style={{ scaleY: progress }}
              />
              <motion.div className="motion-lab__pulse-track" aria-hidden="true" style={{ top: pulseTop }}>
                <motion.span
                  className="motion-lab__pulse"
                  style={{ opacity: pulseOpacity, scale: pulseScale }}
                />
              </motion.div>

              {milestones.map((milestone, index) => (
                <MotionMilestone
                  key={milestone.title}
                  milestone={milestone}
                  index={index}
                  progress={progress}
                  active={activeIndex === index}
                />
              ))}
            </motion.div>
          </div>

          <div className="motion-lab__center-mark" aria-hidden="true">
            <span />
          </div>
          <p className="motion-lab__hint">SCROLL ↓</p>
        </div>
      </section>
    </div>
  );
}
