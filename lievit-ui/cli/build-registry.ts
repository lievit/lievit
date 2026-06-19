/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Registry, RegistryItem } from "./registry.js";

/**
 * Build the consolidated `registry.json` from the authored per-item `meta.json` files,
 * inlining each file's content. This is the manifest the CLI resolves against (shadcn's
 * single-registry model, research 4.1): one file the resolver reads, derived from the
 * per-component sources so they never drift. Re-run via `npm run build:registry`; the CI
 * `--check` mode fails on drift, keeping the committed registry.json honest.
 */

// tokens/ + icons/ are single-item dirs (one meta.json at the top); components/, jte/ + wire/
// each hold many item subdirs. The server-first tiers (ADR-0012): jte/ partials register as
// `registry:jte` items via a jte/<name>/meta.json subdir (the flat jte/*.jte authoring files
// stay untouched and are referenced by `path`); wire/ holds `registry:wire` components, each a
// Java class + its JTE template + meta.json. Subdir scanning is directory-only, so the flat
// jte/*.jte files (no meta.json) are simply not items, exactly as before.
const ITEM_DIRS = ["tokens", "icons", "components", "jte", "wire"] as const;
const SINGLE_ITEM_DIRS = new Set(["tokens", "icons"]);

/** Walk the registry tree and load every `meta.json`, inlining its files' content. */
export function buildRegistry(registryRoot: string): Registry {
  const items: RegistryItem[] = [];

  for (const top of ITEM_DIRS) {
    const topDir = join(registryRoot, top);
    if (!existsSync(topDir)) {
      continue;
    }
    const candidateDirs = SINGLE_ITEM_DIRS.has(top)
      ? [topDir]
      : readdirSync(topDir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => join(topDir, e.name));

    for (const dir of candidateDirs) {
      const metaPath = join(dir, "meta.json");
      if (!existsSync(metaPath)) {
        continue;
      }
      const item = JSON.parse(readFileSync(metaPath, "utf8")) as RegistryItem;
      item.files = item.files.map((f) => ({
        ...f,
        content: readFileSync(join(registryRoot, f.path), "utf8"),
      }));
      items.push(item);
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));
  return {
    $schema: "https://lievit.dev/registry-schema.json",
    name: "lievit-ui",
    homepage: "https://github.com/lievit/lievit",
    items,
  };
}

/** Serialize a registry to deterministic JSON (sorted, trailing newline) for stable diffs. */
export function serializeRegistry(registry: Registry): string {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

// CLI entry: `build-registry [--check]`. Writes registry.json or, with --check, exits 2 on drift.
function main(argv: string[]): void {
  const registryRoot = join(import.meta.dirname, "..", "registry");
  const outPath = join(registryRoot, "registry.json");
  const built = serializeRegistry(buildRegistry(registryRoot));

  if (argv.includes("--check")) {
    const current = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
    if (current !== built) {
      process.stderr.write(
        "registry.json is out of date. Run `npm run build:registry` and commit.\n"
      );
      process.exit(2);
    }
    process.stdout.write("registry.json is up to date.\n");
    return;
  }

  writeFileSync(outPath, built);
  process.stdout.write(`wrote ${outPath}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
