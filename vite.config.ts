import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// Tag every build with the deploy SHA so Sentry releases register and we can
// correlate errors to a specific deploy. Vercel auto-injects
// VERCEL_GIT_COMMIT_SHA on every build; locally we fall back to git, then to
// "dev" so the build never fails on a missing git binary.
function resolveAppVersion(): string {
  if (process.env.VITE_APP_VERSION) return process.env.VITE_APP_VERSION;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}
process.env.VITE_APP_VERSION = resolveAppVersion();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "injectManifest" lets us write our own service worker so we can add
      // Supabase-specific cache rules. "generateSW" would work too but gives
      // less control over what gets cached.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // Point to the existing manifest -- vite-plugin-pwa will not overwrite it.
      manifest: false,

      // Register the service worker automatically on every page load.
      registerType: "autoUpdate",
      // Suppress the auto-injected <script src="/registerSW.js"> tag — it 404s
      // under injectManifest strategy (registerSW.js isn't emitted). main.tsx
      // explicitly calls navigator.serviceWorker.register("/sw.js") on load,
      // which covers the registration path.
      injectRegister: false,

      injectManifest: {
        // Only precache compiled JS/CSS/HTML -- never trade data or screenshots.
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,woff2}"],
        // Exclude large or frequently-changing assets from the precache so the
        // install payload stays small.
        globIgnores: ["**/node_modules/**", "icon-maskable.svg"],
        // Bump this whenever you want to force a full cache refresh on users.
        injectionPoint: "self.__WB_MANIFEST",
      },

      devOptions: {
        // Show the service worker in dev mode so you can test offline behaviour
        // with Vite dev server. Set to false if it causes confusion.
        enabled: true,
        type: "module",
      },
    }),
  ],
  test: {
    // Only pick up *.test.ts files inside src/ and api/ — exclude Playwright tests in tests/
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "api/**/*.test.ts"],
    exclude: ["tests/**", "node_modules/**"],
    environment: "jsdom",
    setupFiles: ["@testing-library/jest-dom/vitest", "src/test-setup.ts"],
    // Single-fork prevents the Windows UNKNOWN spawn error when many test files run in parallel.
    pool: "forks",
    forks: { singleFork: true },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@supabase") || id.includes("node_modules/ws") || id.includes("node_modules/isows")) {
            return "vendor-supabase";
          }
        },
      },
    },
  },
});
