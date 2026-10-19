import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Cloud, Database, FlaskConical, GraduationCap, LineChart, Map, Orbit, Search } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { OniStripes } from "@/components/landing/OniStripes";
import { LiveReadouts } from "@/components/landing/LiveReadouts";
import { PlanetHero } from "@/components/landing/PlanetHero";
import { Planet, Stars } from "@/components/visual/Space";

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
  const nav = (
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5"><Logo /><span className="font-wide text-sm tracking-[0.2em]">ASTRAE</span></Link>
      <nav className="flex items-center gap-5 text-[12px] uppercase tracking-[0.16em] text-white/70">
        <Link href="/earth" className="hidden hover:text-white md:inline">Terra</Link>
        <Link href="/mars" className="hidden hover:text-white md:inline">Marte</Link>
        <Link href="/enso" className="hidden hover:text-white md:inline">Clima</Link>
        <Link href="/study" className="hidden hover:text-white md:inline">Estudar</Link>
        <Link href="/login" className="hover:text-white">Entrar</Link>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen">
      <PlanetHero header={nav}>
        <div className="astrae-rise mx-auto max-w-2xl" style={{ animationDelay: ".2s" }}>
          <p className="eyebrow text-white/60">Advanced Space &amp; Earth Research Environment</p>
          <p className="font-wide mt-3 text-[15px] text-white sm:text-lg">Explore · Observe · Understand</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Link href="/overview" className="btn-glass">Explorar plataforma <ArrowRight size={15} /></Link>
            <Link href="/study" className="btn-glass hidden sm:inline-flex">Estudar</Link>
          </div>
          <a href="#leituras" aria-label="Rolar para baixo" className="mx-auto mt-6 block w-fit text-white/50 hover:text-white"><ChevronDown size={22} /></a>
        </div>
      </PlanetHero>

      <section id="leituras" className="mx-auto max-w-7xl px-5 pb-6 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow text-dim">Missão</p>
            <h2 className="font-wide mt-2 text-[28px] leading-tight sm:text-[40px]">Terra, clima<br />e espaço</h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-dim">
              Uma plataforma científica para explorar dados da Terra, do clima e do sistema planetário em um único ambiente de pesquisa — com dados reais da NASA, NOAA e INPE e a fonte de cada número à vista.
            </p>
          </div>
          <LiveReadouts />
        </div>
      </section>

      {/* Assinatura visual: dados reais. Cada faixa é um trimestre do ONI desde 1950. */}
      <section aria-label="Oceanic Niño Index desde 1950" className="mx-auto mt-8 max-w-7xl px-5 sm:px-8">
        <div className="overflow-hidden rounded-3xl border border-line/70"><OniStripes /></div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid auto-rows-[minmax(220px,auto)] gap-4 md:grid-cols-3">
          <ImageCard className="md:row-span-2" eyebrow="Oceano · GHRSST MUR L4" title="Temperatura do mar" href="/maps"
            img={`${GIBS}/GHRSST_L4_MUR_Sea_Surface_Temperature/default/default/GoogleMapsCompatible_Level7/0/0/0.png`}
            alt="Temperatura da superfície do mar, análise GHRSST MUR mais recente (NASA GIBS)" note="Imagem mais recente servida pelo NASA GIBS." />
          <Link href="/search" className="group relative overflow-hidden rounded-3xl bg-accent p-6 text-bg">
            <Search size={22} />
            <h3 className="font-wide mt-6 text-xl leading-snug">Pesquisa científica</h3>
            <p className="mt-2 text-sm leading-relaxed opacity-80">Catálogos da NASA Earthdata, relatórios técnicos, acervo de imagens e séries ao vivo em uma busca só.</p>
            <ArrowRight size={18} className="absolute bottom-6 right-6 transition group-hover:translate-x-1" />
          </Link>
          <ImageCard eyebrow="Marte · Viking MDIM 2.1" title="Planeta vermelho" href="/mars" mars
            alt="Mosaico global colorido de Marte (NASA Mars Trek)" note="Mosaico global do NASA Mars Trek." />
          <ImageCard eyebrow="Atmosfera · MERRA-2" title="Temperatura do ar" href="/maps"
            img={`${GIBS}/MERRA2_2m_Air_Temperature_Monthly/default/default/GoogleMapsCompatible_Level6/0/0/0.png`}
            alt="Temperatura do ar a 2 metros, média mensal MERRA-2 (NASA GIBS)" note="Reanálise, último mês disponível." />
          <Link href="/study" className="group relative overflow-hidden rounded-3xl border border-line/70 bg-[#e7c590] p-6 text-[#1b1206]">
            <GraduationCap size={22} />
            <h3 className="font-wide mt-6 text-xl leading-snug">Estudar</h3>
            <p className="mt-2 text-sm leading-relaxed opacity-80">Videoaulas oficiais da NASA com transcrição, trilhas por tema e anotações que vão direto para o seu caderno.</p>
            <ArrowRight size={18} className="absolute bottom-6 right-6 transition group-hover:translate-x-1" />
          </Link>
        </div>

        <h2 className="font-wide mt-20 text-[22px] sm:text-[28px]">Um laboratório digital</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map(({ icon: Icon, title, text, href }) => (
            <Link key={title} href={href} className="panel group p-5 transition hover:-translate-y-0.5 hover:border-accent/50">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel2"><Icon size={17} className="text-accent" /></span>
              <h3 className="mt-4 font-medium group-hover:text-accent">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-dim">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-scene relative isolate overflow-hidden">
        <Stars count={90} seed={42} height={60} />
        <Planet tone="mars" top="58%" width="max(1300px, 150vw)" />
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(3,7,15,.9), transparent 60%)" }} />
        <div className="relative mx-auto flex min-h-[420px] max-w-7xl flex-col items-center justify-end px-5 pb-14 text-center">
          <p className="eyebrow text-white/60">Comece agora</p>
          <h2 className="font-wide mt-3 text-[26px] text-white sm:text-[40px]">Sua pesquisa começa aqui</h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <Link href="/login" className="btn-glass">Criar conta</Link>
            <Link href="/overview" className="btn-glass">Explorar sem conta</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-5 py-6 text-center text-xs text-faint">
        Dados de NASA, NOAA e INPE consultados em tempo real. A ASTRAE não produz nem altera números científicos — cada valor exibido leva sua fonte. Ilustrações de planetas são artísticas.
      </footer>
    </div>
  );
}

