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

## The client runtime (`runtime/`)

Separate from the copy-in registry, `runtime/` is lievit's **browser glue**: the ES-module bundle
that talks the wire protocol (ADR-0019, `../docs/wire-protocol.md` §5/§5b). Zero framework deps,
strict-CSP-safe (no `eval`, no inline handlers, an external module file).

```
runtime/
  wire.ts        # serialize a call, POST /lievit/{id}/call, decode 200 (html + snapshot + effects)
                 #   or a fail-closed failure (status + Lievit-Reason + a re-mount flag for 409/410)
  morph.ts       # bespoke identity-preserving DOM morph (keyed reuse, in-place text/attrs,
                 #   uncontrolled form-state preserved); the morph(root, html) seam
  directives.ts  # the l:* directive registry + built-ins (l:click, l:submit, l:keydown[.key],
                 #   l:model[.live|.lazy|.blur|.debounce.Nms])
  lifecycle.ts   # the lifecycle hook bus (beforeCall/afterCall/onError/onModelChange/onComponentInit)
  runtime.ts     # the orchestrator + startLievit(); owns per-component snapshot + pending updates
  effects.ts     # the Lievit-Effects consumer (redirect / dispatch / returns)
  index.ts       # the public barrel
```

### Wiring it up

```ts
import { startLievit } from "@iambilotta/lievit-ui/runtime";

// Reads each component's initial snapshot from data-lievit-snapshot on its root
// (alongside data-lievit-id and data-lievit-component), binds every l:* directive,
// and runs the call loop. Pass the page's CSRF token so Spring Security validates it.
const lievit = startLievit({
  csrfToken: document.querySelector<HTMLMetaElement>('meta[name="_csrf"]')?.content,
  csrfHeader: document.querySelector<HTMLMetaElement>('meta[name="_csrf_header"]')?.content,
});
```

### Extension API (for later client features)

Two public extension points let batch-2 features (loading/dirty, `wire:navigate`, polling,
`wire:ignore`) plug in **without editing the core bundle**:

```ts
// 1. Register a new l:* directive. The registry IS the API: a built-in directive has no privilege
//    a third-party one lacks.
lievit.directives.register({
  name: "navigate",                                   // makes l:navigate="/path" live app-wide
  bind(el, _attribute, value, rt) {
    el.addEventListener("click", () => rt.callAction(el, value));
  },
});

// 2. Register a lifecycle hook. Every phase is optional; a throwing hook is isolated (fail-soft),
//    so a buggy indicator never breaks interactivity.
const off = lievit.use({
  onComponentInit: ({ root }) => {/* bind one component */},
  onModelChange:   ({ root }, field, value) => {/* dirty tracking */},
  beforeCall:      ({ root, calls, updates }) => root.setAttribute("aria-busy", "true"),
  afterCall:       ({ root, status }) => root.removeAttribute("aria-busy"),
  onError:         ({ status, reason }) => {/* surface fail-closed; 409/410 auto re-mount */},
});
off();                                                // unsubscribe on teardown
```

The `DirectiveRuntime` passed to `bind` exposes `callAction(element, action)` and
`setModel(element, field, value, sendNow)` — the only two things a directive needs to drive the
wire. The runtime owns snapshot rotation, morphing, and effect application.

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
