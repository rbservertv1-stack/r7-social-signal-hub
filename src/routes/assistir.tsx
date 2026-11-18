import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

// O player usa vídeo, localStorage e hls.js: só pode viver no navegador.
const R7PlayerApp = lazy(() =>
  import("@/components/site/R7PlayerApp").then((m) => ({ default: m.R7PlayerApp })),
);

export const Route = createFileRoute("/assistir")({
  head: () => ({
    meta: [
      { title: "R7 Player — Assistir TV ao vivo | R7 Informática" },
      {
        name: "description",
        content:
          "R7 Player: assista TV ao vivo, filmes e séries direto no navegador. Canais organizados, busca, favoritos e conexão Xtream Codes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "R7 Player — Assistir TV ao vivo" },
      {
        property: "og:description",
        content: "TV ao vivo no navegador: busca, favoritos, categorias e conexão Xtream Codes.",
      },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistirPage,
});

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-deep">
      <span className="font-display text-2xl font-black uppercase tracking-[0.28em] text-neon-cyan">
        R7
      </span>
      <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-neon-violet" />
        Carregando o player…
      </span>
    </div>
  );
}

function AssistirPage() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <R7PlayerApp />
    </Suspense>
  );
}
