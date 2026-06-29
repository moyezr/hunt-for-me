import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const distDir = path.join(process.cwd(), "extension", "dist");
fs.mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: ["extension/content/index.ts", "extension/popup/popup.ts"],
  bundle: true,
  outdir: distDir,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  alias: {
    "@": process.cwd(),
  },
});

fs.copyFileSync(
  path.join(process.cwd(), "extension", "popup", "popup.css"),
  path.join(distDir, "popup.css"),
);
