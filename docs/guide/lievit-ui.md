# The lievit-ui registry

`lievit-ui` is lievit's UI component layer, and it is **not** a Maven dependency. It is a **copy-in
registry** of owned source on the shadcn/ui model: `lievit add button` copies the button's source
(its Lit component plus the design tokens it needs) into your repository, and from that moment the
file is yours to edit. [ADR-0009](../adr/0009-lievit-ui-copy-in-registry.md) records the decision;
[ADR-0011](../adr/0011-lievit-ui-v0.1-registry-decisions.md) the registry shape; the full spec is
[`docs/lievit-ui.md`](../lievit-ui.md).

## The model in one paragraph

You do not depend on lievit-ui; you **own** it. There is no encapsulated dependency to fight and no
shadow DOM to pierce, which is what makes the components agentic-native and consistent with lievit's
zero-CSS, adopter-owns-the-look stance ([ADR-0005](../adr/0005-theming-zero-css-default.md)). The
trade is that upgrades are not automatic: a registry improvement arrives by re-running `lievit add`
(with a diff), not a version bump.

## Two orthogonal halves

`lievit-ui/` sits at the repo root and holds two separate things:

| Half | What | Relationship |
|---|---|---|
| `registry/` | The **copy-in components** (Lit, light-DOM) the CLI copies into your app. | Presentation; you own it. |
| `runtime/` | The **client wire bundle** (ES modules) that drives the protocol. | Interactivity; a dependency-free bundle. |

They are orthogonal: the runtime owns interactivity, the components own presentation, and a component
has no runtime dependency. The runtime bundle is `wire.ts` (serialize/POST/decode), `morph.ts` (the
bespoke DOM morph), `directives.ts` + `v4-directives.ts` (the `l:*` registry), `lifecycle.ts` (the
hook bus), `effects.ts` / `events.ts` / `islands.ts` / `interceptors.ts`, and `runtime.ts` (the
loop). See [ADR-0019](../adr/0019-client-runtime-bundle.md).

## The component palette (shipped)

The registry ships 28 components as owned, light-DOM Lit source:

```
accordion  alert  badge  breadcrumb  button  card  checkbox  data-table
date-picker  dialog  drawer  dropdown-menu  field  file-upload  input  label
light-dom  progress  radio-group  rich-select  select  separator  slider
spinner  switch  tabs  textarea  toast  tooltip
```

Each component is a Lit element that renders into the **light DOM** (`createRenderRoot() { return
this; }`), so the adopter's CSS and the design tokens cascade in freely:

```ts
// the shape of a registry component (light-DOM Lit)
@customElement("lv-button")
export class LvButton extends LitElement {
  @property() variant = "primary";
  createRenderRoot() { return this; }   // light DOM: no shadow root to pierce
  // ...
}
```

## Design tokens

Components style themselves with CSS custom properties (`--lv-color-primary`, `--lv-space-4`,
`--lv-radius-md`, `--lv-text-base`, ...). Retheming is overriding a token variable, not fighting a
component's internals. `lievit add` copies the `tokens` group a component depends on alongside it.

## The registry manifest

`registry/registry.json` is the consolidated manifest. Each item declares its `name`, its npm
`dependencies` (e.g. `["lit"]`), its `registryDependencies` (e.g. `["tokens", "light-dom"]`), and its
`files[]` with the source `content` and the `target` path in the adopter's project. `lievit add`
reads this to copy the right files plus their token and helper dependencies.

## The brand-visible runtime elements

The wire runtime exposes brand-visible behavior through the `l:*` directives and the effects channel
rather than separate custom elements: `l:loading` (disable controls during a call), `l:error` /
`l:errors` (render validation), and the reserved `stream` effect (roadmap). These are behaviors
applied to your existing DOM, not components you instantiate.

## Status note

The components and the client runtime are in the build today (the registry holds 28 components; the
runtime bundle is complete and tested). The `lievit add` CLI command that copies a component into an
adopter project is the thin installer layer; the spec doc
[`docs/lievit-ui.md`](../lievit-ui.md) still describes the registry as spec-first and predates the
shipped source, so trust the registry contents over that doc's status line.
