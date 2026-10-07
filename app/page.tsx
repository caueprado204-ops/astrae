import Link from "next/link";
import { BookOpen, Cloud, Database, FlaskConical, LineChart, Map, Orbit, Search } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { OniStripes } from "@/components/landing/OniStripes";
import { LiveReadouts } from "@/components/landing/LiveReadouts";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const TREK = "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/0/0";

const SECTIONS = [
  { icon: Search, title: "Pesquisa científica", text: "Uma busca que atravessa catálogos da NASA Earthdata, relatórios técnicos, acervo de imagens e as séries ao vivo da plataforma — com a origem de cada resultado à vista.", href: "/search" },
  { icon: Cloud, title: "Monitoramento climático", text: "Previsão oficial do CPTEC/INPE, condições atuais nas capitais e séries diárias desde 1981 para qualquer ponto do Brasil.", href: "/climate" },
  { icon: Orbit, title: "Exploração planetária", text: "Clima medido pelo Curiosity sol a sol, imagens brutas dos rovers e o mapa global de Marte do NASA Trek.", href: "/mars" },
  { icon: Database, title: "Dados oficiais", text: "NASA, NOAA e INPE consultados pelo backend, com cache e status de conexão de cada fonte.", href: "/sources" },
  { icon: Map, title: "Mapas interativos", text: "Camadas de satélite do NASA GIBS — temperatura, chuva, nuvens, aerossóis, TSM — com escolha e comparação de datas.", href: "/maps" },
  { icon: LineChart, title: "Gráficos e séries temporais", text: "Zoom, comparação entre variáveis e exportação em PNG, CSV e JSON, sempre com o cabeçalho de proveniência.", href: "/data" },
  { icon: FlaskConical, title: "Laboratório de pesquisa", text: "Projetos com hipótese, perguntas, dados e referências salvos diretamente dos resultados.", href: "/research" },
  { icon: BookOpen, title: "Caderno científico", text: "Páginas com observação, metodologia, resultados, discussão e conclusão — e gráficos e mapas incorporados.", href: "/notebook" }
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2"><Logo /><span className="font-display font-semibold tracking-[0.08em]">ASTRAE</span></div>
        <nav className="flex items-center gap-4 text-sm text-dim">
          <Link href="/sources" className="hidden hover:text-ink sm:inline">Fontes</Link>
          <Link href="/login" className="hover:text-ink">Entrar</Link>
          <Link href="/overview" className="btn">Explorar plataforma</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-10 sm:pt-16">
        <p className="text-sm text-dim">Advanced Space &amp; Earth Research Environment</p>
        <h1 className="font-display mt-3 text-[clamp(56px,11vw,148px)] font-medium leading-[0.86] tracking-[0.04em]">ASTRAE</h1>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <p className="font-display text-2xl text-ink sm:text-3xl">Explore. Observe. Understand.</p>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-dim">
              Uma plataforma científica para explorar dados da Terra, do clima e do sistema planetário em um único ambiente de pesquisa.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link href="/overview" className="btn-primary">Explorar plataforma</Link>
              <Link href="/search" className="btn">Pesquisar dados</Link>
              <Link href="/mars" className="btn">Explorar Marte</Link>
              <Link href="/climate" className="btn">Monitorar clima</Link>
            </div>
          </div>
          <LiveReadouts />
        </div>
      </section>

      {/* Assinatura visual: dados reais. Cada faixa é um trimestre do ONI desde 1950. */}
      <section aria-label="Oceanic Niño Index desde 1950" className="border-y border-line">
        <OniStripes />
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-14 sm:grid-cols-3">
        <figure className="panel overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${GIBS}/GHRSST_L4_MUR_Sea_Surface_Temperature/default/default/GoogleMapsCompatible_Level7/0/0/0.png`} alt="Temperatura da superfície do mar, análise GHRSST MUR mais recente (NASA GIBS)" className="aspect-square w-full bg-bg object-cover" loading="lazy" />
          <figcaption className="p-3 text-xs text-dim">Temperatura da superfície do mar — GHRSST MUR L4, imagem mais recente servida pelo NASA GIBS.</figcaption>
        </figure>
        <figure className="panel overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${GIBS}/MERRA2_2m_Air_Temperature_Monthly/default/default/GoogleMapsCompatible_Level6/0/0/0.png`} alt="Temperatura do ar a 2 metros, média mensal MERRA-2 (NASA GIBS)" className="aspect-square w-full bg-bg object-cover" loading="lazy" />
          <figcaption className="p-3 text-xs text-dim">Temperatura do ar a 2 m — reanálise MERRA-2, último mês disponível.</figcaption>
        </figure>
        <figure className="panel overflow-hidden">
          <div className="grid aspect-square grid-cols-2 place-content-center bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${TREK}/0.jpg`} alt="Hemisfério ocidental de Marte, mosaico Viking" className="w-full" loading="lazy" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${TREK}/1.jpg`} alt="Hemisfério oriental de Marte, mosaico Viking" className="w-full" loading="lazy" />
          </div>
          <figcaption className="p-3 text-xs text-dim">Marte inteiro — mosaico colorido Viking MDIM 2.1 do NASA Mars Trek.</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="font-display text-2xl">Um laboratório digital, ponta a ponta</h2>
        <div className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
          {SECTIONS.map(({ icon: Icon, title, text, href }) => (
            <Link key={title} href={href} className="group flex gap-4">
              <Icon size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <h3 className="font-medium group-hover:text-accent">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-dim">{text}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-5 py-6 text-center text-xs text-faint">
        Dados de NASA, NOAA e INPE consultados em tempo real. A ASTRAE não produz nem altera números científicos — cada valor exibido leva sua fonte.
      </footer>
    </div>
  );
}
