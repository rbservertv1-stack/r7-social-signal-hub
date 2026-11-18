/**
 * Camada de dados do R7 Player.
 * Toda execução acontece no navegador (após a hidratação) — nada aqui roda no servidor.
 */

export type ChannelSource = "api" | "feed" | "xtream" | "custom";

export type Channel = {
  id: number;
  chId: string | null;
  n: string;
  u: string;
  q: string | null;
  cc: string | null;
  cat: string;
  logo: string | null;
  source: ChannelSource;
};

export type RawChannel = Omit<Channel, "id">;

let seq = 0;
const nextId = () => ++seq;

const BLOCKED_HOSTS = ["youtube.com", "youtu.be", "twitch.tv", "dailymotion.com"];
const isBlocked = (url: string) => BLOCKED_HOSTS.some((host) => url.includes(host));

/** Nome normalizado, usado para não repetir o mesmo canal vindo de outra lista. */
const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "");

const API_BASE = "https://iptv-org.github.io/api";

const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://proxy.killcors.com/?url=",
];

export type ExtraFeed = {
  name: string;
  url: string;
  /** País de todos os canais da lista (mostra a bandeira). */
  cc?: string;
  /** Categoria fixa no lugar do group-title. */
  cat?: string;
  /** A lista usa o nome do país como group-title (Plex). */
  countryGroups?: boolean;
};

const KODI_LISTS = "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists";

/**
 * Feeds públicos de reforço, carregados em segundo plano.
 * Os primeiros são os mesmos canais grátis e legais dos addons de TV do Kodi
 * (Pluto TV, Tubi, Plex, PVR IPTV Simple Client com a lista do Brasil).
 */
