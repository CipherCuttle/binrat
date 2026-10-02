(() => {
  const F = window.BINRAT_SOCIAL_FIXTURE;

  function brand() {
    return `
      <div class="brand">
        <img src="../proofs/identity-v1/rat-avatar-128.png" alt="" />
        <strong>BINRAT</strong>
      </div>`;
  }

  function facts(rows, className) {
    return rows.map(([k,v]) => `
      <div class="${className}">
        <span>${k}</span><b>${v}</b>
      </div>`).join("");
  }

  function receiptCard(ratio) {
    const d=F.receipt;
    return `
    <article class="social-card ${ratio} receipt-card" data-template="receipt" data-ratio="${ratio}">
      <div class="topline">
        ${brand()}
        <div class="proof-flag">${F.meta.proof}</div>
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
        <div class="footer-source">${F.meta.source}<br/>${F.meta.proof}</div>
      </footer>
    </article>`;
  }

  function caseCard(ratio) {
    const d=F.caseFile;
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
          <div class="claim-boundary">DEMO PATTERN · EVIDENCE DEPTH BELOW · NOT A BUY/SELL VERDICT</div>
        </div>
        <div class="case-grid">${facts(d.facts,"case-row")}</div>
      </div>
      <footer>
        <div class="action">${d.action}</div>
        <div class="footer-source">${F.meta.source}<br/>${F.meta.proof}</div>
      </footer>
    </article>`;
  }

  function foundCard(ratio) {
    const d=F.found;
    return `
    <article class="social-card ${ratio} found-card" data-template="rat-found" data-ratio="${ratio}">
      <img class="rat-hero" src="../proofs/identity-v1/rat-profile-512.png" alt="" />
      <div class="rat-fade"></div>
      <div class="topline">
        ${brand()}
        <div class="proof-flag">${F.meta.proof}</div>
      </div>
      <div class="content">
        <div class="eyebrow">${d.eyebrow}</div>
        <h1 class="headline">${d.headline}</h1>
        <p class="literal">${d.literal}</p>
        <div class="evidence-strip">${d.evidence}</div>
      </div>
      <footer>
        <div class="action">${d.action}</div>
        <div class="footer-source">${F.meta.source}<br/>${F.meta.proof}</div>
      </footer>
    </article>`;
  }

  const root=document.querySelector("#cards");
  root.innerHTML = [
    receiptCard("wide"),
    caseCard("wide"),
    foundCard("wide"),
    receiptCard("square"),
    caseCard("square"),
    foundCard("square")
  ].join("");
})();
