/* ============================================================
   SPINUP — app root
   ============================================================ */
const { useState, useEffect, useRef } = React;

const ORDER = ["landing", "wheel", "validate", "blueprint"];
const MOTION_MAP = { calm: 0.6, standard: 1, lively: 1.6 };

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#7c3aed", "#c026d3", "#ff4d8d"],
  "accent": "#c026d3",
  "motion": "standard",
  "radius": "round",
  "background": "vivid"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const segments = window.SPINUP_DATA.segments;

  const restore = () => {
    try {
      const s = JSON.parse(localStorage.getItem("spinup") || "{}");
      if (s.screen && ORDER.includes(s.screen)) {
        const idea = segments.find((x) => x.id === s.ideaId) || null;
        if (s.screen !== "landing" && !idea) return { screen: "landing", idea: null, max: "landing" };
        return { screen: s.screen, idea, max: s.max || s.screen };
      }
    } catch (e) {}
    return { screen: "landing", idea: null, max: "landing" };
  };
  const init = useRef(restore()).current;
  const [screen, setScreen] = useState(init.screen);
  const [idea, setIdea] = useState(init.idea);
  const [maxReached, setMaxReached] = useState(init.max);

  useEffect(() => {
    localStorage.setItem("spinup", JSON.stringify({ screen, ideaId: idea?.id, max: maxReached }));
  }, [screen, idea, maxReached]);

  // apply theme
  useEffect(() => {
    const root = document.documentElement;
    const [c0, c1, c2] = t.palette || TWEAK_DEFAULTS.palette;
    root.style.setProperty("--grad-brand", `linear-gradient(120deg, ${c0} 0%, ${c1} 45%, ${c2} 100%)`);
    root.style.setProperty("--violet", c0);
    root.style.setProperty("--magenta", c1);
    root.style.setProperty("--pink", c2);
    const rad = t.radius === "soft" ? { lg: "16px", xl: "22px", md: "12px" } : { lg: "24px", xl: "34px", md: "16px" };
    root.style.setProperty("--r-lg", rad.lg); root.style.setProperty("--r-xl", rad.xl); root.style.setProperty("--r-md", rad.md);
    document.body.classList.toggle("bg-vivid", t.background === "vivid");
  }, [t]);

  const advance = (to, newIdea) => {
    if (newIdea) setIdea(newIdea);
    setScreen(to);
    if (ORDER.indexOf(to) > ORDER.indexOf(maxReached)) setMaxReached(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const home = () => { setScreen("landing"); setMaxReached("landing"); setIdea(null); window.scrollTo({ top: 0 }); };
  const jump = (s) => { if (ORDER.indexOf(s) <= ORDER.indexOf(maxReached)) advance(s); };

  const motion = MOTION_MAP[t.motion] ?? 1;

  return (
    <React.Fragment>
      <div className="app-bg" />
      <div className="blob" style={{ width: 460, height: 460, top: "-8%", left: "-6%", background: "var(--violet)" }} />
      <div className="blob" style={{ width: 420, height: 420, bottom: "-12%", right: "-6%", background: "var(--pink)", animationDelay: "-7s" }} />

      <TopBar screen={screen} maxReached={maxReached} onHome={home} onJump={jump} />

      <div className="stage" key={screen}>
        {screen === "landing" && <Landing segments={segments} onStart={() => advance("wheel")} />}
        {screen === "wheel" && <WheelScreen segments={segments} motion={motion} wheelStyle="spectrum"
          onValidate={(s) => advance("validate", s)} />}
        {screen === "validate" && idea && <ValidateScreen idea={idea} onBuild={(s) => advance("blueprint", s)} />}
        {screen === "blueprint" && idea && <BlueprintScreen idea={idea} onSpinAgain={() => advance("wheel")} />}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Brand gradient" />
        <TweakColor label="Palette" value={t.palette}
          options={[
            ["#7c3aed", "#c026d3", "#ff4d8d"],
            ["#5b5bf5", "#9333ea", "#ec4899"],
            ["#d946ef", "#ec4899", "#ff6f61"],
            ["#6366f1", "#8b5cf6", "#22d3ee"],
          ]}
          onChange={(v) => setTweak("palette", v)} />
        <TweakSection label="Feel" />
        <TweakRadio label="Motion" value={t.motion} options={["calm", "standard", "lively"]}
          onChange={(v) => setTweak("motion", v)} />
        <TweakRadio label="Corners" value={t.radius} options={["soft", "round"]}
          onChange={(v) => setTweak("radius", v)} />
        <TweakRadio label="Backdrop" value={t.background} options={["calm", "vivid"]}
          onChange={(v) => setTweak("background", v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
