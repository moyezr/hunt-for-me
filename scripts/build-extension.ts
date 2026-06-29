import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const distDir = path.join(process.cwd(), "extension", "dist");

fs.rmSync(distDir, { force: true, recursive: true });
fs.mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: {
    content: "extension/content/index.ts",
    popup: "extension/popup/popup.ts",
  },
  bundle: true,
  outdir: distDir,
  entryNames: "[name]",
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
