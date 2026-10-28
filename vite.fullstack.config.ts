import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config";

// Same-origin proxy preserves the production CSP; both listeners bind loopback.
export default mergeConfig(base, defineConfig({
  preview: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:5188" },
  },
}));
