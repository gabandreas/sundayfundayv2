import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sunday Funday — Personal Finance ERP",
    short_name: "SundayERP",
    description:
      "Personal finance ERP for payroll waterfall allocation, 12-month rolling liability tracking, and daily cash pacing.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0e14",
    theme_color: "#0c0e14",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
