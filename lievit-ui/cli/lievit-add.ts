/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { planAdd, type AddConfig, type AddPlan } from "./add.js";
import type { Registry } from "./registry.js";

/**
 * `lievit add <component...>`: the thin effectful CLI wrapper around the pure `planAdd`.
 *
 * Loads the consolidated registry.json, reads the alias root from `lievit.json` if present
 * (else defaults to `src`), plans against the real filesystem (which destinations already
 * exist), and either prints the plan (`--dry-run`) or writes the files. Owned-edit safety:
 * an existing file is skipped unless `--overwrite` is passed (ADR-0009).
 *
 * This file is the deterministic glue; the resolver and planner it delegates to are unit
 * tested. Usage:
 *   lievit-add button input --dry-run
 *   lievit-add button --root src --overwrite
 */

interface Cli {
  names: string[];
  dryRun: boolean;
  overwrite: boolean;
  root?: string;
}

export function parseArgs(argv: string[]): Cli {
  const names: string[] = [];
  let dryRun = false;
  let overwrite = false;
  let root: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "--diff") {
      dryRun = true;
    } else if (arg === "--overwrite") {
      overwrite = true;
    } else if (arg === "--root") {
      root = argv[++i];
    } else if (!arg.startsWith("--")) {
      names.push(arg);
    }
  }
  return { names, dryRun, overwrite, root };
}

function loadConfig(cwd: string, override?: string): AddConfig {
  if (override !== undefined) {
    return { root: override };
  }
  const configPath = join(cwd, "lievit.json");
  if (existsSync(configPath)) {
    // `roots.{java,jte}` are the ADR-0012 server-first two-root extension; absent = the defaults
    // (`src/main/java`, `src/main/jte`), so a presentation-only lievit.json keeps working.
    const cfg = JSON.parse(readFileSync(configPath, "utf8")) as {
      root?: string;
      roots?: { java?: string; jte?: string };
    };
    return {
      root: cfg.root ?? "src",
      javaRoot: cfg.roots?.java,
      jteRoot: cfg.roots?.jte,
    };
  }
  return { root: "src" };
}

function formatPlan(plan: AddPlan): string {
  const lines = plan.actions.map((a) => {
    const verb =
      a.kind === "copy" ? "copy " : a.kind === "overwrite" ? "over " : "skip ";
    return `  ${verb} -> ${a.dest}`;
  });
  if (plan.npmDependencies.length > 0) {
    lines.push(`  npm  -> ${plan.npmDependencies.join(", ")}`);
  }
  return lines.join("\n");
}

export function run(
  argv: string[],
  registry: Registry,
  cwd: string,
  out: (s: string) => void
): number {
  const cli = parseArgs(argv);
  if (cli.names.length === 0) {
    out("usage: lievit add <component...> [--dry-run] [--overwrite] [--root DIR]\n");
    return 1;
  }

  const config = loadConfig(cwd, cli.root);
  const existing = new Set<string>();
  // probe which destinations already exist so the plan reflects reality
  const probe = planAdd(registry, cli.names, config, new Set(), cli.overwrite);
  for (const action of probe.actions) {
    if (existsSync(join(cwd, action.dest))) {
      existing.add(action.dest);
    }
  }

  const plan = planAdd(registry, cli.names, config, existing, cli.overwrite);
  out(`resolving ${cli.names.join(", ")}\n`);
  out(`${formatPlan(plan)}\n`);

  if (cli.dryRun) {
    out("dry run: no files written.\n");
    return 0;
  }

  for (const action of plan.actions) {
    if (action.kind === "skip") {
      continue;
    }
    const abs = join(cwd, action.dest);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, action.content);
  }
  for (const line of plan.docs) {
    out(`note: ${line}\n`);
  }
  out("done. the copied source is yours: edit it freely.\n");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const registryPath = join(import.meta.dirname, "..", "registry", "registry.json");
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Registry;
  const code = run(process.argv.slice(2), registry, process.cwd(), (s) =>
    process.stdout.write(s)
  );
  process.exit(code);
}
