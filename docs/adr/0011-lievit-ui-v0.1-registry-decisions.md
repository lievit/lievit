# ADR-0011: lievit-ui v0.1 registry decisions

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

ADR-0009 locked the copy-in model and `docs/lievit-ui.md` specified the shape, but the research
(`docs/research/tailwind-ui-shadcn-model.md` §5) left a handful of v0.1 questions open that the
first implementation of `lievit-ui/` had to answer to proceed. This ADR records the minimal,
reasonable choices made; each is reversible and none commits the project beyond v0.1.

## Decision

- **Single consolidated `registry.json`, derived from per-component `meta.json`** (research §4.1).
  Each component directory keeps an authored `meta.json`; `npm run build:registry` consolidates
  them into one root `registry.json` (inlining file content) that the CLI resolves against, the
  shadcn single-manifest model. A CI drift gate (`npm run check:registry`) keeps the generated
  manifest in lockstep with the sources. This keeps the resolver simple while preserving
  per-component authoring.
- **`lievit.json` for the adopter config** (research §5.5). JSON over TOML: it matches shadcn's
  `components.json`, needs no extra parser, and the adopter config is trivial (`{ "root": "src" }`).
  TOML can be revisited if the config grows.
- **Single `:root` token swatch, no dark mode, structure reserved** (research §5.2). v0.1 ships one
  `:root` block; the schema and CSS leave room for a future `prefers-color-scheme: dark` block and a
  `cssVars.dark` field without a breaking change. Gestionale adopters rarely need dark mode now.
- **Light-DOM styling via a shared `adoptLightStyles` helper** (`light-dom` registry item). Lit's
  `static styles` only applies inside a shadow root, so light-DOM components cannot use it. The
  helper adopts each component's base stylesheet once per document (Constructable Stylesheets, with
  a `<style>` fallback). It is a `registry:lib` dependency every component declares, so it is never
  an orphan. Rules are authored against `.lv-*` classes and `--lv-*` tokens, never hardcoded values.
- **`lit` as the one shipped npm dependency** (research §5.3). Tier-1 needs no floating/positioning,
  so `@floating-ui/dom` is deferred to the first floating component (tooltip/popover, tier 2/3). Each
  component's `meta.json` lists its own npm deps so the CLI can report them.
- **Registry hosting deferred; local resolution for v0.1** (research §5.4). The CLI resolves against
  the in-repo `registry.json`. A hosted `https://registry.lievit.dev/r/{name}.json` endpoint and a
  `registries` URL map are a later addition, not a v0.1 blocker.

## Consequences

- The adopter gets a working `lievit add <component>` against the in-repo registry today, with a
  drift-gated manifest and an owned-edit-safe copy (skip-unless-`--overwrite`).
- Dark mode, remote hosting, TOML config, and floating-surface a11y are all additive later; none of
  these choices paints the schema into a corner.
- The light-DOM helper is one extra file every component pulls in. Accepted: it is the concrete
  mechanism behind ADR-0009's "no restyling fight" and keeps each component free of inlined,
  shadow-only styling.

## Alternatives considered

**Per-component `meta.json` as the resolver input (no consolidated manifest).** Simpler to author but
forces the CLI to walk the tree and fetch many files; the research recommended consolidating. The
chosen hybrid keeps both: authored `meta.json`, generated single manifest.

**TOML config (`lievit.toml`).** Familiar in the Java world, but adds a parser dependency for a
two-line config and diverges from shadcn's `components.json`. Not worth it at v0.1.

**Shadow-DOM components with `static styles`.** The idiomatic Lit path, but the shadow root walls off
adopter CSS and AI edits, which is exactly what ADR-0005/0009 reject. Light DOM plus the helper is the
deliberate trade.

## Cross-references

- ADR-0009 — the copy-in registry decision this implements.
- ADR-0005 — zero-CSS default; light-DOM + tokens is its mechanism.
- `docs/lievit-ui.md` — the registry shape this builds.
- `docs/research/tailwind-ui-shadcn-model.md` §5 — the open questions answered here.
