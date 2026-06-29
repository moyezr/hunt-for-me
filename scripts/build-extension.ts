import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";

const distDir = path.join(process.cwd(), "extension", "dist");
const extensionDir = path.join(process.cwd(), "extension");

function assertPackagedFile(relativePath: string) {
  const filePath = path.join(extensionDir, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing packaged extension file: ${relativePath}`);
  }
}

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

const manifest = JSON.parse(
  fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"),
) as {
  action?: { default_popup?: string };
  content_scripts?: { js?: string[] }[];
};

const packagedFiles = [
  "manifest.json",
  "popup/index.html",
  "dist/content.js",
  "dist/content.js.map",
  "dist/popup.js",
  "dist/popup.js.map",
  "dist/popup.css",
  manifest.action?.default_popup,
  ...(manifest.content_scripts?.flatMap((script) => script.js ?? []) ?? []),
].filter((file): file is string => Boolean(file));

for (const file of packagedFiles) {
  assertPackagedFile(file);
}
