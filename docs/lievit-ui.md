# lievit-ui: the copy-in component registry

`lievit-ui` is lievit's UI component layer. It is **not** a Maven dependency and **not** one of the
seven artifacts (ADR-0008); it is a **copy-in registry** of owned source, distributed by the CLI
(`lievit add <component>`), on the shadcn/ui model. ADR-0009 records the decision and the rationale;
this document specifies the *shape*: the registry layout, the design-token system, and the source
shape of a couple of example primitives.

Status: implemented. The registry and the `lievit add` command have shipped (the `lievit-ui`
module carries the components, the client runtime, and their test suite); this document specifies
the shape that registry follows.

## The model in one paragraph

You do not depend on lievit-ui; you **own** it. `lievit add button` copies the button's source (its
Lit component plus any design tokens it needs) into your repository. From that moment the file is
yours: edit the markup, retune the styling, let your AI copilot refactor it freely. There is no
encapsulated dependency to fight and no shadow DOM to pierce, which is exactly what makes the
components agentic-native and consistent with lievit's zero-CSS, adopter-owns-the-look stance
(ADR-0005). The trade is that upgrades are not automatic: a registry improvement arrives by
re-running `lievit add` (with a diff), not by a version bump.

## Registry layout (the source the CLI copies *from*)

`lievit-ui/` sits at the **monorepo root** (a sibling of the Maven artifacts, never under `apps/`,
never an `src/main/java` module). It is organized as a registry the CLI reads:

```
lievit-ui/
  registry.json                 # the manifest: every component, its files, its dependencies
  tokens/
    tokens.css                  # the design tokens as CSS custom properties (the token contract)
    tokens.ts                   # the same tokens typed for TS consumers (optional, generated)
  components/
    button/
      meta.json                 # { name, description, files[], dependsOn[], tokens[] }
      button.ts                 # the Lit component source (what gets copied in)
    input/
      meta.json
      input.ts
    table/
      meta.json
      table.ts
    modal/
      meta.json
      modal.ts
    tabs/
      meta.json
      tabs.ts
  README.md
```

- **`registry.json`** is the top-level manifest the CLI resolves against: it lists every available
  component, the files each one ships, and its dependency edges (a component may depend on another
  component and on a set of tokens). `lievit add table` reads this to copy the table plus anything it
  transitively needs.
- **Each `components/<name>/meta.json`** declares the component's own files, its `dependsOn` (other
  registry components) and its `tokens` (which token groups it uses), so the CLI copies a coherent
  set, not an orphan file.
- **`tokens/`** holds the design-token source. Tokens are copied in on first use (or pinned as a
  small published artifact later, the one part ADR-0009 leaves open); components reference tokens by
  CSS custom property name, never by hardcoded value.

### What `lievit add` does (sketch)

```
$ lievit add button
  resolving button ... depends on: tokens(core, color)
  copy  -> src/components/ui/button.ts
  copy  -> src/styles/lievit-tokens.css        (first run only; merged on re-run)
  done. button is yours: edit src/components/ui/button.ts freely.

$ lievit add button --diff          # later: show what the registry changed upstream
```

The destination path is the adopter's project (e.g. `src/components/ui/`), configurable in
`lievit.toml`. On re-run, the CLI offers a diff rather than overwriting owned edits (the shadcn
trade: control over auto-upgrade).

## The token system

Tokens are the shared design vocabulary. They are plain **CSS custom properties** so they work with
any styling approach the adopter already uses (vanilla CSS, Tailwind, a design system) and so an
adopter restyles by overriding a variable, never by fighting a component's internals.

```css
/* lievit-ui/tokens/tokens.css  (copied to e.g. src/styles/lievit-tokens.css) */
:root {
  /* color */
  --lv-color-bg:            #ffffff;
  --lv-color-fg:            #111827;
  --lv-color-primary:       #2563eb;
  --lv-color-primary-fg:    #ffffff;
  --lv-color-border:        #d1d5db;
  --lv-color-muted:         #6b7280;
  --lv-color-danger:        #dc2626;

  /* spacing (4px scale) */
  --lv-space-1:  0.25rem;
  --lv-space-2:  0.5rem;
  --lv-space-3:  0.75rem;
  --lv-space-4:  1rem;

  /* radius */
  --lv-radius-sm: 0.25rem;
  --lv-radius-md: 0.5rem;

  /* type */
  --lv-font-sans: system-ui, sans-serif;
  --lv-text-sm:   0.875rem;
  --lv-text-base: 1rem;

  /* focus ring (shared by every interactive primitive) */
  --lv-ring: 0 0 0 3px color-mix(in srgb, var(--lv-color-primary) 35%, transparent);
}
```

Principles:

- **Components never hardcode a design value.** A button's background is `var(--lv-color-primary)`,
  never `#2563eb`. Retheming is overriding tokens in `:root`, not editing components.
- **Tokens are owned too.** They are copied in (or, later, a small published artifact, ADR-0009);
  the adopter changes them to match their brand. The `lievit-theme-italian-grade` package (ADR-0005)
  is, at the token level, a curated set of these values.
