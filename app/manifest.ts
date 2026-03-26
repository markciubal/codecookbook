import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CodeCookbook – Algorithm Visualizer",
    short_name: "CodeCookbook",
    description:
      "Interactive step-by-step visualizations of algorithms and data structures",
    start_url: "/",
    display: "standalone",
    background_color: "#0f0e17",
    theme_color: "#7c6af7",
    orientation: "portrait-primary",
    categories: ["education", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/icon.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
