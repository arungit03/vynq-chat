import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vynq-chat",
    short_name: "Vynq",
    description: "Private conversations that do not stay forever.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    lang: "en",
    dir: "ltr",
    background_color: "#f4f8fc",
    theme_color: "#5c8df6",
    orientation: "any",
    categories: ["social", "communication"],
    icons: [
      {
        src: "/icons/vynq-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/vynq-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
