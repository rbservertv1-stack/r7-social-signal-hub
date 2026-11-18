import { cn } from "@/lib/utils";
import { SOCIAL_NETWORKS, type SocialNetwork } from "@/lib/social";

function linkProps(n: SocialNetwork) {
  return n.url
    ? { href: n.url, target: "_blank", rel: "noopener noreferrer" }
    : { href: "#redes", title: `${n.name} em breve` };
}

/** Compact round icon buttons (header, footer, floating dock). */
export function SocialIconRow({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {SOCIAL_NETWORKS.map((n) => (
        <a
          key={n.id}
          {...linkProps(n)}
          aria-label={n.name}
          className={cn(
            "social-btn grid place-items-center rounded-xl",
            `social-${n.id}`,
            size === "sm" ? "size-9" : "size-11",
          )}
        >
          <n.icon className={cn("social-icon", size === "sm" ? "size-4" : "size-5")} />
        </a>
      ))}
    </div>
  );
}

/** Large cards with name + handle for the "Siga a R7" section. */
export function SocialCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SOCIAL_NETWORKS.map((n) => (
        <a
          key={n.id}
          {...linkProps(n)}
          className={cn("social-btn group flex items-center gap-3 rounded-2xl p-4", `social-${n.id}`)}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-deep/60">
            <n.icon className="social-icon size-6" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold tracking-wide">{n.name}</span>
            <span className="block truncate text-xs opacity-75">{n.url ? n.handle : "Em breve"}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
