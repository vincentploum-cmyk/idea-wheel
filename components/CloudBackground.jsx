"use client";

const CLOUDS = [
  { x: "8%",  y: "6%",  w: 320, opacity: 0.55, delay: "0s",   dur: "28s" },
  { x: "58%", y: "3%",  w: 260, opacity: 0.45, delay: "-10s",  dur: "34s" },
  { x: "78%", y: "14%", w: 200, opacity: 0.38, delay: "-6s",   dur: "22s" },
  { x: "2%",  y: "28%", w: 180, opacity: 0.30, delay: "-14s",  dur: "30s" },
  { x: "44%", y: "20%", w: 240, opacity: 0.35, delay: "-8s",   dur: "26s" },
  { x: "86%", y: "38%", w: 160, opacity: 0.28, delay: "-18s",  dur: "32s" },
  { x: "20%", y: "55%", w: 200, opacity: 0.22, delay: "-4s",   dur: "38s" },
  { x: "64%", y: "62%", w: 280, opacity: 0.20, delay: "-12s",  dur: "24s" },
];

function Cloud({ x, y, w, opacity, delay, dur }) {
  const h = w * 0.45;
  return (
    <svg
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        pointerEvents: "none",
        animation: `clouddrift ${dur} ease-in-out infinite`,
        animationDelay: delay,
        zIndex: 0,
        willChange: "transform",
      }}
      viewBox="0 0 200 90"
      fill="white"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* base puff */}
      <ellipse cx="100" cy="68" rx="90" ry="22" />
      {/* left puff */}
      <ellipse cx="55" cy="55" rx="42" ry="30" />
      {/* centre top puff */}
      <ellipse cx="100" cy="42" rx="48" ry="36" />
      {/* right puff */}
      <ellipse cx="148" cy="52" rx="40" ry="28" />
      {/* small right accent */}
      <ellipse cx="170" cy="62" rx="28" ry="20" />
    </svg>
  );
}

export default function CloudBackground() {
  return (
    <>
      <style>{`
        @keyframes clouddrift {
          0%,100% { transform: translateX(0px); }
          50%      { transform: translateX(18px); }
        }
      `}</style>
      {CLOUDS.map((c, i) => <Cloud key={i} {...c} />)}
    </>
  );
}
