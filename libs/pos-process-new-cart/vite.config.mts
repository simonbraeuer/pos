import { defineConfig } from "vite";
import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin";

export default defineConfig({
  root: __dirname,
  cacheDir: "../../node_modules/.vite/libs/pos-process-new-cart",
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    reporters: ["default"],
    coverage: {
      reportsDirectory: "../../coverage/libs/pos-process-new-cart",
      provider: "v8",
    },
  },
});
