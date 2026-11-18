import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type HlsType from "hls.js";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  ListVideo,
  Plus,
  Radio,
  Search,
  SkipForward,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { WHATSAPP_DISPLAY, whatsappUrl } from "@/lib/social";
import {
  type Channel,
  type RawChannel,
  EXTRA_FEEDS,
  applyFeedMeta,
  connectXtream,
  externalWatchUrl,
  isDirectVideo,
  fetchWithProxy,
  flagEmoji,
  loadApiChannels,
  mergeChannels,
  parseM3U,
} from "@/lib/iptv";

const LS = { favs: "r7_favs", recent: "r7_recent", custom: "r7_custom" } as const;

type Tab = "all" | "favs" | "recent" | "custom";
type Stage = "idle" | "loading" | "playing" | "error" | "external";
type Saved = { n: string; u: string };

const MAX_ROWS = 400;

function readStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível */
  }
}

/** Lê o título do programa embutido no stream (tags ID3). */
function extractTitle(input: Uint8Array | ArrayBuffer): string | null {
  try {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let str = "";
    for (const c of bytes) {
      if (c >= 32 && c < 127) str += String.fromCharCode(c);
    }
    const m =
      str.match(/title[=:]\s*"?([^";\n]+)/i) ||
      str.match(/StreamTitle='([^']+)'/) ||
      str.match(/TIT2.{0,4}(.{3,80})/);
    const found = m?.[1];
    if (found) {
      const title = found.replace(/[\x00-\x1F]/g, "").trim();
      if (title.length > 2 && title.length < 200) return title;
    }
  } catch {
    /* sem metadados */
  }
  return null;
}

function customToRaw(list: Saved[]): RawChannel[] {
  return list.map((c) => ({
    chId: null,
    n: c.n,
    u: c.u,
    q: null,
    cc: null,
    cat: "custom",
    logo: null,
    source: "custom" as const,
  }));
}

