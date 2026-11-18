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

/** Feeds públicos de reforço, carregados em segundo plano. */
export const EXTRA_FEEDS: { name: string; url: string }[] = [
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
    const score = (c: Channel) => (c.cc ? 2 : 0) + (c.logo ? 1 : 0);
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
      const name = s.match(/,(.+)$/)?.[1]?.trim();
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

/** Junta canais novos à lista existente sem repetir URLs nem nomes. */
export function mergeChannels(existing: Channel[], incoming: RawChannel[]): Channel[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((c) => c.u));
  const names = new Set(existing.map((c) => normName(c.n)).filter(Boolean));
  const out = existing.slice();
  for (const raw of incoming) {
    const key = normName(raw.n);
    if (!raw.u || seen.has(raw.u) || (key && names.has(key))) continue;
    seen.add(raw.u);
    if (key) names.add(key);
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
