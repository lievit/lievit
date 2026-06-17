<!--
Copyright 2026 Francesco Bilotta
Licensed under the Apache License, Version 2.0 (the "License").
-->

# lievit-ui

The lievit UI layer: a **copy-in component registry** of owned-source Lit primitives and
design tokens, on the shadcn/ui model. It is **not** a Maven artifact and **not** a runtime
dependency (ADR-0008, ADR-0009); it is the source the `lievit add <component>` command copies
**into your repository**, where you own and edit it. See `../docs/lievit-ui.md` for the full
specification and `../docs/adr/0009-lievit-ui-copy-in-registry.md` for the decision.

## Layout

```
lievit-ui/
  registry/
    registry.json              # consolidated manifest the CLI resolves against (generated)
    tokens/
      lievit-tokens.css         # the --lv-* design tokens (the design vocabulary)
      meta.json
    components/
      light-dom/light-dom.ts    # shared light-DOM styling helper (a registry dependency)
      button/  { button.ts,  meta.json }
      input/   { input.ts,   meta.json }
      textarea/, label/, badge/, card/, separator/, spinner/, alert/
  cli/
    registry.ts                 # the registry data model + transitive resolver
    add.ts                      # the pure `add` planner (no disk effects)
    lievit-add.ts               # the thin effectful CLI entry
    build-registry.ts           # consolidates meta.json -> registry.json
  test/                         # vitest: resolver, planner, golden add, components, tokens
```

Each component is a directory with the Lit source plus a `meta.json` (its files,
`registryDependencies`, npm `dependencies`, and post-copy `docs`). `registry.json` is the
single manifest derived from those (`npm run build:registry`); CI checks it for drift.

## The tokens

Tokens are plain CSS custom properties under the `--lv-*` namespace (the namespace is
load-bearing: lievit-ui co-exists with the adopter's CSS and Tailwind). Components reference
tokens by name, never a hardcoded value, so a retheme is overriding a variable in `:root`, not
editing a component. v0.1 ships a single `:root` swatch (no dark mode); the structure leaves
room for a future `prefers-color-scheme: dark` block. See `registry/tokens/lievit-tokens.css`.

## Tier-1 components (v0.1)

`button`, `input`, `textarea`, `label`, `badge`, `card`, `separator`, `spinner`, `alert`.

These are the gestionale primitives with no ARIA complexity (research §4.5). Each renders into
the **light DOM** (no shadow root walling off your CSS) so tokens and adopter styles cascade in
freely and an AI copilot can edit them. A11y follows the WAI-ARIA Authoring Practices Guide
inline (native `<button>`/`<label>`, `aria-invalid`, `role="separator|status|region|alert"`),
with no React-only library.

## The add flow

```bash
lievit add button                 # copies tokens + light-dom + button into your project
lievit add button input --dry-run # preview the plan without writing
lievit add button --root web      # alias root override (default: "src", or lievit.json)
lievit add button --overwrite     # replace an owned file (default: skip to protect edits)
```

`lievit add button` resolves the closure (`button` needs `tokens` and `light-dom`), copies each
file to its target under the alias root (`src/components/ui/`, `src/styles/`), reports the npm
deps you must install (`lit`), and prints each component's post-copy note. Re-running skips
files you already own unless you pass `--overwrite` (the shadcn trade: you own the upgrade).

The destination root comes from `lievit.json` (`{ "root": "src" }`) if present, else `src`, and
can be overridden with `--root`.

## Develop

```bash
npm install
npm run build:registry   # regenerate registry.json from the meta.json files
npm run check:registry   # CI gate: fail on drift
npm run typecheck        # tsc --noEmit
npm test                 # vitest (resolver, planner, golden add, components, tokens)
```