export const EXTRA_FEEDS: ExtraFeed[] = [
  { name: "Pluto TV Brasil", url: `${KODI_LISTS}/plutotv_br.m3u`, cc: "BR" },
  { name: "IPTV Legal (Meu Tédio)", url: "https://tv.meuted.io/iptvlegal.m3u" },
  {
    name: "Filmes em domínio público",
    url: "https://raw.githubusercontent.com/bitinfinitus/public-domain-catalog/main/catalog/pt/public_domain_master_pt.m3u8",
  },
  { name: "Canais do Brasil", url: "https://iptv-org.github.io/iptv/countries/br.m3u", cc: "BR" },
  {
    name: "Runtime TV",
    url: "https://raw.githubusercontent.com/josemtocco/m3u-fast-br/main/playlists/runtime-tv.m3u",
    cc: "BR",
  },
  { name: "AutoM3U Brasil", url: "https://a.autom3u.com/playlist/country/br.m3u", cc: "BR" },
  { name: "Lista Brasil R7", url: "https://raw.githubusercontent.com/iptv-com/iptv/refs/heads/main/lists/brazil.m3u", cc: "BR" },
  { name: "Tubi", url: `${KODI_LISTS}/tubi_all.m3u`, cc: "US" },
  { name: "Plex", url: `${KODI_LISTS}/plex_all.m3u`, cat: "Plex", countryGroups: true },
  { name: "Free-TV", url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8" },
  { name: "FreecastHub", url: "https://raw.githubusercontent.com/freecasthub/public-iptv/main/playlist.m3u" },
  { name: "Roku Channel", url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/roku_all.m3u" },
  { name: "Samsung TV+", url: "https://apsattv.com/ssungusa.m3u" },
  { name: "XUMO", url: "https://www.apsattv.com/xumo.m3u" },
  { name: "LG Channels", url: "https://www.apsattv.com/lg.m3u" },
  { name: "Local Now", url: "https://www.apsattv.com/localnow.m3u" },
  { name: "DistroTV", url: "https://www.apsattv.com/distro.m3u" },
  { name: "Xiaomi", url: "https://www.apsattv.com/xiaomi.m3u" },
  { name: "Fire TV", url: "https://www.apsattv.com/firetv.m3u" },
  { name: "Cineverse", url: "https://www.apsattv.com/cineverse.m3u" },
  { name: "Klowd TV", url: "https://www.apsattv.com/klowd.m3u" },
  { name: "TVpass", url: "https://tvpass.org/playlist/m3u" },
];

const COUNTRY_CODES: Record<string, string> = {
  "United States": "US",
  Canada: "CA",
  "United Kingdom": "GB",
  Australia: "AU",
  Mexico: "MX",
  Spain: "ES",
  France: "FR",
  Germany: "DE",
  Italy: "IT",
  Brazil: "BR",
  Brasil: "BR",
  Argentina: "AR",
  "New Zealand": "NZ",
  India: "IN",
};

/** Aplica país e categoria da lista de origem aos canais lidos. */
export function applyFeedMeta(list: RawChannel[], feed: ExtraFeed): RawChannel[] {
  return list.map((c) => ({
    ...c,
    cc: feed.cc ?? (feed.countryGroups ? COUNTRY_CODES[c.cat] ?? null : c.cc),
    cat: feed.cat ?? c.cat,
  }));
}

/** Arquivo de vídeo comum (filme .mp4 etc.), tocado direto pelo navegador sem hls.js. */
export function isDirectVideo(url: string): boolean {
  return /\.(mp4|m4v|webm|ogv|mov)$/i.test(url.split(/[?#]/)[0] ?? "");
}

/**
 * Canais do Pluto TV só liberam o sinal para o próprio site do Pluto TV.
 * Para eles, o player oferece abrir o canal lá (grátis, sem cadastro).
 */
export function externalWatchUrl(url: string): string | null {
  const id = url.match(/jmp2\.uk\/plu-([a-f0-9]{24})/i)?.[1];
  return id ? `https://pluto.tv/br/live-tv/${id}` : null;
}

export function flagEmoji(cc: string | null): string {
  if (!cc || cc.length !== 2) return "🌐";
  const base = 0x1f1e6;
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65);
}

/** Busca direto e, se o servidor bloquear CORS, tenta os proxies públicos. */
export async function fetchWithProxy(url: string, timeout = 9000): Promise<string> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (r.ok) return await r.text();
  } catch {
    /* segue para os proxies */
  }
  for (const proxy of CORS_PROXIES) {
    try {
      const r = await fetch(proxy + encodeURIComponent(url), {
        signal: AbortSignal.timeout(timeout + 5000),
      });
      if (r.ok) return await r.text();
    } catch {
      /* tenta o próximo proxy */
    }
  }
  throw new Error("não foi possível carregar");
}

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

type ApiChannel = {
  id: string;
  name: string;
  country: string;
  categories: string[];
  is_nsfw?: boolean;
  closed?: boolean;
};
type ApiStream = {
  channel?: string;
  url: string;
  title?: string;
  quality?: string;
  referrer?: string;
  user_agent?: string;
};
type ApiLogo = { channel: string; url: string };

/** Grade principal: iptv-org (canais + streams + logos). */
export async function loadApiChannels(): Promise<Channel[]> {
  const [channels, streams, logos] = await Promise.all([
    fetchJSON<ApiChannel[]>(`${API_BASE}/channels.json`),
    fetchJSON<ApiStream[]>(`${API_BASE}/streams.json`),
    fetchJSON<ApiLogo[]>(`${API_BASE}/logos.json`),
  ]);

  const channelMap: Record<string, ApiChannel> = {};
  for (const ch of channels) {
    if (ch.is_nsfw || ch.closed) continue;
    channelMap[ch.id] = ch;
  }

  const logoMap: Record<string, string> = {};
  for (const lg of logos) {
    if (!logoMap[lg.channel]) logoMap[lg.channel] = lg.url;
  }

  const seen = new Set<string>();
  const list: Channel[] = [];
  for (const st of streams) {
    if (!st.url || seen.has(st.url)) continue;
    if (isBlocked(st.url)) continue;
    if (!st.channel && !st.title) continue;
    seen.add(st.url);
    const meta = st.channel ? channelMap[st.channel] : undefined;
    list.push({
      id: nextId(),
      chId: st.channel || null,
      n: meta ? meta.name : st.title || "Sem nome",
      u: st.url,
      q: st.quality || null,
      cc: meta ? meta.country : null,
      cat: meta && meta.categories.length ? (meta.categories[0] ?? "other") : "other",
      logo: st.channel ? logoMap[st.channel] || null : null,
      source: "api",
    });
  }

  list.sort((a, b) => {
    // canais que tocam aqui vêm antes dos que só abrem no site do Pluto TV
    const score = (c: Channel) =>
      (c.cc ? 2 : 0) + (c.logo ? 1 : 0) - (externalWatchUrl(c.u) ? 4 : 0);
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return a.n.localeCompare(b.n);
  });

  const names = new Set<string>();
  return list.filter((c) => {
    const key = normName(c.n);
    if (!key || names.has(key)) return false;
    names.add(key);
    return true;
  });
}

/** Converte texto M3U/M3U8 em canais. */
export function parseM3U(text: string): RawChannel[] {
  const out: RawChannel[] = [];
  let pending: RawChannel | null = null;

  for (const line of text.split("\n")) {
    const s = line.trim();
    if (s.startsWith("#EXTINF:")) {
      // o nome vem depois da primeira vírgula fora dos atributos entre aspas
      const name = s.match(/^#EXTINF:[^,"]*(?:"[^"]*"[^,"]*)*,(.*)$/)?.[1]?.trim();
      const group = s.match(/group-title="([^"]*)"/)?.[1];
      const logo = s.match(/tvg-logo="([^"]*)"/)?.[1];
      pending = {
        chId: null,
        n: (name || "Sem nome").replace(/\s*[ⓈⓎⒼⓉⒹ]/g, "").trim(),
        u: "",
        q: null,
        cc: null,
        cat: group || "other",
        logo: logo || null,
        source: "feed",
      };
    } else if (s && !s.startsWith("#") && s.startsWith("http")) {
      if (isBlocked(s)) {
        pending = null;
        continue;
      }
      if (pending) {
        out.push({ ...pending, u: s });
        pending = null;
      }
    }
  }

  return out;
}

/**
 * Junta canais novos à lista existente sem repetir URLs nem nomes.
 * Se o canal já existe só como link do Pluto TV e chega uma versão que toca aqui,
 * a versão que toca substitui a antiga.
 */
export function mergeChannels(existing: Channel[], incoming: RawChannel[]): Channel[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((c) => c.u));
  const names = new Map<string, number>();
  existing.forEach((c, i) => {
    const key = normName(c.n);
    if (key && !names.has(key)) names.set(key, i);
  });
  const out = existing.slice();
  for (const raw of incoming) {
    if (!raw.u || seen.has(raw.u)) continue;
    const key = normName(raw.n);
    const at = key ? names.get(key) : undefined;
    if (at !== undefined) {
      const old = out[at];
      if (old && externalWatchUrl(old.u) && !externalWatchUrl(raw.u)) {
        out[at] = { ...raw, id: old.id };
        seen.add(raw.u);
      }
      continue;
    }
    seen.add(raw.u);
    if (key) names.set(key, out.length);
    out.push({ ...raw, id: nextId() });
  }
  return out;
}

