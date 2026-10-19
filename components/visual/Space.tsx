/**
 * Linguagem visual da ASTRAE: céu estrelado e horizontes planetários com borda iluminada.
 * Ilustrações originais em CSS/SVG — decorativas, nunca representam dado científico.
 */

export type Tone = "earth" | "mars" | "ice" | "aurora";

const TONES: Record<Tone, { surface: string; rim: string; glow: string; haze: string; noise: string }> = {
  earth: {
    surface: "radial-gradient(70% 22% at 50% 0%, #dff1ff 0%, #8cc6ef 14%, #3f86c4 34%, #164a80 58%, #0a2445 80%, #050f22 100%)",
    rim: "rgba(150,210,255,.85)", glow: "rgba(70,150,255,.45)", haze: "rgba(40,110,230,.25)", noise: "0 0 0 0 .85  0 0 0 0 .93  0 0 0 0 1"
  },
  mars: {
    surface: "radial-gradient(70% 22% at 50% 0%, #ffe2c4 0%, #f2a066 12%, #c4552b 32%, #7a2c14 56%, #3a130a 80%, #160604 100%)",
    rim: "rgba(255,190,130,.9)", glow: "rgba(255,120,50,.45)", haze: "rgba(220,80,30,.25)", noise: "0 0 0 0 1  0 0 0 0 .78  0 0 0 0 .6"
  },
  ice: {
    surface: "radial-gradient(70% 22% at 50% 0%, #f4f8ff 0%, #c4d6ef 14%, #7b97c0 34%, #34507a 58%, #172840 80%, #070d18 100%)",
    rim: "rgba(220,235,255,.85)", glow: "rgba(150,180,240,.4)", haze: "rgba(110,140,220,.22)", noise: "0 0 0 0 .95  0 0 0 0 .97  0 0 0 0 1"
  },
  aurora: {
    surface: "radial-gradient(70% 22% at 50% 0%, #e2fff6 0%, #8fe6d2 13%, #3a9fb4 32%, #234a86 56%, #13183f 80%, #070818 100%)",
    rim: "rgba(160,255,225,.85)", glow: "rgba(90,200,220,.4)", haze: "rgba(120,90,230,.25)", noise: "0 0 0 0 .85  0 0 0 0 1  0 0 0 0 .97"
  }
};

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

/** Campo de estrelas determinístico (mesmo resultado no servidor e no navegador). */
export function Stars({ count = 160, seed = 7, dust = 0, height = 100 }: { count?: number; seed?: number; dust?: number; height?: number }) {
  const r = rng(seed);
  const stars = Array.from({ length: count }, () => ({ x: r() * 100, y: r() * height, s: r() < 0.92 ? 0.6 + r() * 0.9 : 1.5 + r() * 1.1, o: 0.25 + r() * 0.75 }));
  const specks = Array.from({ length: dust }, () => ({ x: r() * 100, y: r() * 100, a: r() * Math.PI * 2, l: 3 + r() * 8, o: 0.2 + r() * 0.45, red: r() < 0.6 }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {dust > 0 && (
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {specks.map((d, i) => (
            <line key={i} x1={d.x} y1={d.y} x2={d.x + Math.cos(d.a) * d.l * 0.06} y2={d.y + Math.sin(d.a) * d.l * 0.08}
              stroke={d.red ? "#ff5a6e" : "#7fb2ff"} strokeOpacity={d.o} strokeWidth={0.9} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          ))}
        </svg>
      )}
      {stars.map((s, i) => (
        <span key={i} className={`absolute rounded-full bg-white ${i % 13 === 0 ? "astrae-twinkle" : ""}`}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, boxShadow: s.s > 1.5 ? "0 0 6px rgba(190,220,255,.9)" : undefined, animationDelay: `${(i % 7) * 0.7}s` }} />
      ))}
    </div>
  );
}

/**
 * Disco planetário cujo topo (o horizonte) fica em `top`.
 * `width` controla a curvatura: quanto maior, mais plano o horizonte.
 */
export function Planet({ tone = "earth", top = "60%", width = "max(1500px, 175vw)", left = "50%", texture = true, className = "" }:
  { tone?: Tone; top?: string; width?: string; left?: string; texture?: boolean; className?: string }) {
  const t = TONES[tone];
  const id = `astrae-surface-${tone}`;
  return (
    <div aria-hidden className={`pointer-events-none absolute -translate-x-1/2 rounded-full ${className}`}
      style={{ top, left, width, aspectRatio: "1", boxShadow: `0 0 18px 3px ${t.rim}, 0 0 70px 18px ${t.glow}, 0 0 200px 60px ${t.haze}` }}>
      <div className="absolute inset-0 overflow-hidden rounded-full" style={{ background: t.surface }}>
        {texture && (
          <svg className="absolute inset-0 h-full w-full opacity-70 mix-blend-overlay">
            <filter id={id}><feTurbulence type="fractalNoise" baseFrequency="0.006 0.013" numOctaves="5" seed="7" /><feColorMatrix values={`${t.noise}  0 0 0 1.6 -.55`} /></filter>
            <rect width="100%" height="100%" filter={`url(#${id})`} />
          </svg>
        )}
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `inset 0 10px 24px ${t.rim.replace(/[\d.]+\)$/, ".5)")}, inset 0 40px 120px ${t.glow}` }} />
      </div>
    </div>
  );
}

/** Estrela distante com halo, como o "sol" das composições. */
export function Sun({ style, size = "clamp(20px, 3.2vw, 38px)" }: { style?: React.CSSProperties; size?: string }) {
  return <span aria-hidden className="pointer-events-none absolute rounded-full bg-white"
    style={{ width: size, height: size, boxShadow: "0 0 30px 6px rgba(255,255,255,.35), 0 0 90px 30px rgba(140,190,255,.18)", ...style }} />;
}
