import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Money Autopilot",
    short_name: "Autopilot",
    description:
      "Every rupee, on autopilot — SMS-powered expense tracking, mutual funds, and savings goals.",
    start_url: "/",
    display: "standalone",
    background_color: "#fcfcfb",
    theme_color: "#0e5f58",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
