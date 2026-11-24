import type { IconType } from "react-icons";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebookF,
  FaTiktok,
  FaYoutube,
  FaXTwitter,
  FaTelegram,
  FaLinkedinIn,
} from "react-icons/fa6";

export const WHATSAPP_NUMBER = "5551994137651";
export const WHATSAPP_DISPLAY = "(51) 99413-7651";
export const whatsappUrl = (text = "Olá, vim pelo site da R7 Informática") =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

export type SocialNetwork = {
  id: "whatsapp" | "instagram" | "facebook" | "tiktok" | "youtube" | "x" | "telegram" | "linkedin";
  name: string;
  handle: string;
  /** Empty string = link not provided yet. */
  url: string;
  icon: IconType;
};

// Fill `url` (and `handle`) as soon as the R7 profiles are known.
export const SOCIAL_NETWORKS: SocialNetwork[] = [
  { id: "whatsapp", name: "WhatsApp", handle: WHATSAPP_DISPLAY, url: whatsappUrl(), icon: FaWhatsapp },
  { id: "instagram", name: "Instagram", handle: "@r7informatica", url: "https://www.instagram.com/r7informaticasolucoes2026/", icon: FaInstagram },
  { id: "facebook", name: "Facebook", handle: "R7 Informática", url: "https://www.facebook.com/professional_dashboard/?ref=bookmark", icon: FaFacebookF },
  { id: "tiktok", name: "TikTok", handle: "@r7informatica", url: "https://www.tiktok.com/@r7informatica.solucoes", icon: FaTiktok },
  { id: "youtube", name: "YouTube", handle: "R7 Informática", url: "https://www.youtube.com/@r7informaticasolucoes", icon: FaYoutube },
  { id: "x", name: "X / Twitter", handle: "@r7informatica", url: "@R7INFOTECSOL", icon: FaXTwitter },
  { id: "telegram", name: "Telegram", handle: "R7 Informática", url: "https://t.me/+55519941377651", icon: FaTelegram },
  { id: "linkedin", name: "LinkedIn", handle: "R7 Informática", url: "", icon: FaLinkedinIn },
];