export type XtreamResult = { channels: RawChannel[]; categories: number };

/** Servidor Xtream Codes: lista de canais ao vivo + categorias. */
export async function connectXtream(host: string, user: string, pass: string): Promise<XtreamResult> {
  let server = host.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(server)) server = `http://${server}`;

  const qs = `username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
  const res = await fetch(`${server}/player_api.php?${qs}&action=get_live_streams`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`servidor respondeu HTTP ${res.status}`);

  const streams = await res.json();
  if (!Array.isArray(streams)) {
    throw new Error((streams && streams.message) || "resposta inválida ou credenciais recusadas");
  }

  const categories: Record<string, string> = {};
  try {
    const cr = await fetch(`${server}/player_api.php?${qs}&action=get_live_categories`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (cr.ok) {
      const cats = await cr.json();
      if (Array.isArray(cats)) {
        for (const c of cats) categories[String(c.category_id)] = c.category_name;
      }
    }
  } catch {
    /* categorias são opcionais */
  }

  const channels: RawChannel[] = streams
    .filter((st: { stream_id?: number }) => st && st.stream_id != null)
    .map((st: {
      stream_id: number;
      name?: string;
      container_extension?: string;
      category_id?: number | string;
      stream_icon?: string;
    }) => {
      const ext = (st.container_extension || "ts").replace(/[^a-z0-9]/gi, "") || "ts";
      return {
        chId: null,
        n: st.name || `Canal ${st.stream_id}`,
        u: `${server}/live/${encodeURIComponent(user)}/${encodeURIComponent(pass)}/${encodeURIComponent(st.stream_id)}.${ext}`,
        q: null,
        cc: null,
        cat: categories[String(st.category_id)] || "Xtream",
        logo: st.stream_icon || null,
        source: "xtream" as ChannelSource,
      };
    });

  return { channels, categories: Object.keys(categories).length };
}
