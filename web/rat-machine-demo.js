import { loadDumpsterFeed } from "./data-source.js";

const section = document.querySelector("#rat-machine-demo");
const scope = document.querySelector("#rat-scope");
const rows = document.querySelector("#scope-candidates");
const targetText = document.querySelector("#scope-target");
const knob = document.querySelector("#machine-knob");
const lever = document.querySelector("#machine-lever");
const receipt = document.querySelector("#machine-receipt");
const message = document.querySelector("#machine-message");
const runner = document.querySelector("#rat-runner");
const heroRat = document.querySelector("#rat-stage img");
const printer = document.querySelector("#printer-box");

if (section && scope && rows && receipt) {
  initMachine().catch((error) => {
    if (message) message.textContent = "MACHINE OFFLINE // " + String(error?.message ?? error);
  });
}

async function initMachine() {
  const feed = await loadDumpsterFeed();
  const bags = Array.isArray(feed?.bags) ? feed.bags.slice(0, 7) : [];
  if (!bags.length) throw new Error("NO BAGS AVAILABLE");

  const candidates = bags
    .map((bag, index) => ({
      bag,
      index,
      strength: Math.min(1, .18 + ((bag.priorLaunches ?? 0) / 12) + ((hashInt(bag.reportedCreatorAddress) % 35) / 100)),
      phase: ((hashInt(bag.token) % 1000) / 1000),
    }))
    .sort((a,b) => b.strength - a.strength);

  let selected = candidates[0];
  let scanBoost = 0;
  let running = true;

  renderRows();
  selectCandidate(selected, false);

  const ctx = scope.getContext("2d", { alpha: false });
  const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));

  function resize() {
    const rect = scope.getBoundingClientRect();
    scope.width = Math.max(1, Math.round(rect.width * dpr));
    scope.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  addEventListener("resize", resize, { passive:true });

  let start = performance.now();
  function frame(now) {
    if (!running) return;
    drawScope(ctx, scope.clientWidth, scope.clientHeight, candidates, selected, (now-start)/1000, scanBoost);
    scanBoost *= .965;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  knob?.closest(".machine-knob-wrap")?.addEventListener("click", () => {
    knob.classList.add("scanning");
    scanBoost = 1;
    if (message) message.textContent = "SNIFFER GAIN UP // RECHECKING RECURRENCE";
    setTimeout(() => knob.classList.remove("scanning"), 620);
    const currentIndex = candidates.indexOf(selected);
    selectCandidate(candidates[(currentIndex + 1) % candidates.length], true);
  });

  lever?.addEventListener("click", async () => {
    lever.classList.add("pulled");
    if (message) message.textContent = "RAT DISPATCHED // FETCHING RECEIPT";
    await runRatToPrinter();
    printReceipt(selected.bag);
    setTimeout(() => lever.classList.remove("pulled"), 420);
  });

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      start = performance.now();
      requestAnimationFrame(frame);
    }
  });

  function renderRows() {
    rows.innerHTML = candidates.map((item, rank) => {
      const addr = shortAddress(item.bag.reportedCreatorAddress);
      const prior = Number(item.bag.priorLaunches ?? 0);
      return `<button class="scope-row" type="button" data-scope-index="${item.index}" aria-pressed="false">
        <span>${String(rank + 1).padStart(2,"0")}</span>
        <code>${escapeHtml(addr)}</code>
        <b>${prior} OLD BAG${prior === 1 ? "" : "S"}</b>
      </button>`;
    }).join("");

    for (const button of rows.querySelectorAll("[data-scope-index]")) {
      button.addEventListener("click", () => {
        const candidate = candidates.find((item) => String(item.index) === button.dataset.scopeIndex);
        if (candidate) selectCandidate(candidate, true);
      });
    }
  }

  function selectCandidate(candidate, animate) {
    selected = candidate;
    for (const button of rows.querySelectorAll("[data-scope-index]")) {
      button.setAttribute("aria-pressed", String(button.dataset.scopeIndex === String(candidate.index)));
    }
    if (targetText) targetText.textContent = `TARGET // ${shortAddress(candidate.bag.reportedCreatorAddress)}`;
    if (message) message.textContent = `LOCKED // ${candidate.bag.symbol} // ${candidate.bag.priorLaunches ?? 0} PRIOR INDEXED`;
    if (animate) {
      scanBoost = 1;
      document.body.classList.add("signal-hit");
      setTimeout(() => document.body.classList.remove("signal-hit"), 420);
    }
  }
}

