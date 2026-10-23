import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: appRoot,
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.app.json"] }),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: [
        "favicon.svg",
        "favicon-64x64.png",
        "apple-touch-icon.png",
        "logo.jpg",
        "mesa.svg",
      ],
      manifest: {
        name: "En que la Negra - Sistema POS",
        short_name: "La Negra POS",
        description: "Sistema POS y Punto de Venta para En que la Negra",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
});
