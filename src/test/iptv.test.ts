import { describe, expect, it } from "vitest";
import {
  type Channel,
  EXTRA_FEEDS,
  applyFeedMeta,
  externalWatchUrl,
  isPortugueseChannel,
  mergeChannels,
  parseM3U,
} from "@/lib/iptv";

const base: Channel = {
  id: 1,
  chId: null,
  n: "R7 TV",
  u: "https://a/x.m3u8",
  q: null,
  cc: null,
  cat: "general",
  logo: null,
  source: "api",
};

describe("parseM3U", () => {
  it("lê nome, categoria e logo do bloco EXTINF", () => {
    const parsed = parseM3U(
      '#EXTINF:-1 tvg-logo="https://logo/1.png" group-title="Cinema",R7 Filmes\nhttps://cdn/r7.m3u8\n',
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.n).toBe("R7 Filmes");
    expect(parsed[0]?.cat).toBe("Cinema");
    expect(parsed[0]?.logo).toBe("https://logo/1.png");
    expect(parsed[0]?.u).toBe("https://cdn/r7.m3u8");
  });

  it("descarta links do YouTube e entradas sem URL", () => {
    const parsed = parseM3U(
      "#EXTINF:-1,R7Tube\nhttps://youtube.com/watch?v=1\n#EXTINF:-1,Sem URL\n",
    );
    expect(parsed).toHaveLength(0);
  });
});

describe("mergeChannels", () => {
  it("não repete URL nem nome de canal", () => {
    const merged = mergeChannels(
      [base],
      [
        { chId: null, n: "R7 TV", u: "https://b/y.m3u8", q: null, cc: null, cat: "other", logo: null, source: "feed" },
        { chId: null, n: "Outro Canal", u: "https://a/x.m3u8", q: null, cc: null, cat: "other", logo: null, source: "feed" },
        { chId: null, n: "Novo Canal", u: "https://c/z.m3u8", q: null, cc: null, cat: "other", logo: null, source: "feed" },
      ],
    );
    expect(merged.map((c) => c.n)).toEqual(["R7 TV", "Novo Canal"]);
    expect(merged.at(-1)?.u).toBe("https://c/z.m3u8");
  });
});

describe("canais grátis dos addons do Kodi", () => {
  it("lê o nome certo mesmo com vírgula dentro dos atributos", () => {
    const parsed = parseM3U(
      '#EXTINF:-1 tvg-name="Filmes, Séries" group-title="Filmes",Pluto Filmes\nhttps://jmp2.uk/plu-5f12136385bccc00070142ed.m3u8\n',
    );
    expect(parsed[0]?.n).toBe("Pluto Filmes");
  });

  it("canais do Pluto TV abrem no site do Pluto TV Brasil", () => {
    expect(externalWatchUrl("https://jmp2.uk/plu-5f12136385bccc00070142ed.m3u8")).toBe(
      "https://pluto.tv/br/live-tv/5f12136385bccc00070142ed",
    );
    expect(externalWatchUrl("https://cdn/r7.m3u8")).toBeNull();
  });

  it("Pluto TV Brasil vem primeiro e marca os canais como do Brasil", () => {
    expect(EXTRA_FEEDS[0]?.name).toBe("Pluto TV Brasil");
    const [ch] = applyFeedMeta(parseM3U("#EXTINF:-1,Canal\nhttps://a/b.m3u8\n"), EXTRA_FEEDS[0]!);
    expect(ch?.cc).toBe("BR");
  });

  it("Free-TV fica fora das listas marcadas como português e traz o país de cada canal", () => {
    const freetv = EXTRA_FEEDS.find((f) => f.name === "Free-TV")!;
    expect(freetv.lang).toBeUndefined();
    const parsed = parseM3U(
      '#EXTINF:-1 tvg-country="BR" group-title="Brazil",Canal BR\nhttps://a/br.m3u8\n#EXTINF:-1 tvg-country="DE" group-title="Germany",Kanal DE\nhttps://a/de.m3u8\n',
    );
    expect(parsed[0]?.cc).toBe("BR");
    expect(parsed[1]?.cc).toBe("DE");
    expect(applyFeedMeta(parsed, freetv).map((c) => c.n)).toEqual(["Canal BR"]);
  });
});

describe("só canais em português", () => {
  it("mantém canais do Brasil e de Portugal", () => {
    expect(isPortugueseChannel("BR", "Globo RJ", "general")).toBe(true);
    expect(isPortugueseChannel("PT", "RTP 1", "general")).toBe(true);
  });

  it("descarta canais de outros países", () => {
    expect(isPortugueseChannel("US", "CNN US", "news")).toBe(false);
    expect(isPortugueseChannel("MX", "Las Estrellas", "general")).toBe(false);
    expect(isPortugueseChannel(null, "Canal 7", "other")).toBe(false);
  });

  it("descarta canal brasileiro que avisa ser em outra língua", () => {
    expect(isPortugueseChannel("BR", "Esportes em Inglês", "esportes")).toBe(false);
    expect(isPortugueseChannel(null, "Documentários em Alemão", "docs")).toBe(false);
  });

  it("guarda canal sem país quando o nome ou a categoria diz que é do Brasil", () => {
    expect(isPortugueseChannel(null, "Canal Brasil Filmes", "filmes")).toBe(true);
    expect(isPortugueseChannel(null, "Programação Portuguesa", "variedades")).toBe(true);
  });

  it("lista marcada como português passa inteira, sem filtro de país", () => {
    const iptvlegal = EXTRA_FEEDS.find((f) => f.name === "IPTV Legal (Meu Tédio)")!;
    expect(iptvlegal.lang).toBe("pt");
    const parsed = parseM3U(
      '#EXTINF:-1 group-title="Cinema",Filme Antigo\nhttps://a/filme.m3u8\n',
    );
    expect(applyFeedMeta(parsed, iptvlegal)).toHaveLength(1);
  });

  it("a lista do cliente (Xtream) não é filtrada por idioma", () => {
    expect(EXTRA_FEEDS.every((f) => f.name !== "Xtream")).toBe(true);
  });
});

describe("prioridade de canais que tocam no site", () => {
  it("troca o link do Pluto TV por uma versão do mesmo canal que toca aqui", () => {
    const pluto: Channel = { ...base, n: "A&E Crime 360", u: "https://jmp2.uk/plu-5f12136385bccc00070142ed.m3u8" };
    const merged = mergeChannels(
      [pluto],
      [{ chId: null, n: "A&E Crime 360", u: "https://tubi/live.m3u8", q: null, cc: "US", cat: "Crime", logo: null, source: "feed" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.u).toBe("https://tubi/live.m3u8");
    expect(merged[0]?.id).toBe(pluto.id);
  });

  it("a lista do Brasil enviada pelo cliente está no player", () => {
    expect(EXTRA_FEEDS.some((f) => f.url.includes("iptv-com/iptv") && f.url.endsWith("brazil.m3u"))).toBe(true);
  });
});