function drawScope(ctx, width, height, candidates, selected, t, boost) {
  ctx.fillStyle = "#061006";
  ctx.fillRect(0,0,width,height);

  ctx.strokeStyle = "rgba(150,220,120,.11)";
  ctx.lineWidth = 1;
  for (let x=0;x<=width;x+=width/8) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,height); ctx.stroke();
  }
  for (let y=0;y<=height;y+=height/6) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(width,y); ctx.stroke();
  }

  const mid = height * .58;
  const amp = height * (.12 + boost * .035);
  ctx.strokeStyle = "rgba(183,255,90,.74)";
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  for (let x=0;x<=width;x+=2) {
    let y = mid;
    const n = Math.sin(x*.041 + t*1.5)*.12 + Math.sin(x*.117 - t*.8)*.05;
    y += n * amp;
    for (const item of candidates) {
      const px = width * (.08 + .84 * item.phase);
      const dist = Math.abs(x-px);
      if (dist < 16) {
        const peak = Math.exp(-(dist*dist)/42) * amp * (1.7 + item.strength*4.8);
        y -= peak * (item === selected ? 1.18 : 1);
      }
    }
    if (x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.stroke();

  const sweep = (t*.18 % 1) * width;
  const grad = ctx.createLinearGradient(sweep-80,0,sweep+8,0);
  grad.addColorStop(0,"rgba(183,255,90,0)");
  grad.addColorStop(1,"rgba(183,255,90,.18)");
  ctx.fillStyle = grad;
  ctx.fillRect(Math.max(0,sweep-80),0,88,height);
  ctx.fillStyle = "rgba(207,255,185,.55)";
  ctx.fillRect(sweep,0,1,height);

  for (const item of candidates) {
    const x = width * (.08 + .84 * item.phase);
    const h = 8 + item.strength * 22;
    ctx.strokeStyle = item === selected ? "rgba(255,100,70,.92)" : "rgba(183,255,90,.5)";
    ctx.lineWidth = item === selected ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, height-15);
    ctx.lineTo(x, height-15-h);
    ctx.stroke();
    ctx.fillStyle = item === selected ? "rgba(255,100,70,.95)" : "rgba(183,255,90,.75)";
    ctx.fillRect(x-2,height-18-h,4,4);
  }

  ctx.fillStyle = "rgba(183,255,90,.42)";
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillText("RECURRENCE SNIFFER / NOT A PRICE CHART", 11, height-9);
}

function printReceipt(bag) {
  receipt.classList.remove("printed");
  receipt.innerHTML = `
    <div class="receipt-logo"><span>BINRAT / RECEIPT</span><span>ARC 5042</span></div>
    <div class="receipt-title">${escapeHtml(bag.symbol)}</div>
    <div class="receipt-line"><span>CREATOR</span><code>${escapeHtml(bag.reportedCreatorAddress)}</code></div>
    <div class="receipt-line"><span>TOKEN</span><code>${escapeHtml(bag.token)}</code></div>
    <div class="receipt-line"><span>PRIOR BAGS</span><b>${escapeHtml(String(bag.priorLaunches ?? 0))}</b></div>
    <div class="receipt-line"><span>COVERAGE</span><b>${escapeHtml(String(bag.coverage ?? "UNVERIFIED"))}</b></div>
    <div class="receipt-line"><span>RECEIPT</span><code>${escapeHtml(String(bag.receipt ?? "unavailable"))}</code></div>
    <div class="receipt-verdict">BINRAT FOUND A RECORD.<br>THAT IS NOT A BUY CALL.</div>
    <div class="receipt-foot">HE GETS THE SCRAPS. YOU GET THE RECEIPTS.<br>FIXTURE DEMO // VISUAL PROTOTYPE</div>
  `;
  void receipt.offsetWidth;
  receipt.classList.add("printed");
  if (message) message.textContent = "RECEIPT PRINTED // EVIDENCE STAYS UPSTREAM";
}

async function runRatToPrinter() {
  if (!runner || !heroRat || !printer) return;
  const start = heroRat.getBoundingClientRect();
  const end = printer.getBoundingClientRect();
  const sx = start.left + start.width*.54 - 56;
  const sy = start.top + start.height*.22 - 56;
  const ex = end.left + end.width*.72 - 56;
  const ey = end.top + 44;

  runner.style.left = "0px";
  runner.style.top = "0px";
  runner.style.opacity = "1";

  const frames = [
    { transform: `translate(${sx}px,${sy}px) scale(.78) rotate(-5deg)`, opacity: 0 },
    { transform: `translate(${sx+18}px,${sy-8}px) scale(.82) rotate(2deg)`, opacity: 1, offset:.08 },
    { transform: `translate(${sx + (ex-sx)*.35}px,${Math.min(sy,ey)-72}px) scale(.72) rotate(-8deg)`, opacity: 1, offset:.38 },
    { transform: `translate(${sx + (ex-sx)*.7}px,${Math.min(sy,ey)-28}px) scale(.67) rotate(7deg)`, opacity: 1, offset:.7 },
    { transform: `translate(${ex}px,${ey}px) scale(.56) rotate(-2deg)`, opacity: 1 },
  ];

  const anim = runner.animate(frames, {
    duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 980,
    easing: "cubic-bezier(.22,.78,.22,1)",
    fill: "forwards",
  });
  await anim.finished.catch(() => {});
  await sleep(190);
  runner.animate(
    [
      { transform: frames.at(-1).transform },
      { transform: frames.at(-1).transform + " translateY(5px) rotate(5deg)" },
      { transform: frames.at(-1).transform + " translateY(0) rotate(-2deg)" },
    ],
    { duration: 260, fill:"forwards", easing:"ease-in-out" },
  );
  await sleep(230);
  runner.style.opacity = "0";
}

function hashInt(value) {
  const text = String(value ?? "");
  let h = 2166136261;
  for (let i=0;i<text.length;i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h,16777619);
  }
  return h >>> 0;
}

function shortAddress(value) {
  const s = String(value ?? "");
  return s.length > 12 ? `${s.slice(0,6)}…${s.slice(-4)}` : s;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  })[char]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve,ms));
}
