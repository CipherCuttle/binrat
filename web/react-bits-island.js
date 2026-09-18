// Presentation-only vanilla ports of React Bits interaction patterns.
// Donor: DavidHDev/react-bits@c49d6978d2496660f0f0c5a3b3ca77a059566a93
// AnimatedContent + SpotlightCard behavior adapted without React/GSAP runtime coupling.

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = matchMedia("(hover: hover)").matches;
const seenBags = new Set();

function installSpotlights(root = document) {
  if (!canHover || reduceMotion) return;
  for (const card of root.querySelectorAll(".rb-card, .process-grid article, .utility-panel")) {
    if (card.dataset.rbSpotlight === "1") continue;
    card.dataset.rbSpotlight = "1";
    card.classList.add("rb-spotlight");
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--rb-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--rb-y", `${event.clientY - rect.top}px`);
    });
  }
}

function animateOnce(element, options = {}) {
  if (!element || reduceMotion || element.dataset.rbAnimated === "1") return;
  element.dataset.rbAnimated = "1";
  element.animate(
    [
      { opacity: options.initialOpacity ?? 0, transform: `translateY(${options.distance ?? 18}px) scale(${options.scale ?? 0.985})` },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ],
    {
      duration: options.duration ?? 520,
      delay: options.delay ?? 0,
      easing: options.easing ?? "cubic-bezier(.22,.8,.24,1)",
      fill: "both",
    },
  );
}

function installViewportAnimations() {
  if (reduceMotion) return;
  const targets = [...document.querySelectorAll(".hero-copy, .mascot-stage, .garbage-section, .how-section, .token-status-section")];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      animateOnce(entry.target, { distance: 22, duration: 620 });
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
  targets.forEach((target) => observer.observe(target));
}

function animateNewFeedRows() {
  for (const row of document.querySelectorAll(".bag-card[data-bag-id]")) {
    const id = row.dataset.bagId;
    if (!id || seenBags.has(id)) continue;
    seenBags.add(id);
    animateOnce(row, { distance: 10, duration: 380 });
  }
}

installSpotlights();
installViewportAnimations();
animateNewFeedRows();

window.addEventListener("binrat:feed-rendered", animateNewFeedRows);
window.addEventListener("binrat:drawer-hydrated", () => {
  installSpotlights(document.querySelector("#drawer"));
  for (const element of document.querySelectorAll("#drawer [data-rb-animated], #drawer .rb-card")) {
    animateOnce(element, { distance: 12, duration: 420 });
  }
});
