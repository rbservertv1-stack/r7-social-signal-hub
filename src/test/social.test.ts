import { describe, expect, it } from "vitest";
import { SOCIAL_NETWORKS, whatsappUrl } from "@/lib/social";

describe("R7 social links", () => {
  it("WhatsApp opens the R7 number (51) 99413-7651", () => {
    expect(whatsappUrl("Oi")).toBe("https://wa.me/5551994137651?text=Oi");
  });
  it("offers buttons for all major networks", () => {
    expect(SOCIAL_NETWORKS.map((n) => n.id)).toEqual(
      expect.arrayContaining(["whatsapp", "instagram", "facebook", "tiktok", "youtube", "x", "telegram", "linkedin"]),
    );
  });
});