- **Light-DOM by default, tokens reach in.** The primitives render in the light DOM (no closed
  shadow root that walls off the adopter's CSS), so `var(--lv-*)` cascades normally and both the
  adopter and an AI copilot can restyle freely. This is the concrete mechanism behind ADR-0009's
  "no restyling fight".

## Example primitive: `button`

The source shape of a copy-in primitive. A Lit component, light-DOM rendered, token-styled, owned by
the adopter the moment it lands. (Illustrative of the shape; the shipped registry is the source of truth.)

```ts
// src/components/ui/button.ts   (copied in by `lievit add button`)
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("lv-button")
export class LvButton extends LitElement {
  // render into the light DOM so adopter CSS + tokens cascade in freely
  // (no closed shadow root walling off the styling); this is what makes it
  // restylable by both the adopter and an AI copilot. Owned source: edit at will.
  createRenderRoot() {
    return this;
  }

  @property() variant: "primary" | "ghost" | "danger" = "primary";
  @property({ type: Boolean }) disabled = false;
  @property() type: "button" | "submit" = "button";

  static styles = css`
    .lv-btn {
      font: var(--lv-text-sm) var(--lv-font-sans);
      padding: var(--lv-space-2) var(--lv-space-4);
      border-radius: var(--lv-radius-md);
      border: 1px solid transparent;
      cursor: pointer;
    }
    .lv-btn:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .primary { background: var(--lv-color-primary); color: var(--lv-color-primary-fg); }
    .ghost   { background: transparent; color: var(--lv-color-fg); border-color: var(--lv-color-border); }
    .danger  { background: var(--lv-color-danger); color: #fff; }
  `;

  render() {
    return html`
      <button class="lv-btn ${this.variant}" type=${this.type} ?disabled=${this.disabled}>
        <slot></slot>
      </button>
    `;
  }
}
```

In a lievit template, the button drives a wire action the ordinary way (the component is presentation;
the interactivity is lievit's wire):

```html
<lv-button variant="primary" l:click="save">Save</lv-button>
<lv-button variant="ghost"   l:click="cancel">Cancel</lv-button>
```

## Example primitive: `input`

A token-styled input that participates in `l:model` two-way binding (the wire protocol owns the
binding; the component owns only the look). Owned source, copied in by `lievit add input`.

```ts
// src/components/ui/input.ts   (copied in by `lievit add input`)
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("lv-input")
export class LvInput extends LitElement {
  createRenderRoot() {
    return this; // light DOM: tokens + adopter CSS cascade in, AI-editable
  }

  @property() value = "";
  @property() placeholder = "";
  @property({ type: Boolean }) invalid = false;

  static styles = css`
    .lv-input {
      font: var(--lv-text-base) var(--lv-font-sans);
      color: var(--lv-color-fg);
      background: var(--lv-color-bg);
      padding: var(--lv-space-2) var(--lv-space-3);
      border: 1px solid var(--lv-color-border);
      border-radius: var(--lv-radius-sm);
      width: 100%;
    }
    .lv-input:focus-visible { outline: none; box-shadow: var(--lv-ring); }
    .lv-input.invalid { border-color: var(--lv-color-danger); }
  `;

  render() {
    return html`
      <input
        class="lv-input ${this.invalid ? "invalid" : ""}"
        .value=${this.value}
        placeholder=${this.placeholder}
        @input=${(e: Event) =>
          this.dispatchEvent(
            new CustomEvent("lv-input", {
              detail: (e.target as HTMLInputElement).value,
              bubbles: true,
            })
          )}
      />
    `;
  }
}
```

```html
<!-- bound to a @Wire field; debounced 500ms by default (wire protocol) -->
<lv-input l:model="query" placeholder="Search"></lv-input>
```

`lv-input` only emits its value up (data down, events up); the `l:model` directive and the wire
protocol own the binding and the debounce. The component never holds domain state, consistent with
"state has one owner: the server".

## How the pieces relate

- **The wire runtime** (the seven Maven artifacts) owns interactivity: `@Wire`, `@LievitAction`,
  the snapshot, the `l:*` directives. See `docs/wire-protocol.md`.
- **lievit-ui** (this registry) owns presentation: the look of the controls the wire drives. It is
  copy-in, owned, token-styled, light-DOM, agentic-native.
- **The two are orthogonal**: you can use the wire runtime with your own components, or use lievit-ui
  components without writing every style from scratch. Neither depends on the other at the artifact
  level; lievit-ui is not on the classpath at all.

## Cross-references

- ADR-0009 — the decision: copy-in registry, not a Maven artifact; the rationale (agentic-native,
  no restyling fight, win on model not catalog).
- ADR-0008 — packaging: lievit-ui is not one of the seven artifacts; lives at the monorepo root.
- ADR-0005 — zero-CSS default; copy-in + tokens is its strongest expression.
- ADR-0004 — engine-agnostic template adapters (the runtime side, distinct from this component side).
- `docs/wire-protocol.md` — how `l:click` / `l:model` drive these components over the wire.
