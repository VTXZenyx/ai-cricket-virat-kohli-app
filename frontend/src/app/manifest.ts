import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Virat Kohli — Fan-made Mentor",
    short_name: "AI Virat Kohli",
    description: "Fan-made AI cricket, mindset and motivation mentor prototype.",
    start_url: "/",
    display: "standalone",
    background_color: "#050b18",
    theme_color: "#1468ff",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
