import { Planet, Stars, Sun } from "@/components/visual/Space";

/**
 * Abertura da landing: o nome ASTRAE surgindo atrás do horizonte de um planeta iluminado.
 * Ilustração original em CSS/SVG (sem imagens externas) — decorativa, não é dado científico.
 */
export function PlanetHero({ header, children }: { header?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section aria-label="ASTRAE" className="space-scene relative isolate overflow-hidden text-white" style={{ height: "min(100svh, 980px)", minHeight: 600 }}>
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(60% 45% at 50% 40%, rgba(56,110,190,.28), transparent 70%), radial-gradient(40% 30% at 15% 20%, rgba(70,90,170,.18), transparent 70%), radial-gradient(35% 25% at 88% 28%, rgba(40,90,160,.15), transparent 70%)" }} />
      <Stars count={230} seed={20261018} dust={46} height={70} />
      <Sun style={{ left: "calc(50% + min(31vw, 340px))", top: "calc(60% - min(29vw, 300px))" }} />

      {header && <div className="absolute inset-x-0 top-0 z-30">{header}</div>}

      {/* o nome — a base das letras fica atrás do horizonte */}
      <h1 className="font-wide absolute left-1/2 z-0 select-none whitespace-nowrap leading-none"
        style={{ bottom: "40%", transform: "translate(-50%, 26%)", fontSize: "clamp(58px, 15vw, 210px)", letterSpacing: "0.04em",
          backgroundImage: "linear-gradient(180deg, #ffffff 0%, #eef6ff 55%, #a8cdf2 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          filter: "drop-shadow(0 0 28px rgba(120,180,255,.28))" }}>
        ASTRAE
      </h1>

      <Planet tone="earth" top="60%" className="z-10" />

      <div aria-hidden className="absolute inset-x-0 bottom-0 z-20 h-[40%]" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(3,7,15,.6) 50%, rgb(var(--space)) 100%)" }} />
      <div className="absolute inset-x-0 bottom-[6%] z-30 px-5 text-center">{children}</div>
    </section>
  );
}
