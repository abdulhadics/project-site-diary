import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Site Diary",
    short_name: "Site Diary",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#f5f2ec",
    background_color: "#f5f2ec",
    icons: [
      { src: "/icons/diary-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/diary-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