export function R7PlayerApp() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [status, setStatus] = useState("Conectando à grade R7…");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [tab, setTab] = useState<Tab>("all");
  const [current, setCurrent] = useState<Channel | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [program, setProgram] = useState("");
  const [favs, setFavs] = useState<Record<string, 1>>(() => readStore(LS.favs, {}));
  const [recent, setRecent] = useState<string[]>(() => readStore(LS.recent, []));
  const [custom, setCustom] = useState<Saved[]>(() => readStore(LS.custom, []));
  const [dead, setDead] = useState<Record<string, 1>>({});
  const [alive, setAlive] = useState<Record<string, 1>>({});
  const [autoSkip, setAutoSkip] = useState(true);
  const [clock, setClock] = useState("");

  // formulário Xtream
  const [xtHost, setXtHost] = useState("");
  const [xtUser, setXtUser] = useState("");
  const [xtPass, setXtPass] = useState("");
  const [xtBusy, setXtBusy] = useState(false);
  const [xtMsg, setXtMsg] = useState("");
  const [xtErr, setXtErr] = useState(false);

  // canal manual / lista
  const [cName, setCName] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [cPlaylist, setCPlaylist] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const skipTimer = useRef<number | null>(null);
  const currentRef = useRef<Channel | null>(null);
  const filteredRef = useRef<Channel[]>([]);
  const deadRef = useRef<Record<string, 1>>({});
  const autoSkipRef = useRef(true);
  const bootRef = useRef(false);
  const feedsRef = useRef(false);
  const tuneRef = useRef<(ch: Channel) => void>(() => {});
  const stepRef = useRef<(dir: 1 | -1) => void>(() => {});

  const clearSkip = useCallback(() => {
    if (skipTimer.current) {
      window.clearTimeout(skipTimer.current);
      skipTimer.current = null;
    }
  }, []);

  const stopPlayer = useCallback(() => {
    clearSkip();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      try {
        v.removeAttribute("src");
        v.load();
      } catch {
        /* alguns navegadores recusam o reset */
      }
    }
  }, [clearSkip]);

  const markDead = useCallback((url: string) => {
    setDead((d) => (d[url] ? d : { ...d, [url]: 1 }));
    setAlive((a) => {
      if (!a[url]) return a;
      const next = { ...a };
      delete next[url];
      return next;
    });
  }, []);

  const markAlive = useCallback((url: string) => {
    setAlive((a) => (a[url] ? a : { ...a, [url]: 1 }));
    setDead((d) => {
      if (!d[url]) return d;
      const next = { ...d };
      delete next[url];
      return next;
    });
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    const list = filteredRef.current;
    if (!list.length) return;
    const cur = currentRef.current;
    const i = cur ? list.findIndex((c) => c.id === cur.id) : -1;

    if (dir === -1) {
      const back = list[i > 0 ? i - 1 : list.length - 1];
      if (back) tuneRef.current(back);
      return;
    }

    let ni = i;
    let tries = 0;
    let target = list[ni];
    while (tries < list.length) {
      ni = (ni + 1 + list.length) % list.length;
      tries++;
      const candidate = list[ni];
      if (!candidate) continue;
      target = candidate;
      if (!deadRef.current[candidate.u]) break;
    }
    if (target) tuneRef.current(target);
  }, []);

  const tune = useCallback(
    (ch: Channel) => {
      stopPlayer();
      currentRef.current = ch;
      setCurrent(ch);
      setProgram("");
      setErrorMsg("");
      setStage("loading");
      setRecent((r) => [ch.u, ...r.filter((u) => u !== ch.u)].slice(0, 30));
      if (ch.chId && typeof history !== "undefined") {
        history.replaceState(null, "", `#${encodeURIComponent(ch.chId)}`);
      }

      // Pluto TV: o sinal só abre no site deles, então oferecemos o link direto
      if (externalWatchUrl(ch.u)) {
        setStage("external");
        return;
      }

      const v = videoRef.current;
      if (!v) {
        setStage("error");
        setErrorMsg("O player não pôde ser iniciado neste navegador.");
        return;
      }

      if (autoSkipRef.current) {
        skipTimer.current = window.setTimeout(() => {
          if (currentRef.current?.id !== ch.id) return;
          markDead(ch.u);
          stepRef.current(1);
        }, 7000);
      }

      import("hls.js")
        .then(({ default: Hls }) => {
          if (currentRef.current?.id !== ch.id) return;

          // filmes em .mp4 tocam direto no vídeo do navegador; HLS passa pelo hls.js
          if (Hls.isSupported() && !isDirectVideo(ch.u)) {
            const hls = new Hls({
              enableWorker: true,
              maxBufferLength: 15,
              manifestLoadingTimeOut: 6000,
              manifestLoadingMaxRetry: 1,
              levelLoadingTimeOut: 6000,
              levelLoadingMaxRetry: 1,
              fragLoadingTimeOut: 8000,
            });
            hlsRef.current = hls;
            hls.loadSource(ch.u);
            hls.attachMedia(v);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              clearSkip();
              setStage("playing");
              markAlive(ch.u);
              v.play().catch(() => {});
            });
            hls.on(Hls.Events.FRAG_PARSING_METADATA, (_event, data) => {
              const samples = data.samples;
              if (!samples) return;
              for (const s of samples) {
                if (!s.data) continue;
                const title = extractTitle(s.data);
                if (title && currentRef.current?.id === ch.id) {
                  setProgram(title);
                  break;
                }
              }
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal) return;
              clearSkip();
              markDead(ch.u);
              if (autoSkipRef.current && currentRef.current?.id === ch.id) {
                stepRef.current(1);
                return;
              }
              setStage("error");
              setErrorMsg(
                data.type === "networkError"
                  ? "Sinal bloqueado pelo servidor (CORS) ou fora do ar."
                  : "Canal indisponível ou restrito por região.",
              );
            });
            return;
          }

          // Safari/iOS (HLS nativo) e arquivos de filme
          v.src = ch.u;
          v.load();
          v.play()
            .then(() => {
              clearSkip();
              setStage("playing");
              markAlive(ch.u);
            })
            .catch(() => {
              v.muted = true;
              v.play()
                .then(() => {
                  clearSkip();
                  setStage("playing");
                  markAlive(ch.u);
                  setProgram("🔇 Toque no vídeo e tire o mudo para ouvir o áudio");
                })
                .catch(() => {
                  clearSkip();
                  setStage("playing");
                });
            });
          v.addEventListener(
            "error",
            () => {
              clearSkip();
              markDead(ch.u);
              if (autoSkipRef.current) {
                stepRef.current(1);
                return;
              }
              setStage("error");
              setErrorMsg("Canal indisponível. Tente outro.");
            },
            { once: true },
          );
        })
        .catch(() => {
          setStage("error");
          setErrorMsg("Falha ao iniciar o player de vídeo.");
        });
    },
    [clearSkip, markAlive, markDead, stopPlayer],
  );

  useEffect(() => {
    tuneRef.current = tune;
  }, [tune]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    deadRef.current = dead;
  }, [dead]);

  useEffect(() => {
    autoSkipRef.current = autoSkip;
  }, [autoSkip]);

  // carrega a grade principal uma única vez
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    (async () => {
      try {
        const api = await loadApiChannels();
        const withCustom = mergeChannels(api, customToRaw(custom));
        setChannels(withCustom);
        setStatus(`${withCustom.length} canais prontos`);
        const share = typeof location !== "undefined" ? location.hash.slice(1) : "";
        if (share) {
          const found = withCustom.find((c) => c.chId === decodeURIComponent(share));
          if (found) tuneRef.current(found);
        }
      } catch {
        setStatus("Grade principal indisponível — conecte um servidor ou lista própria.");
      }
    })();
  }, [custom]);

  // reforço: feeds públicos em segundo plano
  useEffect(() => {
    if (!channels.length || feedsRef.current) return;
    feedsRef.current = true;
    (async () => {
      let loaded = 0;
      for (const feed of EXTRA_FEEDS) {
        setStatus(`Carregando ${feed.name}…`);
        try {
          const text = await fetchWithProxy(feed.url);
          const parsed = applyFeedMeta(parseM3U(text), feed);
          setChannels((prev) => mergeChannels(prev, parsed));
          loaded++;
        } catch {
          /* feed bloqueado, segue */
        }
      }
      setChannels((prev) => {
        setStatus(`${prev.length} canais prontos · ${loaded} fontes extras`);
        return prev;
      });
    })();
  }, [channels.length]);

  useEffect(() => writeStore(LS.favs, favs), [favs]);
  useEffect(() => writeStore(LS.recent, recent), [recent]);
  useEffect(() => writeStore(LS.custom, custom), [custom]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => stopPlayer(), [stopPlayer]);

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(query.trim().toLowerCase()), 200);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of channels) if (c.cat) set.add(c.cat);
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [channels]);

  const filtered = useMemo(() => {
    let src = channels;
    if (tab === "favs") src = channels.filter((c) => favs[c.u]);
    else if (tab === "recent") {
      src = recent
        .map((u) => channels.find((c) => c.u === u))
        .filter((c): c is Channel => Boolean(c));
    } else if (tab === "custom") src = channels.filter((c) => c.source === "custom");

    const active = cat === "All" ? null : cat;
    return src.filter(
      (c) =>
        (!active || c.cat === active) &&
        (!search ||
          c.n.toLowerCase().includes(search) ||
          (c.cc || "").toLowerCase().includes(search) ||
          (c.cat || "").toLowerCase().includes(search)),
    );
  }, [channels, tab, cat, search, favs, recent]);

  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const toggleFav = useCallback((url: string) => {
    setFavs((f) => {
      const next = { ...f };
      if (next[url]) delete next[url];
      else next[url] = 1;
      return next;
    });
  }, []);

  const addCustom = useCallback(
    (raw: RawChannel[]) => {
      if (!raw.length) return;
      setChannels((prev) => mergeChannels(prev, raw));
      setCustom((prev) => {
        const seen = new Set(prev.map((c) => c.u));
        const next = prev.slice();
        for (const c of raw) if (!seen.has(c.u)) next.push({ n: c.n, u: c.u });
        return next;
      });
      setCat("All");
      setTab("all");
    },
    [],
  );

  const connectXtreamNow = useCallback(async () => {
    if (!xtHost.trim() || !xtUser.trim() || !xtPass.trim()) {
      setXtErr(true);
      setXtMsg("Preencha servidor, usuário e senha.");
      return;
    }
    setXtBusy(true);
    setXtErr(false);
    setXtMsg("Conectando ao servidor e buscando canais ao vivo…");
    try {
      const res = await connectXtream(xtHost, xtUser, xtPass);
      if (!res.channels.length) {
        setXtErr(true);
        setXtMsg("Servidor respondeu, mas não trouxe canais ao vivo.");
        return;
      }
      addCustom(res.channels);
      setXtMsg(`${res.channels.length} canais do Xtream na lista geral.`);
      setStatus(`${res.channels.length} canais do Xtream carregados`);
    } catch (e) {
      setXtErr(true);
      setXtMsg(
        `Falha na conexão: ${e instanceof Error ? e.message : "erro desconhecido"}. Se foi CORS, o servidor precisa liberar acesso ao navegador.`,
      );
    } finally {
      setXtBusy(false);
    }
  }, [addCustom, xtHost, xtPass, xtUser]);

  const addManual = useCallback(() => {
    let url = cUrl.trim();
    if (!url) {
      setXtErr(true);
      setXtMsg("Informe a URL do stream.");
      return;
    }
    if (url.startsWith("http://")) url = url.replace("http://", "https://");
    const name = cName.trim() || `Canal: ${url.split("/").pop()?.split("?")[0] || "stream"}`;
    addCustom([
      { chId: null, n: name, u: url, q: null, cc: null, cat: "custom", logo: null, source: "custom" },
    ]);
    setCName("");
    setCUrl("");
    setXtMsg(`"${name}" adicionado.`);
    setXtErr(false);
  }, [addCustom, cName, cUrl]);

  const loadPlaylistUrl = useCallback(async () => {
    const url = cPlaylist.trim();
    if (!url) {
      setXtErr(true);
      setXtMsg("Informe a URL da lista M3U.");
      return;
    }
    setXtBusy(true);
    setXtMsg("Carregando lista…");
    try {
      const text = await fetchWithProxy(url, 15000);
      const parsed = parseM3U(text).map((c) => ({ ...c, source: "custom" as const }));
      if (!parsed.length) throw new Error("nenhum canal encontrado na lista");
      addCustom(parsed);
      setCPlaylist("");
      setXtErr(false);
      setXtMsg(`${parsed.length} canais da lista adicionados.`);
    } catch (e) {
      setXtErr(true);
      setXtMsg(`Não deu para ler a lista: ${e instanceof Error ? e.message : "erro"}`);
    } finally {
      setXtBusy(false);
    }
  }, [addCustom, cPlaylist]);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = parseM3U(String(reader.result || "")).map((c) => ({
          ...c,
          source: "custom" as const,
        }));
        if (!parsed.length) {
          setXtErr(true);
          setXtMsg("O arquivo não contém canais válidos.");
          return;
        }
        addCustom(parsed);
        setXtErr(false);
        setXtMsg(`${parsed.length} canais do arquivo adicionados.`);
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [addCustom],
  );

  const removeCustom = useCallback((url: string) => {
    setChannels((prev) => prev.filter((c) => !(c.source === "custom" && c.u === url)));
    setCustom((prev) => prev.filter((c) => c.u !== url));
  }, []);

  const clearCustom = useCallback(() => {
    setChannels((prev) => prev.filter((c) => c.source !== "custom"));
    setCustom([]);
    setXtMsg("Lista própria limpa.");
    setXtErr(false);
  }, []);

  const aliveCount = Object.keys(alive).length;
  const deadCount = Object.keys(dead).length;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-deep text-foreground">
      <header className="relative z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-surface-deep/95 px-3 backdrop-blur-xl sm:gap-3 sm:px-4">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-all hover:border-neon-cyan/50 hover:bg-neon-cyan/10 hover:text-neon-cyan"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">Voltar</span>
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-panel relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10">
            <Radio className="size-4 text-neon-cyan" />
          </span>
          <div className="min-w-0 leading-none">
            <span className="block font-display text-sm font-black uppercase tracking-[0.2em]">
              R7 <span className="text-neon">Player</span>
            </span>
            <span className="hidden truncate font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
              ao vivo · filmes · séries
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:flex">
            <Clock className="size-3 text-neon-pink" />
            {clock}
          </span>
          <a
            href={whatsappUrl()}
            target="_blank"
            rel="noreferrer"
            className="social-btn social-whatsapp grid size-9 shrink-0 place-items-center rounded-xl"
            aria-label={`WhatsApp ${WHATSAPP_DISPLAY}`}
          >
            <FaWhatsapp className="social-icon size-4" />
          </a>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={cn(
            "order-2 flex h-[46vh] w-full flex-col border-t border-border/60 bg-surface-deep/80 lg:static lg:order-none lg:z-auto lg:h-auto lg:w-[330px] lg:max-w-[340px] lg:border-r lg:border-t-0 lg:bg-surface-deep/70 lg:backdrop-blur-xl",
          )}
        >
          <div className="px-3 pt-3">
            <div className="glass flex items-center gap-2 rounded-xl px-3 py-2">
              <Search className="size-3.5 shrink-0 text-neon-cyan" />
              <input
                id="srch"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar canal, país ou categoria"
                className="w-full bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground transition-colors hover:text-neon-pink"
                  aria-label="Limpar busca"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 px-3 pt-3">
            {(
              [
                ["all", "Tudo", ListVideo],
                ["favs", "Favoritos", Star],
                ["recent", "Recentes", Clock],
                ["custom", "Minha lista", Plus],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-lg border py-2 transition-all",
                  tab === key
                    ? "bg-neon border-transparent text-surface-deep"
                    : "border-border/60 text-muted-foreground hover:border-neon-cyan/40 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>

          {tab === "custom" && (
            <div className="mx-3 mt-3 space-y-2 rounded-xl border border-border/60 bg-black/30 p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-neon-cyan">
                Servidor Xtream Codes
              </p>
              <input
                value={xtHost}
                onChange={(e) => setXtHost(e.target.value)}
                placeholder="http://servidor:porta"
                className="glass w-full rounded-lg px-2.5 py-2 font-mono text-[10px] outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={xtUser}
                  onChange={(e) => setXtUser(e.target.value)}
                  placeholder="usuário"
                  className="glass w-full rounded-lg px-2.5 py-2 font-mono text-[10px] outline-none"
                />
                <input
                  value={xtPass}
                  onChange={(e) => setXtPass(e.target.value)}
                  type="password"
                  placeholder="senha"
                  className="glass w-full rounded-lg px-2.5 py-2 font-mono text-[10px] outline-none"
                />
              </div>
              <button
                type="button"
                disabled={xtBusy}
                onClick={connectXtreamNow}
                className="btn-shine bg-neon w-full rounded-lg py-2 font-display text-[10px] font-black uppercase tracking-[0.16em] text-surface-deep transition-all hover:brightness-110 disabled:opacity-60"
              >
                {xtBusy ? "Conectando…" : "Conectar e carregar canais"}
              </button>

              <p className="pt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-neon-violet">
                Canal avulso
              </p>
              <input
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                placeholder="nome do canal"
                className="glass w-full rounded-lg px-2.5 py-2 font-mono text-[10px] outline-none"
              />
              <input
                value={cUrl}
                onChange={(e) => setCUrl(e.target.value)}
                placeholder="https://…/index.m3u8"
                className="glass w-full rounded-lg px-2.5 py-2 font-mono text-[10px] outline-none"
              />
              <button
                type="button"
                onClick={addManual}
                className="w-full rounded-lg border border-neon-cyan/40 py-2 font-display text-[10px] font-black uppercase tracking-[0.16em] text-neon-cyan transition-all hover:bg-neon-cyan/10"
              >
                Adicionar canal
              </button>

              <p className="pt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-neon-pink">
                Lista M3U
              </p>
              <input
                value={cPlaylist}
                onChange={(e) => setCPlaylist(e.target.value)}
                placeholder="https://…/lista.m3u"
                className="glass w-full rounded-lg px-2.5 py-2 font-mono text-[10px] outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={xtBusy}
                  onClick={loadPlaylistUrl}
                  className="rounded-lg border border-neon-violet/40 py-2 font-display text-[10px] font-black uppercase tracking-[0.14em] text-neon-violet transition-all hover:bg-neon-violet/10 disabled:opacity-60"
                >
                  Carregar URL
                </button>
                <label className="cursor-pointer rounded-lg border border-border/70 py-2 text-center font-display text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground transition-all hover:border-neon-cyan/40 hover:text-neon-cyan">
                  <Upload className="mr-1 inline size-3" />
                  Arquivo
                  <input
                    type="file"
                    accept=".m3u,.m3u8,text/plain"
                    onChange={onFile}
                    className="hidden"
                  />
                </label>
              </div>

              {custom.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      {custom.length} salvos
                    </span>
                    <button
                      type="button"
                      onClick={clearCustom}
                      className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-destructive transition-opacity hover:opacity-70"
                    >
                      <Trash2 className="size-3" />
                      limpar
                    </button>
                  </div>
                  <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                    {custom.map((c) => (
                      <div
                        key={c.u}
                        className="flex items-center gap-2 border-b border-border/40 py-1"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-muted-foreground">
                          {c.n}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCustom(c.u)}
                          className="text-destructive transition-opacity hover:opacity-70"
                          aria-label={`Remover ${c.n}`}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {xtMsg && (
                <p
                  className={cn(
                    "rounded-lg border px-2 py-1.5 font-mono text-[9px] leading-relaxed",
                    xtErr
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-neon-cyan/30 bg-neon-cyan/5 text-neon-cyan",
                  )}
                >
                  {xtMsg}
                </p>
              )}
            </div>
          )}

          <div className="mt-3 max-h-24 overflow-y-auto px-3">
            <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-x-visible">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-all",
                    cat === c
                      ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan"
                      : "border-border/50 text-muted-foreground hover:border-neon-cyan/30 hover:text-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {filtered.slice(0, MAX_ROWS).map((c) => {
              const on = current?.id === c.id;
              const isFav = Boolean(favs[c.u]);
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => tune(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      tune(c);
                    }
                  }}
                  className={cn(
                    "group mb-1 flex cursor-pointer items-center gap-2 rounded-xl border px-2 py-2 transition-all",
                    on
                      ? "border-animated bg-white/6"
                      : "border-transparent hover:border-border/60 hover:bg-white/4",
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-mat/90 font-mono text-[9px] font-bold text-surface-deep">
                    {c.logo ? (
                      <img
                        src={c.logo}
                        alt=""
                        loading="lazy"
                        className="size-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      c.n.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {alive[c.u] && <span className="text-[8px] text-neon-cyan">●</span>}
                      {dead[c.u] && <span className="text-[8px] text-destructive">✕</span>}
                      <span className="truncate text-[11px] font-medium">{c.n}</span>
                      {c.q && (
                        <span
                          className={cn(
                            "shrink-0 rounded px-1 font-mono text-[8px] uppercase",
                            c.q.includes("1080") || c.q.includes("4K")
                              ? "bg-neon-violet/20 text-neon-violet"
                              : "bg-white/8 text-muted-foreground",
                          )}
                        >
                          {c.q}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      {c.cc ? `${flagEmoji(c.cc)} ` : ""}
                      {c.cat}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFav(c.u);
                    }}
                    className={cn(
                      "shrink-0 rounded-lg p-1 transition-all",
                      isFav
                        ? "text-neon-pink"
                        : "text-muted-foreground/50 hover:text-neon-pink",
                    )}
                    aria-label={isFav ? `Remover ${c.n} dos favoritos` : `Favoritar ${c.n}`}
                  >
                    <Star className={cn("size-3.5", isFav && "fill-current")} />
                  </button>
                </div>
              );
            })}

            {filtered.length > MAX_ROWS && (
              <p className="py-2 text-center font-mono text-[9px] text-muted-foreground">
                Mostrando {MAX_ROWS} de {filtered.length}. Refine a busca.
              </p>
            )}
            {filtered.length === 0 && (
              <p className="py-6 text-center font-mono text-[10px] text-muted-foreground">
                {tab === "favs"
                  ? "Nenhum favorito ainda. Toque na estrela de um canal."
                  : tab === "recent"
                    ? "Nenhum canal assistido ainda."
                    : "Nenhum canal com esse filtro."}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-3 py-2">
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {status}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
              {filtered.length}/{channels.length}
              {aliveCount || deadCount ? ` · ${aliveCount}✓ ${deadCount}✕` : ""}
            </span>
          </div>
        </aside>

        <main className="order-1 flex min-w-0 flex-1 flex-col bg-surface-deep lg:order-none">
          <div className="flex min-h-0 flex-1 items-start justify-center p-3 sm:p-5 lg:items-center">
            <div className="scanline border-animated relative aspect-video max-h-full w-full max-w-[calc((100dvh-13rem)*1.777)] overflow-hidden rounded-2xl bg-black/50">
            <video
              ref={videoRef}
              playsInline
              controls
              className={cn(
                "absolute inset-0 size-full object-contain",
                stage === "playing" ? "block" : "hidden",
              )}
            />

            {stage !== "playing" && (
              <div className="tech-grid absolute inset-0 grid place-items-center p-3 sm:p-6">
                {stage === "loading" && (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Loader2 className="size-8 animate-spin text-neon-violet" />
                    <p className="font-display text-sm font-black uppercase tracking-[0.2em]">
                      Sintonizando…
                    </p>
                    <p className="max-w-xs truncate font-mono text-[10px] text-muted-foreground">
                      {current?.n}
                    </p>
                  </div>
                )}

                {stage === "error" && (
                  <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                    <AlertTriangle className="size-8 text-destructive" />
                    <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-destructive">
                      Sinal perdido
                    </p>
                    <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {errorMsg}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => step(1)}
                        className="btn-shine bg-neon rounded-xl px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.16em] text-surface-deep transition-all hover:brightness-110"
                      >
                        Próximo canal
                      </button>
                      <button
                        type="button"
                        onClick={() => current && tune(current)}
                        className="glass rounded-xl px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:border-neon-cyan/50"
                      >
                        Tentar de novo
                      </button>
                    </div>
                  </div>
                )}

                {stage === "external" && current && (
                  <div className="flex max-w-sm flex-col items-center gap-2 text-center sm:gap-3">
                    <Radio className="hidden size-8 text-neon-cyan sm:block" />
                    <p className="font-display text-xs font-black uppercase tracking-[0.2em] sm:text-sm">
                      Canal Pluto TV
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground sm:hidden">
                      Grátis, abre no site do Pluto TV.
                    </p>
                    <p className="hidden text-xs leading-relaxed text-muted-foreground sm:block">
                      <span className="font-semibold text-foreground">{current.n}</span> é grátis, mas
                      só toca no site do Pluto TV — o mesmo canal do addon do Kodi. Abre em uma nova
                      aba, sem cadastro.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <a
                        href={externalWatchUrl(current.u) ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-shine bg-neon inline-flex items-center gap-1.5 rounded-xl px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.16em] text-surface-deep transition-all hover:brightness-110"
                      >
                        <ExternalLink className="size-3.5" /> Assistir no Pluto TV
                      </a>
                      <button
                        type="button"
                        onClick={() => step(1)}
                        className="glass rounded-xl px-4 py-2 font-display text-[10px] font-black uppercase tracking-[0.16em] transition-all hover:border-neon-cyan/50"
                      >
                        Próximo canal
                      </button>
                    </div>
                  </div>
                )}

                {stage === "idle" && (
                  <div className="animate-fade-up flex max-w-md flex-col items-center gap-4 text-center">
                    <span className="bg-panel border-animated clip-tech grid size-16 place-items-center">
                      <Film className="size-7 text-neon-cyan" />
                    </span>
                    <h1 className="font-display text-xl font-black uppercase tracking-[0.22em] sm:text-2xl">
                      R7 <span className="text-neon">Player</span>
                    </h1>
                    <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {status}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neon-cyan">
                      Escolha um canal na lista
                    </p>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 border-t border-border/60 bg-surface-deep/95 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl">
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-mat/90 font-mono text-[10px] text-surface-deep">
              {current?.logo ? (
                <img
                  src={current.logo}
                  alt=""
                  className="size-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Radio className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold">
                {current ? current.n : "Nada sintonizado"}
              </p>
              <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {program
                  ? `Agora: ${program}`
                  : current
                    ? `${current.cc ? `${flagEmoji(current.cc)} ` : ""}${current.cat}${current.q ? ` · ${current.q}` : ""}`
                    : ("Busque e assista")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoSkip((v) => !v)}
              className={cn(
                "hidden shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] transition-all sm:flex",
                autoSkip
                  ? "border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              <SkipForward className="size-3" />
              {autoSkip ? "Auto-skip" : "Skip off"}
            </button>
            <button
              type="button"
              onClick={() => step(-1)}
              className="social-btn grid size-9 shrink-0 place-items-center rounded-xl"
              aria-label="Canal anterior"
            >
              <ChevronLeft className="social-icon size-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className="social-btn social-whatsapp grid size-9 shrink-0 place-items-center rounded-xl"
              aria-label="Próximo canal"
            >
              <ChevronRight className="social-icon size-4" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
