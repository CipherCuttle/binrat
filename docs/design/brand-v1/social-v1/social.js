(() => {
  const F = window.BINRAT_SOCIAL_FIXTURE || null;

  function brand() {
    return `
      <div class="brand">
        <img src="../proofs/identity-v1/rat-avatar-128.png" alt="" />
        <strong>BINRAT</strong>
      </div>`;
  }

  function facts(rows, className) {
    return rows.map(([k,v,state]) => `
      <div class="${className}${state ? ` evidence-state state-${state}` : ""}"${state ? ` data-evidence-state="${state}"` : ""}>
        <span>${k}</span><b>${v}</b>
      </div>`).join("");
  }

  function receiptCard(ratio, d = F?.receipt, meta = F?.meta) {
    if (!d || !meta) throw new Error("receipt renderer requires data + meta");
    return `
    <article class="social-card ${ratio} receipt-card" data-template="receipt" data-ratio="${ratio}">
      <div class="topline">
        ${brand()}
        <div class="proof-flag">${meta.proof}</div>
      </div>
      <div class="content">
        <div class="copy">
          <div class="eyebrow">${d.eyebrow}</div>
          <h1 class="headline">${d.headline}</h1>
          <p class="literal">${d.literal}</p>
        </div>
        <div class="receipt-panel">
          <div class="panel-title"><span>BINRAT RECEIPT</span><span>OBSERVED / DEMO</span></div>
          ${facts(d.facts,"fact")}
        </div>
      </div>
      <footer>
        <div class="action">${d.action}</div>
        <div class="footer-source">${meta.source}<br/>${meta.proof}</div>
      </footer>
    </article>`;
  }

  function caseCard(ratio, d = F?.caseFile, meta = F?.meta) {
    if (!d || !meta) throw new Error("case renderer requires data + meta");
    const boundary = d.boundary || "DEMO PATTERN · EVIDENCE DEPTH BELOW · NOT A BUY/SELL VERDICT";
    return `
    <article class="social-card ${ratio} case-card" data-template="case-file" data-ratio="${ratio}">
      <div class="topline">
        ${brand()}
        <div class="case-index"><span class="proof-flag">${d.eyebrow}</span></div>
      </div>
      <div class="content">
        <div>
          <h1 class="headline">${d.headline}</h1>
          <p class="literal">${d.literal}</p>
          <div class="claim-boundary">${boundary}</div>
        </div>
        <div class="case-grid">${facts(d.facts,"case-row")}</div>
      </div>
      <footer>
        <div class="action">${d.action}</div>
        <div class="footer-source">${meta.source}<br/>${meta.proof}</div>
      </footer>
    </article>`;
  }

  function foundCard(ratio, d = F?.found, meta = F?.meta) {
    if (!d || !meta) throw new Error("rat-found renderer requires data + meta");
    const stateClass = d.evidenceState ? ` state-${d.evidenceState}` : "";
    const stateAttr = d.evidenceState ? ` data-evidence-state="${d.evidenceState}"` : "";
    return `
    <article class="social-card ${ratio} found-card" data-template="rat-found" data-ratio="${ratio}">
      <img class="rat-hero" src="../proofs/identity-v1/rat-profile-512.png" alt="" />
      <div class="rat-fade"></div>
      <div class="topline">
        ${brand()}
        <div class="proof-flag">${meta.proof}</div>
      </div>
      <div class="content">
        <div class="eyebrow">${d.eyebrow}</div>
        <h1 class="headline">${d.headline}</h1>
        <p class="literal">${d.literal}</p>
        <div class="evidence-strip${stateClass}"${stateAttr}>${d.evidence}</div>
      </div>
      <footer>
        <div class="action">${d.action}</div>
        <div class="footer-source">${meta.source}<br/>${meta.proof}</div>
      </footer>
    </article>`;
  }

  function renderCard(family, ratio, data, meta) {
    if (family === "receipt") return receiptCard(ratio, data, meta);
    if (family === "case-file") return caseCard(ratio, data, meta);
    if (family === "rat-found") return foundCard(ratio, data, meta);
    throw new Error(`unknown social family: ${family}`);
  }

  window.BINRAT_SOCIAL_RENDER = Object.freeze({
    receiptCard,
    caseCard,
    foundCard,
    renderCard
  });

  const root=document.querySelector("#cards");
  if (root && F) {
    root.innerHTML = [
      receiptCard("wide"),
      caseCard("wide"),
      foundCard("wide"),
      receiptCard("square"),
      caseCard("square"),
      foundCard("square")
    ].join("");
  }
})();
