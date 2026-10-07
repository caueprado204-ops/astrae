import type { GibsLayer } from "./gibs-client";

export function Legend({ layer }: { layer: GibsLayer }) {
  if (!layer.legendUrl) return null;
  return (
    <figure className="rounded border border-line bg-white/95 p-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={layer.legendUrl} alt={`Legenda — ${layer.title}`} className="h-auto w-full max-w-[340px]" loading="lazy" />
    </figure>
  );
}
