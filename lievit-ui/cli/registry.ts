/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Registry data model, mirroring shadcn's RegistryItem schema (research 2.1, 4.1).
 *
 * A registry item is the unit `lievit add` resolves and copies. `registryDependencies` are
 * edges to other items by name (the CLI walks them transitively); `files` are the source the
 * CLI copies, each with a `target` relative to the adopter's configured alias root. Only the
 * fields lievit-ui v0.1 actually uses are typed; the shape stays a strict subset of shadcn's
 * so the schema can grow (e.g. a future `cssVars.dark`) without a breaking change.
 */

export type RegistryItemType =
  | "registry:ui"
  | "registry:lib"
  | "registry:tokens";

export interface RegistryFile {
  /** Source path relative to the registry root (e.g. "components/button/button.ts"). */
  path: string;
  type: RegistryItemType;
  /** Destination relative to the adopter's alias root (e.g. "components/ui/button.ts"). */
  target: string;
  /** Inlined file content; present in the built registry.json, absent in authored meta.json. */
  content?: string;
}

export interface RegistryItem {
  name: string;
  type: RegistryItemType;
  description: string;
  /** npm packages the component needs (e.g. ["lit"]). */
  dependencies: string[];
  /** other registry items, by name, this one needs. */
  registryDependencies: string[];
  files: RegistryFile[];
  /** token groups the component references (documentation only at v0.1). */
  tokens: string[];
  /** post-copy instruction printed to the adopter. */
  docs: string;
}

export interface Registry {
  $schema?: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

/**
 * Resolve a set of requested names against a registry, returning the transitive closure of
 * items (the requested ones plus everything reachable via `registryDependencies`),
 * topologically ordered so a dependency is always emitted before the item that needs it.
 *
 * Throws on an unknown name (a dangling `registryDependencies` edge is a registry defect, not
 * an adopter error, so it must fail loudly). Cycle-safe: a name already being resolved is not
 * re-entered.
 *
 * @param registry the consolidated registry
 * @param names    the component names requested on the command line
 * @returns the ordered list of items to copy
 */
export function resolve(registry: Registry, names: string[]): RegistryItem[] {
  const byName = new Map(registry.items.map((item) => [item.name, item]));
  const ordered: RegistryItem[] = [];
  const done = new Set<string>();
  const inProgress = new Set<string>();

  const visit = (name: string): void => {
    if (done.has(name) || inProgress.has(name)) {
      return;
    }
    const item = byName.get(name);
    if (item === undefined) {
      throw new Error(`unknown registry item: ${name}`);
    }
    inProgress.add(name);
    for (const dep of item.registryDependencies) {
      visit(dep);
    }
    inProgress.delete(name);
    done.add(name);
    ordered.push(item);
  };

  for (const name of names) {
    visit(name);
  }
  return ordered;
}

/** Collect the union of npm dependencies across a set of items, sorted and de-duplicated. */
export function collectNpmDependencies(items: RegistryItem[]): string[] {
  const deps = new Set<string>();
  for (const item of items) {
    for (const dep of item.dependencies) {
      deps.add(dep);
    }
  }
  return [...deps].sort();
}
