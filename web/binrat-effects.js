const stage = document.querySelector("#rat-stage");
const ratImage = stage?.querySelector("img");
const stateText = document.querySelector("#rat-state-text");
const buttons = [...document.querySelectorAll("[data-rat-state-button]")];
const boot = document.querySelector("#binrat-boot");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let motionAnimate = null;
try {
  ({ animate: motionAnimate } = await import("https://cdn.jsdelivr.net/npm/motion@13.4.0/+esm"));
} catch {
  // GitHack should still show the prototype if the CDN is blocked.
}

function fallbackAnimate(element, keyframes, options = {}) {
  if (!element?.animate) return null;
  const frames = Array.isArray(keyframes) ? keyframes : [keyframes];
  return element.animate(frames, {
    duration: Math.round((options.duration ?? .35) * 1000),
    easing: typeof options.ease === "string" ? options.ease : "ease-out",
    fill: "forwards",
    iterations: options.repeat === Infinity ? Infinity : (options.repeat ?? 0) + 1,
  });
}

function animateTarget(target, keyframes, options) {
  if (!target || reducedMotion) return null;
  if (motionAnimate) return motionAnimate(target, keyframes, options);
  return fallbackAnimate(target, keyframes, options);
}

const states = {
  idle: {
    label: "IDLE / LISTENING",
    motion: () => animateTarget(ratImage, { scale: [1, 1.006, 1], y: [0, -1, 0] }, { duration: 2.8, repeat: Infinity, ease: "easeInOut" }),
  },
  sniffing: {
    label: "SNIFFING / QUERY",
    motion: () => animateTarget(ratImage, { rotate: [0, -.6, .75, -.35, 0], scale: [1, 1.012, 1.008, 1] }, { duration: .7, ease: "easeInOut" }),
  },
  digging: {
    label: "DIGGING / FETCH",
    motion: () => animateTarget(ratImage, { y: [0, 7, 2, 10, 0], rotate: [0, .45, -.35, .3, 0] }, { duration: .9, ease: "easeInOut" }),
  },
  found: {
    label: "FOUND / RECEIPT",
    motion: () => animateTarget(ratImage, { scale: [1, 1.025, .997, 1], filter: ["brightness(1)", "brightness(1.22)", "brightness(1)"] }, { duration: .62, ease: "easeOut" }),
  },
  repeat: {
    label: "REPEAT / HIT",
    motion: () => animateTarget(ratImage, { x: [0, -2, 3, -1, 0], scale: [1, 1.018, 1] }, { duration: .48, ease: "easeOut" }),
  },
  offline: {
    label: "OFFLINE / BAD SIGNAL",
    motion: () => animateTarget(ratImage, { opacity: [1, .76, .92, .7, .88], x: [0, -3, 5, -2, 0] }, { duration: .75, ease: "linear" }),
  },
};

let activeAnimation = null;
let manualTimer = null;
let currentState = "idle";

function setState(name, { manual = false } = {}) {
  if (!stage || !states[name]) return;
  currentState = name;
  activeAnimation?.cancel?.();
  document.body.classList.toggle("signal-degraded", name === "offline");
  document.body.classList.toggle("signal-hit", name === "repeat");
  stage.dataset.ratState = name;
  if (stateText) stateText.textContent = states[name].label;

  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.state === name));
  }

  activeAnimation = states[name].motion();

  clearTimeout(manualTimer);
  if (manual && !["idle", "offline"].includes(name)) {
    manualTimer = setTimeout(() => setState("idle"), name === "repeat" ? 1100 : 1600);
  }
  if (name === "repeat") {
    setTimeout(() => document.body.classList.remove("signal-hit"), 700);
  }
}

for (const button of buttons) {
  button.addEventListener("click", () => setState(button.dataset.state, { manual: true }));
}

stage?.addEventListener("pointerenter", () => {
  if (currentState === "idle") setState("sniffing", { manual: true });
});

const drawer = document.querySelector("#drawer");
if (drawer) {
  const drawerObserver = new MutationObserver(() => {
    if (drawer.classList.contains("open")) {
      setState("digging");
      setTimeout(() => {
        if (drawer.classList.contains("open") && currentState === "digging") setState("found");
      }, 760);
    } else if (!["offline", "repeat"].includes(currentState)) {
      setState("idle");
    }
  });
  drawerObserver.observe(drawer, { attributes: true, attributeFilter: ["class"] });
}

const liveRail = document.querySelector("#live-rail");
if (liveRail) {
  const railObserver = new MutationObserver(() => {
    const text = liveRail.textContent ?? "";
    if (/OFFLINE|NOT AVAILABLE/i.test(text)) setState("offline");
    else if (currentState === "offline") setState("idle");
  });
  railObserver.observe(liveRail, { childList: true, subtree: true });
}

async function runBoot() {
  if (!boot) return;
  if (reducedMotion) {
    boot.hidden = true;
    return;
  }
  const lines = [...boot.querySelectorAll(".boot-line")];
  for (let i = 0; i < lines.length; i += 1) {
    await animateTarget(lines[i], { opacity: [0, 1], y: [4, 0] }, { duration: .16, ease: "easeOut" })?.finished;
    await new Promise((resolve) => setTimeout(resolve, i === lines.length - 1 ? 170 : 75));
  }
  await animateTarget(boot, { opacity: [1, 0], filter: ["brightness(1)", "brightness(1.8)"] }, { duration: .32, ease: "easeIn" })?.finished;
  boot.hidden = true;
}

setState("idle");
await runBoot();
