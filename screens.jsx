/* ============================================================
   SPINUP — screens
   ============================================================ */
const { useState, useEffect } = React;

/* ---------- LANDING ---------- */
function Landing({ onStart, segments }) {
  const fc = useReveals(true);
  return (
    <section className={`screen screen-enter landing ${fc}`}>
      <div className="landing-chips" aria-hidden="true">
        {segments.map((s, i) => (
          <span key={s.id} className="float-chip" style={{
            "--c": s.color, left: CHIP_POS[i].x + "%", top: CHIP_POS[i].y + "%",
            animationDelay: (i * 0.5) + "s" }}>
            <span className="float-dot" style={{ background: s.color }}></span>{s.label}
          </span>
        ))}
      </div>

      <div className="landing-inner">
        <div className="eyebrow reveal" style={{ animationDelay: ".05s" }}>From a spin to a startup</div>
        <h1 className="display landing-h1">
          <span className="reveal" style={{ animationDelay: ".12s", display: "block" }}>Spin the wheel.</span>
          <span className="grad-text reveal" style={{ animationDelay: ".22s", display: "block" }}>Ship the company.</span>
        </h1>
        <p className="landing-sub reveal" style={{ animationDelay: ".34s" }}>
          One spin lands you on a real, validated startup idea — then Spinup builds the whole
          blueprint: product, go-to-market, infrastructure, and a clickable prototype.
        </p>
        <div className="landing-cta reveal" style={{ animationDelay: ".46s" }}>
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            <Icon.spark /> Spin an idea
          </button>
          <div className="landing-meta">
            <Icon.check style={{ color: "var(--good)" }} /> No signup · Free to try
          </div>
        </div>

        <div className="landing-steps reveal" style={{ animationDelay: ".6s" }}>
          {[["01", "Spin", "Land on a frontier"], ["02", "Validate", "Read the market"], ["03", "Build", "Get the blueprint"]].map(([n, t, d]) => (
            <div className="land-step" key={n}>
              <span className="land-step-n grad-text">{n}</span>
              <div><div className="land-step-t">{t}</div><div className="land-step-d">{d}</div></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
const CHIP_POS = [
  { x: 7, y: 19 }, { x: 80, y: 13 }, { x: 14, y: 62 }, { x: 86, y: 56 },
  { x: 4, y: 41 }, { x: 90, y: 35 }, { x: 6, y: 84 }, { x: 89, y: 82 },
];

/* ---------- WHEEL SCREEN ---------- */
function WheelScreen({ segments, onValidate, motion, wheelStyle }) {
  const [result, setResult] = useState(null);
  const [show, setShow] = useState(false);
  const handle = (s) => { setResult(s); setShow(true); };
  const fc = useReveals(true);
  return (
    <section className={`screen screen-enter ${fc}`}>
      <div className="screen-head">
        <div className="eyebrow">Step one</div>
        <h2 className="display screen-title">Give it a spin</h2>
        <p className="screen-desc">Eight frontiers, one decisive spin. The pointer picks your starting line.</p>
      </div>

      <div className="wheel-stage">
        <Wheel segments={segments} onResult={handle} motion={motion} style={wheelStyle} />

        <div className={`result-card ${show ? "in" : ""}`}>
          {!result ? (
            <div className="result-empty">
              <div className="result-empty-ring"><BrandMark size={30} /></div>
              <div>
                <div className="result-empty-t">Your idea appears here</div>
                <div className="result-empty-d">Hit <b>SPIN</b> to draw from {segments.length} frontiers</div>
              </div>
            </div>
          ) : (
            <React.Fragment>
              <span className="chip result-domain" style={{ "--c": result.color }}>
                <span className="float-dot" style={{ background: result.color }}></span>{result.label}
              </span>
              <h3 className="display result-title">{result.title}</h3>
              <p className="result-tagline">{result.tagline}</p>
              <p className="result-blurb">{result.blurb}</p>
              <div className="result-actions">
                <button className="btn btn-primary" onClick={() => onValidate(result)}>
                  Validate this idea <Icon.arrow />
                </button>
              </div>
            </React.Fragment>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- VALIDATE SCREEN ---------- */
function ValidateScreen({ idea, onBuild }) {
  const [scanning, setScanning] = useState(true);
  useEffect(() => { const t = setTimeout(() => setScanning(false), 1500); return () => clearTimeout(t); }, [idea]);
  const v = idea.validation;
  const fc = useReveals(!scanning);
  return (
    <section className={`screen screen-enter validate ${fc}`}>
      <div className="screen-head">
        <div className="eyebrow">Step two · Market check</div>
        <h2 className="display screen-title">Is <span className="grad-text">{idea.title}</span> worth building?</h2>
        <p className="screen-desc">{idea.tagline}</p>
      </div>

      {scanning ? (
        <div className="scan glass">
          <div className="scan-bar"><div className="scan-fill" /></div>
          <div className="scan-text"><span className="scan-pulse"><Icon.pulse /></span> Scanning demand, market size & competition…</div>
        </div>
      ) : (
        <div className="validate-grid">
          <div className="card v-score reveal">
            <ScoreRing value={v.demand} label="Demand" />
            <div className="v-score-side">
              <span className="chip" style={{ background: compTint(v.competition), color: "#fff", border: "none" }}>
                {v.competition} competition
              </span>
              <p className="v-verdict">{v.verdict}</p>
            </div>
          </div>

          <div className="card v-market reveal" style={{ animationDelay: ".08s" }}>
            <div className="v-market-cell">
              <div className="v-k grad-text display">{v.market.tam}</div>
              <div className="v-l">{v.market.tamLabel}</div>
            </div>
            <div className="v-divider" />
            <div className="v-market-cell">
              <div className="v-k display" style={{ color: "var(--good)" }}>{v.market.growth} <Icon.trend style={{ color: "var(--good)" }} /></div>
              <div className="v-l">{v.market.growthLabel}</div>
            </div>
          </div>

          <div className="card v-signals reveal" style={{ animationDelay: ".16s" }}>
            <div className="v-signals-head"><Icon.pulse /> Market signals</div>
            {v.signals.map((sig, i) => (
              <div className="v-signal" key={i}>
                <div className="v-signal-top"><span>{sig.label}</span><b>{sig.value}</b></div>
                <Meter value={sig.strength} delay={300 + i * 160} />
              </div>
            ))}
          </div>

          <div className="v-cta reveal" style={{ animationDelay: ".24s" }}>
            <div className="v-cta-text">Signal is strong. Ready to turn this into a real plan?</div>
            <button className="btn btn-primary btn-lg" onClick={() => onBuild(idea)}>
              <Icon.spark /> Generate the blueprint
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
function compTint(c) {
  return c === "Low" ? "var(--good)" : c === "Medium" ? "var(--violet)" : "var(--coral)";
}

/* ---------- BLUEPRINT SCREEN ---------- */
function BlueprintScreen({ idea, onSpinAgain }) {
  const [gen, setGen] = useState(true);
  useEffect(() => { const t = setTimeout(() => setGen(false), 1700); return () => clearTimeout(t); }, [idea]);
  const b = idea.blueprint;
  const fc = useReveals(!gen);
  const sections = [
    { k: "product", icon: Icon.product, title: "Product", data: b.product, listKey: "features", listLabel: "Core features" },
    { k: "gtm", icon: Icon.gtm, title: "Go-to-Market", data: b.gtm, listKey: "channels", listLabel: "Channels" },
    { k: "infra", icon: Icon.infra, title: "Infrastructure", data: b.infra, listKey: "stack", listLabel: "Stack", chips: true },
    { k: "proto", icon: Icon.proto, title: "Prototype", data: b.proto, listKey: "screens", listLabel: "Key screens", phones: true },
  ];
  return (
    <section className={`screen screen-enter blueprint ${fc}`}>
      <div className="screen-head">
        <div className="eyebrow">Step three · The plan</div>
        <h2 className="display screen-title">The <span className="grad-text">{idea.title}</span> blueprint</h2>
        <p className="screen-desc">{idea.blurb}</p>
      </div>

      {gen ? (
        <div className="scan glass">
          <div className="scan-bar"><div className="scan-fill" /></div>
          <div className="scan-text"><span className="scan-pulse"><Icon.spark /></span> Drafting product, GTM, infrastructure & prototype…</div>
        </div>
      ) : (
        <React.Fragment>
          <div className="bp-grid">
            {sections.map((s, i) => (
              <div className={`card bp-card reveal bp-${s.k}`} key={s.k} style={{ animationDelay: (i * 0.1) + "s" }}>
                <div className="bp-card-head">
                  <span className="bp-icon"><s.icon /></span>
                  <h3 className="bp-title">{s.title}</h3>
                </div>
                <p className="bp-summary">{s.data.summary}</p>
                <div className="bp-list-label">{s.listLabel}</div>
                {s.phones ? (
                  <div className="bp-phones">
                    {s.data[s.listKey].map((scr, j) => (
                      <div className="bp-phone" key={j}>
                        <div className="bp-phone-screen">
                          <span className="bp-phone-bar" /><span className="bp-phone-bar sm" />
                          <span className="bp-phone-block" />
                        </div>
                        <span className="bp-phone-label">{scr}</span>
                      </div>
                    ))}
                  </div>
                ) : s.chips ? (
                  <div className="bp-chips">
                    {s.data[s.listKey].map((it, j) => <span className="chip" key={j}>{it}</span>)}
                  </div>
                ) : (
                  <ul className="bp-list">
                    {s.data[s.listKey].map((it, j) => (
                      <li key={j}><span className="bp-check"><Icon.check /></span>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="bp-footer reveal" style={{ animationDelay: ".5s" }}>
            <div className="bp-footer-text">
              <div className="bp-footer-t display">That's a company in 3 spins.</div>
              <div className="bp-footer-d">Not feeling it? Draw another frontier and compare.</div>
            </div>
            <div className="bp-footer-actions">
              <button className="btn btn-ghost" onClick={onSpinAgain}><Icon.refresh /> Spin again</button>
              <button className="btn btn-primary"><Icon.spark /> Save blueprint</button>
            </div>
          </div>
        </React.Fragment>
      )}
    </section>
  );
}

Object.assign(window, { Landing, WheelScreen, ValidateScreen, BlueprintScreen });
