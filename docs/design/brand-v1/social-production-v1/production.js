(() => {
  const payload = window.BINRAT_SOCIAL_PRODUCTION_FIXTURES;
  const renderer = window.BINRAT_SOCIAL_RENDER;
  if (!payload || !renderer) {
    document.body.dataset.productionError = "missing-fixtures-or-renderer";
    return;
  }

  const esc = (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function metaFor(f) {
    return {
      proof: esc(f.proof),
      source: esc(`${f.source.label} · ${f.source.value} · ${f.source.state}`),
      brand: "BINRAT"
    };
  }

  function toViewModel(f) {
    if (f.family === "receipt") {
      return {
        eyebrow: esc(`RECEIPT / ${f.receiptId}`),
        headline: esc(f.headline),
        literal: esc(f.literalExplanation),
        facts: [
          ["DEPLOYER", esc(f.deployer)],
          ["OBSERVED", esc(f.observation)],
          ["COVERAGE", esc(f.coverage), f.coverage],
          ["SOURCE STATE", esc(f.source.state), f.source.state]
        ],
        action: esc(f.cta.label)
      };
    }

    if (f.family === "case-file") {
      return {
        eyebrow: esc(`CASE FILE / ${f.caseId}`),
        headline: esc(f.headline),
        literal: esc(f.literalSummary),
        boundary: esc(`COVERAGE ${f.coverage} · ${f.evidenceBoundary}`),
        facts: f.facts.map((fact) => [esc(fact.label), esc(fact.value), fact.state || null]),
        action: esc(f.cta.label)
      };
    }

    return {
      eyebrow: "RAT FOUND SOMETHING / DEMO",
      headline: esc(f.headline),
      literal: esc(f.literalFinding),
      evidence: esc(f.evidenceStrip),
      evidenceState: f.coverage,
      action: esc(f.cta.label)
    };
  }

  function densityFor(f) {
    const n = f.headline.length;
    if (n > 32) return "max";
    if (n > 24) return "long";
    return "normal";
  }

  function renderFixture(f, ratio) {
    const html = renderer.renderCard(f.family, ratio, toViewModel(f), metaFor(f));
    const attrs = ` data-fixture-id="${esc(f.fixtureId)}" data-source-state="${esc(f.source.state)}" data-coverage="${esc(f.coverage)}"`;
    return html.replace(
      '<article class="social-card ',
      `<article${attrs} class="social-card production-card copy-${densityFor(f)} `
    );
  }

  function renderSheet(fixtures, ratio, root) {
    root.dataset.ratio = ratio;
    root.innerHTML = fixtures.map((f) => `
      <section class="contact-item" data-contact-fixture="${esc(f.fixtureId)}">
        <div class="contact-label">
          <strong>${esc(f.family.toUpperCase())}</strong>
          <span>${esc(f.fixtureId)} · ${esc(f.coverage)} / ${esc(f.source.state)}</span>
        </div>
        <div class="contact-frame ${ratio}">
          <div class="contact-scale">${renderFixture(f, ratio)}</div>
        </div>
      </section>
    `).join("");
  }

  function renderNativeTests(fixtures, root) {
    root.innerHTML = fixtures.flatMap((f) => ["wide","square"].map((ratio) => `
      <div class="native-test" data-native-fixture="${esc(f.fixtureId)}" data-native-ratio="${ratio}">
        ${renderFixture(f, ratio)}
      </div>
    `)).join("");
  }

  const params = new URLSearchParams(location.search);
  const ratio = params.get("ratio") === "square" ? "square" : "wide";
  renderSheet(payload.fixtures, ratio, document.querySelector("#contact-sheet"));
  renderNativeTests(payload.fixtures, document.querySelector("#native-tests"));

  window.BINRAT_SOCIAL_PRODUCTION = Object.freeze({
    renderFixture,
    toViewModel
  });
})();
