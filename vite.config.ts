import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { defineConfig, type Plugin, type UserConfig } from "vite";

const THEME_SHORT = "Zen";
const localThemeFile = path.resolve(__dirname, "komari-theme.json");
const themeManifest = JSON.parse(
  fs.readFileSync(localThemeFile, "utf-8"),
) as { version?: string };

function localKomariThemePlugin(): Plugin {
  const themeRequestPath = `/themes/${THEME_SHORT}/komari-theme.json`;

  return {
    name: "local-komari-theme",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.endsWith(themeRequestPath)) return next();

        fs.readFile(localThemeFile, (err, data) => {
          if (err) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: "Local theme file not found",
                file: localThemeFile,
              }),
            );
            return;
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(data);
        });
      });
    },
  };
}

function loadDevelopmentEnv() {
  const envPath = path.resolve(process.cwd(), ".env.development");
  if (!fs.existsSync(envPath)) return;

  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const key of Object.keys(envConfig)) {
    process.env[key] = envConfig[key];
  }
}

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_URL ?? "/";

  const config: UserConfig = {
    base,
    define: {
      __THEME_VERSION__: JSON.stringify(themeManifest.version ?? "0.0.0"),
    },
    plugins: [localKomariThemePlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      assetsDir: "assets",
      outDir: "dist",
      rollupOptions: {
        output: {
          chunkFileNames: "assets/chunk-[name]-[hash].js",
          entryFileNames: "assets/entry-[name]-[hash].js",
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };

  if (mode === "development") {
    loadDevelopmentEnv();

    const apiTarget = process.env.VITE_API_TARGET;
    if (!apiTarget) {
      console.warn(
        "[komari-zen] 未设置 VITE_API_TARGET，请复制 .env.example 为 .env.development 并填写远程 Komari 地址。",
      );
    }

    config.server = {
      ...config.server,
      proxy: {
        "/api": {
          target: apiTarget || "http://127.0.0.1:25774",
          changeOrigin: true,
          rewriteWsOrigin: true,
          ws: true,
        },
        "/themes": {
          target: apiTarget || "http://127.0.0.1:25774",
          changeOrigin: true,
        },
      },
    };
  }

  return config;
});
