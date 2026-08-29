import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  online?: boolean;
  className?: string;
  ring?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic pastel from name for fallback. Light-blue friendly.
function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ src, name, size = 44, online, className = "", ring }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;
  const hue = hueFromName(name || "user");
  const bg = `hsl(${hue} 70% 92%)`;
  const fg = `hsl(${hue} 60% 35%)`;

  return (
    <div className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold ${ring ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-white" : ""}`}
        style={{ background: bg, color: fg, fontSize: size * 0.4 }}
      >
        {showImg ? (
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setErrored(true)}
            loading="lazy"
          />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full border-2 ${online ? "border-success bg-success" : "border-ink-muted bg-white"}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
          aria-label={online ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
