import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Radio, Film, Clapperboard, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import tvImage from "@/assets/tv-neon.jpg";

const TABS = [
  { id: "live", label: "TV ao vivo", icon: Radio, title: "Canais ao vivo", text: "Seus canais e o guia de TV juntos, enquanto você navega.",
    items: ["Canal 01 · Programa ao vivo", "Canal 02 · Filme em destaque", "Canal 03 · Esportes", "Canal 04 · Entretenimento", "Canal 05 · Infantil"] },
  { id: "movies", label: "Filmes", icon: Film, title: "Biblioteca de filmes", text: "Explore filmes e descubra novos títulos.",
    items: ["Aventura", "Drama", "Ação", "Comédia", "Novidades"] },
  { id: "series", label: "Séries", icon: Clapperboard, title: "Suas séries", text: "Acompanhe suas séries e temporadas favoritas.",
    items: ["Série em destaque", "Novas temporadas", "Continue assistindo", "Mais populares"] },
  { id: "home", label: "Início", icon: Home, title: "R7 Player", text: "Tudo do seu entretenimento em um só lugar.",
    items: ["Canais ao vivo", "Filmes", "Séries", "Infantil"] },
] as const;

export function R7Player() {
  const [active, setActive] = useState(0);
  const tab = TABS[active] ?? TABS[0];

  return (
    <div className="border-animated rounded-3xl p-2 shadow-neon">
      <div className="overflow-hidden rounded-[1.25rem] bg-surface-deep">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-panel px-3 py-3 sm:px-5">
          <span className="mr-auto flex items-center gap-2 font-display text-sm font-bold tracking-widest">
            <span className="grid size-7 place-items-center rounded-lg bg-neon text-xs text-accent-foreground">R7</span>
            R7 PLAYER
          </span>
          <div role="tablist" className="flex flex-wrap gap-1 rounded-full bg-surface-deep/70 p-1">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300",
                  i === active
                    ? "bg-neon text-accent-foreground shadow-glow-pink"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div key={tab.id} className="grid animate-fade-up gap-4 p-4 sm:p-5 md:grid-cols-[1.4fr_1fr]">
          <div className="scanline relative aspect-video overflow-hidden rounded-2xl border border-border">
            <img src={tvImage} alt="TV online com canais, filmes e séries" className="size-full scale-105 object-cover saturate-150 brightness-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-deep/90 via-surface-deep/10 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/25 via-transparent to-neon-pink/25" />
            <Link
              to="/assistir"
              aria-label="Assistir agora no R7 Player"
              className="btn-shine absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-neon text-accent-foreground shadow-glow-pink transition-transform duration-300 hover:scale-110"
            >
              <Play className="ml-1 size-7 fill-current" />
            </Link>
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full glass px-3 py-1 font-mono text-[10px] tracking-widest text-neon-pink">
              <span className="size-1.5 animate-pulse rounded-full bg-neon-pink" /> AO VIVO · HD
            </span>
            <div className="absolute inset-x-4 bottom-4">
              <h3 className="font-display text-lg font-bold">{tab.title}</h3>
              <p className="text-xs text-muted-foreground">{tab.text}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-2/3 bg-neon" />
              </div>
            </div>
          </div>

          <ul className="grid content-start gap-2">
            {tab.items.map((item, i) => (
              <li key={item}>
                <Link
                  to="/assistir"
                  className={cn(
                    "group flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all duration-300",
                    i === 0
                      ? "border-neon-pink/60 bg-neon-pink/10"
                      : "border-border bg-secondary/40 hover:border-neon-cyan/60 hover:bg-neon-cyan/10",
                  )}
                >
                  <span>{item}</span>
                  <Play className="size-3.5 text-neon-cyan opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
