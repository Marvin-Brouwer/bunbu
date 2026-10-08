import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import pkg from "./package.json" with { type: "json" };

// Keep dependencies (and their subpaths, such as ajv/dist/2020) out of the bundle.
const dependencies = Object.keys(pkg.dependencies);

export default defineConfig({
  input: "src/index.ts",
  external: (id) => dependencies.some((name) => id === name || id.startsWith(`${name}/`)),
  output: {
    dir: "dist",
    format: "esm",
  },
  plugins: [dts()],
});
