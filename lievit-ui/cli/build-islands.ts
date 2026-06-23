/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Bundle the CSP-clean island enhancers (the `registry/wire/<name>/<name>.ts` files that ship a
 * client `.ts` alongside their server-first JTE partial) into an ESM `dist/islands/` bundle.
 *
 * WHY a build here: lievit-ui is a copy-in registry (shadcn model), so the islands are normally
 * bundled by the ADOPTER's app build. This target exists so `npm run build` proves the islands are
 * a real, bundleable ESM surface (no broken imports, tree-shakeable, CSP-clean -- esbuild would warn
 * on `eval`), and so CI can smoke that the island sources compile + bundle. The heavy editor engines
 * (TipTap, CodeMirror, marked) are NOT imported by the islands -- they enter through injectable
 * factories / a renderer seam -- so they are marked external and never pulled into this bundle.
 *
 * Run: `npm run build`. Output: `dist/islands/<name>.js`.
 */
import { build } from "esbuild";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const registryWire = join(import.meta.dirname, "..", "registry", "wire");
const outdir = join(import.meta.dirname, "..", "dist", "islands");

/** Collect every `registry/wire/<name>/<name>.ts` island entrypoint. */
function islandEntrypoints(): string[] {
  const entries: string[] = [];
  for (const dirent of readdirSync(registryWire, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const candidate = join(registryWire, dirent.name, `${dirent.name}.ts`);
    if (existsSync(candidate)) {
      entries.push(candidate);
    }
  }
  return entries;
}

async function main(): Promise<void> {
  const entryPoints = islandEntrypoints();
  if (entryPoints.length === 0) {
    process.stdout.write("no island entrypoints found\n");
    return;
  }
  await build({
    entryPoints,
    outdir,
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    splitting: true,
    sourcemap: true,
    // The heavy editor engines + the runtime are external: the islands wrap them via injected
    // factories / a renderer seam (or import the runtime as a peer), so they are never bundled here.
    external: [
      "@tiptap/*",
      "@codemirror/*",
      "codemirror",
      "marked",
      "dompurify",
      "../../../runtime/*",
    ],
    logLevel: "info",
  });
  process.stdout.write(`bundled ${entryPoints.length} islands to ${outdir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    process.stderr.write(`${String(err)}\n`);
    process.exit(1);
  });
}