function ImageCard({ img, alt, title, eyebrow, href, note, mars, className = "" }:
  { img?: string; alt: string; title: string; eyebrow: string; href: string; note: string; mars?: boolean; className?: string }) {
  return (
    <Link href={href} className={`group relative isolate block min-h-[220px] overflow-hidden rounded-3xl border border-line/70 bg-[#03070f] ${className}`}>
      {mars ? (
        <div className="absolute inset-0 -z-10 grid grid-cols-2 place-content-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${TREK}/0.jpg`} alt={alt} className="w-full text-transparent transition duration-700 group-hover:scale-105" loading="lazy" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${TREK}/1.jpg`} alt="" className="w-full text-transparent transition duration-700 group-hover:scale-105" loading="lazy" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt={alt} className="absolute inset-0 -z-10 h-full w-full object-cover text-transparent transition duration-700 group-hover:scale-105" loading="lazy" />
      )}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "linear-gradient(0deg, rgba(3,7,15,.92) 0%, rgba(3,7,15,.2) 55%, transparent 100%)" }} />
      <div className="flex h-full flex-col justify-end p-6 text-white">
        <p className="eyebrow text-white/60">{eyebrow}</p>
        <h3 className="font-wide mt-2 text-lg">{title}</h3>
        <p className="mt-1 text-xs text-white/60">{note}</p>
      </div>
    </Link>
  );
}
