import { describe, expect, it } from "vitest";
import { type Channel, mergeChannels, parseM3U } from "@/lib/iptv";

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
