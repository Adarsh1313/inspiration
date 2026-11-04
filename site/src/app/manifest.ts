import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "inspiration",
    short_name: "inspiration",
    description: "Private hub.",
    start_url: "/notepad",
    scope: "/",
    display: "standalone",
    background_color: "#fcfcfc",
    theme_color: "#fcfcfc",
    icons: [
      { src: "/pwa-icon/192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
