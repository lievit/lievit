/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { resolve, collectNpmDependencies, type Registry } from "./registry.js";

/**
 * The `lievit add <component>` core: plan and apply a copy-in.
 *
 * Mirrors shadcn's add flow (research 2.2): resolve the name against the registry, follow
 * transitive registryDependencies, then for each file resolve a destination under the
 * adopter's alias root and write the content. Tokens are copied first-run-only; an existing
 * destination is reported as a `skip` unless `overwrite` is set (the shadcn trade: the
 * adopter owns edits, so re-running offers a diff rather than clobbering, ADR-0009).
 *
 * The planning (`planAdd`) is a pure function over a virtual filesystem snapshot, so it is
 * unit-testable without touching disk and the same plan drives `--dry-run`. `applyAdd` is the
 * thin effectful wrapper that actually writes.
 */

export interface AddConfig {
  /** alias root for component files, e.g. "src" so a target "components/ui/x.ts" lands at "src/components/ui/x.ts". */
  root: string;
}

export type AddActionKind = "copy" | "skip" | "overwrite";

export interface AddAction {
  kind: AddActionKind;
  /** destination path relative to the project root. */
  dest: string;
  content: string;
  /** the registry item this file came from. */
  item: string;
}

export interface AddPlan {
  actions: AddAction[];
  /** npm packages the adopter must install for the copied components. */
  npmDependencies: string[];
  /** post-copy instructions, one per resolved item that declares docs. */
  docs: string[];
}

/** Join an alias root with a target path using forward slashes (registry paths are POSIX). */
function joinDest(root: string, target: string): string {
  const left = root.replace(/\/+$/, "");
  return left.length === 0 ? target : `${left}/${target}`;
}

/**
 * Plan an `add` without touching disk.
 *
 * @param registry the consolidated registry
 * @param names    requested component names
 * @param config   alias root
 * @param existing set of destination paths that already exist in the project
 * @param overwrite when true, an existing destination is an `overwrite`, else a `skip`
 * @returns the ordered plan (dependencies before dependents), npm deps, and docs
 */
export function planAdd(
  registry: Registry,
  names: string[],
  config: AddConfig,
  existing: ReadonlySet<string>,
  overwrite = false
): AddPlan {
  const items = resolve(registry, names);
  const actions: AddAction[] = [];

  for (const item of items) {
    for (const file of item.files) {
      const dest = joinDest(config.root, file.target);
      const content = file.content ?? "";
      let kind: AddActionKind;
      if (existing.has(dest)) {
        kind = overwrite ? "overwrite" : "skip";
      } else {
        kind = "copy";
      }
      actions.push({ kind, dest, content, item: item.name });
    }
  }

  return {
    actions,
    npmDependencies: collectNpmDependencies(items),
    docs: items.filter((i) => i.docs.length > 0).map((i) => `${i.name}: ${i.docs}`),
  };
}
