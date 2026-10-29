import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PROD BREAKER SURVIVOR",
    short_name: "PROD BREAKER",
    description: "暴走バグと本番環境を連鎖爆破するサバイバーゲーム。",
    start_url: "/",
    display: "standalone",
    background_color: "#080f12",
    theme_color: "#080f12",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
