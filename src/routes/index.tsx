import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Cctv,
  Cpu,
  Laptop,
  MonitorPlay,
  ShieldCheck,
  Smartphone,
  Truck,
  Tv,
  Wifi,
  Zap,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { R7Player } from "@/components/site/R7Player";
import { SocialCards, SocialIconRow } from "@/components/site/SocialButtons";
import { WHATSAPP_DISPLAY, whatsappUrl } from "@/lib/social";
import heroImage from "@/assets/hero-tech.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "R7 Informática – Soluções Tecnológicas" },
      {
        name: "description",
        content:
          "Manutenção de celulares e computadores, redes, câmeras de segurança e TV online. Fale com a R7 Informática no WhatsApp.",
      },
      { property: "og:title", content: "R7 Informática – Soluções Tecnológicas" },
      {
        property: "og:description",
        content: "Assistência técnica, redes, CFTV e TV online em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const SERVICES = [
  { icon: Smartphone, title: "Manutenção de Celulares", text: "Diagnóstico, reparos e manutenção de smartphones." },
  { icon: Laptop, title: "Computadores e Notebooks", text: "Formatação, upgrades, manutenção e suporte técnico." },
  { icon: Wifi, title: "Internet e Redes", text: "Conectividade, configuração e soluções de rede." },
  { icon: Tv, title: "IPTV e TV Online", text: "Entretenimento e configuração de TV online." },
  { icon: Cctv, title: "Câmeras de Segurança", text: "Instalação, configuração e manutenção de CFTV." },
  { icon: Truck, title: "Tele-entrega e Retirada", text: "Mais comodidade para levar e buscar equipamentos." },
];

function Logo() {
  return (
    <a href="#inicio" className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl bg-neon font-display text-lg font-black text-accent-foreground shadow-glow-pink">
        R7
      </span>
      <span className="leading-tight">
        <span className="block whitespace-nowrap font-display text-xs font-bold tracking-[0.12em] sm:text-sm sm:tracking-[0.2em]">R7 INFORMÁTICA</span>
        <span className="block whitespace-nowrap font-mono text-[9px] tracking-[0.15em] text-neon-cyan sm:text-[10px] sm:tracking-[0.25em]">SOLUÇÕES TECNOLÓGICAS</span>
      </span>
    </a>
  );
}

function SectionTitle({ kicker, title, text }: { kicker: string; title: string; text?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <span className="font-mono text-xs tracking-[0.35em] text-neon-cyan">{kicker}</span>
      <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-muted-foreground">{text}</p>}
    </div>
  );
}

function Index() {
  return (
    <div id="inicio" className="relative overflow-x-hidden">
      <div className="tech-grid pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-surface-deep/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {[
              ["Serviços", "#servicos"],
              ["R7 Player", "#player"],
              ["Redes sociais", "#redes"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button asChild variant="glass" size="sm" className="hidden sm:inline-flex">
              <a href="#player">
                <MonitorPlay /> Assista já
              </a>
            </Button>
            <Button asChild variant="neon" size="sm">
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 font-mono text-[11px] tracking-[0.25em] text-neon-cyan">
            <Zap className="size-3.5" /> ASSISTÊNCIA TÉCNICA · TV ONLINE
          </span>
          <h1 className="mt-6 font-display text-4xl font-black leading-[1.05] sm:text-6xl">
            Tecnologia que <span className="text-neon">resolve</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Celulares, computadores, redes, câmeras de segurança e TV online — suporte rápido e
            especializado da R7 Informática.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="neon" size="xl">
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
                <FaWhatsapp /> Fale no WhatsApp
              </a>
            </Button>
            <Button asChild variant="cyber" size="xl">
              <a href="#servicos">
                Ver serviços <ArrowRight />
              </a>
            </Button>
          </div>
          <div className="mt-10">
            <p className="mb-3 font-mono text-[11px] tracking-[0.3em] text-muted-foreground">SIGA A R7</p>
            <SocialIconRow />
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-neon opacity-25 blur-3xl" />
          <div className="border-animated rounded-[1.75rem] p-1.5">
            <img
              src={heroImage}
              alt="Bancada de assistência técnica com celulares e notebook"
              className="aspect-[4/3.6] w-full rounded-[1.4rem] object-cover"
            />
          </div>
          <div className="animate-float absolute left-2 bottom-10 flex items-center gap-3 rounded-2xl glass px-4 py-3 sm:-left-8">
            <ShieldCheck className="size-8 text-neon-cyan" />
            <div>
              <p className="font-display text-sm font-bold">Diagnóstico preciso</p>
              <p className="text-xs text-muted-foreground">Celular, PC e notebook</p>
            </div>
          </div>
          <div className="animate-float absolute right-2 top-8 flex items-center gap-3 rounded-2xl glass px-4 py-3 [animation-delay:1.5s] sm:-right-6">
            <Cpu className="size-8 text-neon-pink" />
            <div>
              <p className="font-display text-sm font-bold">Suporte técnico</p>
              <p className="text-xs text-muted-foreground">Rápido e confiável</p>
            </div>
          </div>
        </div>
      </section>

      {/* Player */}
      <section id="player" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <SectionTitle kicker="// R7 PLAYER" title="Seu entretenimento em um só lugar" text="Canais ao vivo, filmes e séries com configuração feita pela R7." />
        <R7Player />
      </section>

      {/* Services */}
      <section id="servicos" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
        <SectionTitle kicker="// PRESTAÇÃO DE SERVIÇOS" title="Tecnologia, suporte e soluções" text="Tudo o que você precisa para seus equipamentos funcionarem de verdade." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <article
              key={s.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-panel p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-neon-cyan/60 hover:shadow-neon"
            >
              <span className="absolute right-5 top-5 font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="grid size-14 place-items-center rounded-2xl border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan transition-all duration-300 group-hover:bg-neon group-hover:text-accent-foreground group-hover:shadow-glow-pink">
                <s.icon className="size-7" />
              </span>
              <h3 className="mt-5 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              <a
                href={whatsappUrl(`Olá, gostaria de um orçamento: ${s.title}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-neon-cyan transition-all group-hover:gap-3"
              >
                Pedir orçamento <ArrowRight className="size-4" />
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Social */}
      <section id="redes" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-panel p-6 sm:p-10">
          <div className="tech-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <SectionTitle kicker="// CONECTE-SE" title="Siga a R7 em todas as redes" text="Novidades, dicas de tecnologia e promoções direto no seu feed." />
            <SocialCards />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-border/60 bg-surface-deep/80">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 pb-28 pt-10 sm:px-6 md:flex-row md:pb-10 md:justify-between">
          <Logo />
          <SocialIconRow size="sm" className="justify-center" />
          <p className="font-mono text-xs text-muted-foreground">WhatsApp {WHATSAPP_DISPLAY}</p>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a
        href={whatsappUrl("Olá, vim pelo site da R7")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco no WhatsApp"
        className="social-btn social-whatsapp animate-pulse-ring fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 font-semibold sm:px-5"
      >
        <FaWhatsapp className="social-icon size-6" />
        <span className="hidden text-sm sm:inline">Fale conosco</span>
      </a>
    </div>
  );
}
