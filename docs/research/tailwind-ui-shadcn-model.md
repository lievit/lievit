# Tailwind UI / shadcn Distribution Model — Research

Sources: `~/tmp-headlessui` (tailwindlabs/headlessui, depth-1 clone),
`shadcn-ui/ui` (via GitHub MCP, main branch as of 2026-06-17).

---

## 1. Headless UI: a11y primitives

### What it is

Headless UI is a React (and Vue) library of **unstyled, fully accessible components**.
It does NOT ship styles; it only ships ARIA attributes, keyboard navigation, and focus
management. The adopter supplies all styling.

Source: `~/tmp-headlessui/packages/@headlessui-react/src/components/`

### Component catalogue

```
button, checkbox, close-button,
combobox / combobox-button / combobox-input / combobox-label / combobox-option / combobox-options,
dialog / dialog-description / dialog-panel / dialog-title,
disclosure / disclosure-button / disclosure-panel,
field, fieldset, focus-trap, input,
label, legend,
listbox / listbox-button / listbox-label / listbox-option / listbox-options,
menu / menu-button / menu-item / menu-items / menu-section,
popover / popover-button / popover-group / popover-overlay / popover-panel,
radio-group / radio-group-description / radio-group-label / radio-group-option,
select, switch / switch-description / switch-group / switch-label,
tab / tab-group / tab-list / tab-panel / tab-panels,
textarea, tooltip, transition / transition-child
```

### Keyboard navigation constants

`~/tmp-headlessui/packages/@headlessui-react/src/components/keyboard.ts`:
```ts
export enum Keys {
  Space = ' ', Enter = 'Enter', Escape = 'Escape',
  Backspace = 'Backspace', Delete = 'Delete',
  ArrowLeft = 'ArrowLeft', ArrowUp = 'ArrowUp',
  ArrowRight = 'ArrowRight', ArrowDown = 'ArrowDown',
  Home = 'Home', End = 'End', PageUp = 'PageUp', PageDown = 'PageDown', Tab = 'Tab',
}
```

### How ARIA is wired (Dialog example)

`dialog.tsx` references `// WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/`
directly. Internally it composes:
- `FocusTrap` (initial focus, Tab/Shift+Tab lock, RestoreFocus on close, AutoFocus via
  `data-autofocus`)
- `useScrollLock` (body scroll prevention)
- `useInertOthers` (sets `aria-hidden` + `inert` on the rest of the DOM)
- `useOutsideClick` (close on backdrop click)
- `useEscape` (close on Escape)
- Portal for rendering outside the DOM hierarchy

`FocusTrapFeatures` is a bitmask enum:
`None | InitialFocus | TabLock | FocusLock | RestoreFocus | AutoFocus`

### How Listbox/Combobox handle keyboard

Both Listbox and Combobox import `@react-aria/focus` and `@react-aria/interactions`
(not a pure-vanilla impl). Combobox also uses `@tanstack/react-virtual` for
virtualisation. The keyboard logic is bound via event handlers on the trigger/input
elements; ARIA roles (`role="listbox"`, `aria-expanded`, `aria-activedescendant`) are
set programmatically via React state.

### Key observation for lievit-ui

Headless UI is **React-only** (the Vue package exists separately). There is no web-
component edition. The focus-management logic (`focus-management.ts`,
`focus-trap.tsx`) is non-trivial (~400+ lines). The patterns it implements are
documented verbatim in the WAI-ARIA Authoring Practices Guide (APG).

---

## 2. shadcn/ui: the copy-in registry model

### 2.1 Registry schema

Source: `packages/shadcn/src/registry/schema.ts`

A **registry item** (`RegistryItem`) is a Zod-validated object with these key fields:

```ts
{
  name: string,
  type: "registry:ui" | "registry:lib" | "registry:block" | "registry:component"
      | "registry:hook" | "registry:page" | "registry:file" | "registry:theme"
      | "registry:style" | "registry:item" | "registry:base" | "registry:font",
  title?: string,
  description?: string,
  dependencies?: string[],          // npm packages
  devDependencies?: string[],       // npm dev packages
  registryDependencies?: string[],  // other registry items by name
  files?: RegistryItemFile[],       // { path, type, target?, content? }
  tailwind?: { config?: { content?, theme?, plugins? } },
  cssVars?: { theme?, light?, dark? },  // CSS custom property values
  css?: Record<string, any>,           // raw CSS injection
  docs?: string,                       // post-install instruction markdown
  categories?: string[],
}
```

A **registry** is:
```ts
{
  $schema?: string,
  name: string,
  homepage: string,
  include?: string[],
  items: RegistryItem[],
}
```

The **project config** (`components.json`) has:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "tailwind": { "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/registry/new-york-v4/ui" }
}
```

Third-party registries are namespaced with `@` (e.g. `@acme`) and configured as URL
templates in `components.json.registries`:
```json
{ "@acme": "https://acme.com/r/{name}.json" }
```

### 2.2 CLI mechanics (shadcn add)

Source: `packages/shadcn/src/commands/add.ts` + `registry/api.ts` + `registry/loader.ts`

**Flow** of `npx shadcn add button`:

1. Read `components.json` (project config, created by `shadcn init`).
2. Resolve the name `"button"` against registered registry URLs (default:
   `https://ui.shadcn.com/r/{name}.json`).
3. Fetch the item JSON (`RegistryItem`) from the URL.
4. Resolve transitive `registryDependencies` recursively; fetch each.
5. Collect all `dependencies` (npm) and install them.
6. For each file in `files[]`: resolve the target path (using `aliases` in
   `components.json`), write the file content to disk.
7. Inject `cssVars` into the project's global CSS file (patched in place).
8. Inject `css` blocks into the global CSS if present.
9. Print `docs` (post-install instructions) to stdout.

**Dry run**: `--dry-run` (or `--diff` / `--view`) previews changes without writing.
Source: `dryRunComponents()` in `utils/dry-run.ts`.

**Re-run**: the CLI does NOT merge; it offers `--overwrite` to replace, or `--diff`
to show what changed upstream. The adopter owns the decision.

### 2.3 Token system (CSS custom properties)

Source: `apps/v4/registry/new-york-v4/ui/_registry.ts` (sidebar entry, which is the
most explicit example of `cssVars` in action):

shadcn v4 uses **Tailwind v4 + CSS custom properties**. Token naming follows the
`--<semantic-name>` pattern without a product prefix. Values are stored as raw HSL
channel strings (no `hsl()` wrapper), consumed as `hsl(var(--primary))` in Tailwind
config and component classes.

Core semantic tokens (set by the theme/base on `:root`):
```
--background, --foreground,
--card, --card-foreground,
--popover, --popover-foreground,
--primary, --primary-foreground,
--secondary, --secondary-foreground,
--muted, --muted-foreground,
--accent, --accent-foreground,
--destructive,
--border, --input, --ring,
--radius,
--chart-1 ... --chart-5,
--sidebar-background, --sidebar-foreground, ... (per-component tokens)
```

The `cssVars` field in a registry item can inject **per-component tokens** as
`{ light: { "sidebar-background": "0 0% 98%" }, dark: { "sidebar-background": "240 5.9% 10%" } }`.
The CLI merges these into the global CSS file under `:root` and `.dark`.

Tailwind v4 reads them via `@theme` blocks (the `tailwind.css` file in
`packages/shadcn/src/tailwind.css` defines `@custom-variant data-open`, `data-closed`,
`data-checked`, `data-selected`, `data-disabled`, `data-active` — these map Radix's
`data-state` attributes to Tailwind variant classes).

### 2.4 Component anatomy (Radix + cva + Tailwind)

Source: `apps/v4/registry/new-york-v4/ui/button.tsx`

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"   // clsx + twMerge

const buttonVariants = cva(
  "inline-flex ... focus-visible:ring-[3px] focus-visible:ring-ring/50 ...",
  {
    variants: {
      variant: { default: "bg-primary text-primary-foreground ...", ... },
      size:    { default: "h-9 px-4 py-2", sm: "h-8 ...", lg: "h-10 ...", icon: "size-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : "button"
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
```

Pattern: **Radix primitive** (for ARIA + keyboard, e.g. `Slot.Root`, `Dialog.Root`) +
**`cva`** (variant-based class generation) + **`cn`** (class merging) + **Tailwind
semantic class names** that resolve to CSS custom properties.

The `asChild` / `Slot.Root` pattern lets the button render as any element (e.g. an
`<a>`) while keeping its ARIA and event handling.

---

## 3. Tailwind UI catalog taxonomy

shadcn's catalog (as seen in `apps/v4/registry/new-york-v4/ui/_registry.ts`, 50+ items)
covers:

**Primitives / atoms**: button, badge, input, textarea, label, checkbox, radio-group,
switch, select, native-select, separator, skeleton, spinner, kbd, progress, slider.

**Layout / structure**: card, table, tabs, accordion, collapsible, pagination,
breadcrumb, avatar, aspect-ratio, scroll-area, resizable, empty.

**Overlays / floating**: dialog, alert-dialog, popover, tooltip, hover-card, sheet,
drawer, dropdown-menu, context-menu, menubar, navigation-menu, command, combobox,
sonner (toast).

**Composition helpers**: button-group, input-group, input-otp, toggle, toggle-group,
form (react-hook-form integration), field, item, sidebar, chart, carousel.

shadcn does NOT ship a "gestionale-specific" taxonomy. The relevant gestionale subset
maps to:

| Gestionale need | shadcn equivalent |
|---|---|
| Data table | `table` + sort/filter in userland |
| Master-detail drill | `sheet` or `dialog` |
| Filter bar | `input`, `select`, `combobox`, `button-group` |
| Status badge | `badge` |
| Action confirmation | `alert-dialog` |
| Navigation | `tabs`, `sidebar`, `breadcrumb` |
| Inline edit | `input`, `textarea` in `popover` |
| Notifications | `sonner` |

---

## 4. Mapping to lievit-ui

### 4.1 Registry + CLI

shadcn's `RegistryItem` schema is the right template for lievit-ui's `registry.json`.
The direct mapping:

| shadcn field | lievit-ui equivalent |
|---|---|
| `name` | component slug |
| `type` = `"registry:ui"` | all lievit components are this type |
| `dependencies[]` | npm deps (only `lit` for most) |
| `registryDependencies[]` | other lievit-ui components needed |
| `files[].path` | source path inside `lievit-ui/` |
| `files[].type` = `"registry:ui"` | same |
| `cssVars.light/dark` | not needed: lievit uses a single `:root` swatch (no dark-mode at v0.1) |
| `docs` | post-copy instruction (e.g. "register `<lv-button>` in your entry point") |

The `meta.json` per-component in `docs/lievit-ui.md` is equivalent to a single-item
`_registry.ts`. Consider consolidating to one `registry.json` at the root (shadcn
style) rather than per-component `meta.json` to keep the CLI's resolver simple.

`lievit.toml` (lievit's `components.json`) needs at minimum:
```toml
[aliases]
ui = "src/components/ui"
styles = "src/styles"

[registry]
url = "https://registry.lievit.dev/r/{name}.json"   # or local path for dev
```

### 4.2 Token naming (--lv-*)

lievit-ui's `--lv-*` prefix is intentional and correct: it avoids collision with
both Tailwind's generated vars and the adopter's own CSS. shadcn chose no prefix
because it owns the entire token namespace of the project; lievit-ui co-exists with
an existing project, so namespacing is load-bearing.

The token categories in `docs/lievit-ui.md` (color, spacing, radius, type, focus-ring)
mirror shadcn's semantic layer. The one gap: **dark-mode tokens**. shadcn carries
`light` / `dark` in every `cssVars` entry. lievit-ui omits this at v0.1 (gestionale
target, typically no dark mode). The `cssVars.light/dark` split can be added later
without breaking the schema.

Concrete token additions to consider for gestionale completeness:
```css
--lv-color-surface:       #f9fafb;   /* table row zebra, card bg */
--lv-color-success:       #16a34a;   /* status badges */
--lv-color-warning:       #d97706;
--lv-color-info:          #2563eb;   /* same as primary, aliases fine */
--lv-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--lv-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07);
```

### 4.3 A11y primitives for Lit + JTE

**The problem**: shadcn wraps Radix UI (React) for all complex ARIA patterns.
Headless UI is also React-only. Neither is usable in Lit web components or JTE.

**The options** (in order of preference):

**A. Floating UI** (`@floating-ui/dom`, framework-agnostic): handles positioning
(popover, tooltip, dropdown, combobox listbox). Does NOT handle ARIA or keyboard;
the component author adds those. Recommended for all floating surfaces in lievit-ui.
Already used by Headless UI internally for anchor positioning.

**B. WAI-ARIA APG patterns** (direct implementation): write the keyboard and ARIA
logic by hand, referencing the APG patterns exactly. Headless UI's `keyboard.ts`
(the enum of key names) is a 20-line file worth copying verbatim. The Dialog
focus-trap is the hardest piece; a focused ~100-line implementation covers 95% of
gestionale use cases (no nested dialogs, no portal nesting complexity).

**C. `@a11y/` or `aria-query` packages**: utility libraries (query ARIA roles,
focusable-element detection). Useful for internal helpers, not a full solution.

**D. Base UI** (`@base-ui/react`) or **Radix Primitives** for web components: does
NOT exist. Base UI ships React components (shadcn already migrated combobox to it).
No cross-framework edition is available.

**Recommended strategy for lievit-ui v0.1**:
- Simple controls (button, input, checkbox, switch, tabs): Lit + WAI-ARIA attributes
  set declaratively in the component's `render()`. No library needed.
- Floating surfaces (tooltip, popover, dropdown, combobox): Lit + Floating UI DOM
  for position. ARIA role + keyboard written in Lit event handlers following APG.
- Modal (dialog/modal): Lit + a minimal focus-trap helper (own code, ~80 lines,
  extracted from Headless UI's `FocusTrap` logic translated to vanilla DOM APIs).
  `inert` attribute (now Baseline) replaces the old `aria-hidden` pattern.
- NO external a11y library dependency at v0.1: keeps the registry copy-in lean.

**Key ARIA patterns** the gestionale set needs (WAI-ARIA APG references):
- Button: trivial (native `<button>` carries it)
- Tabs: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, Arrow keys
- Dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap, Escape
- Listbox/Select: `role="listbox"`, `role="option"`, `aria-selected`, Arrow + Home/End
- Combobox: `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-controls`

### 4.4 What "lievit add <component>" copies

shadcn copies a `.tsx` file (the component) + injects CSS vars into the global CSS.

For lievit-ui the equivalent copy-in unit is:

| Artifact | What it is | Destination |
|---|---|---|
| `<name>.ts` | Lit web component (the island, stateful interactive behavior) | `src/components/ui/<name>.ts` |
| `<name>.jte` | JTE partial (server-rendered composite, wraps the Lit island or renders purely static) | `src/main/jte/components/<name>.jte` |
| `lievit-tokens.css` | Design tokens (first run only; merge on re-run) | `src/main/resources/static/css/lievit-tokens.css` (or wherever the adopter keeps global CSS) |

Not every component needs both: a `<lv-button>` is pure Lit (no JTE partial needed);
a form field group (label + input + error) may be a JTE partial that uses `<lv-input>`
as a Lit island inside it.

The `meta.json` / `_registry.ts` entry for a dual-artifact component:
```json
{
  "name": "modal",
  "type": "registry:ui",
  "files": [
    { "path": "components/modal/modal.ts",  "type": "registry:ui" },
    { "path": "components/modal/modal.jte", "type": "registry:ui" }
  ],
  "registryDependencies": ["tokens"]
}
```

The `lievit add` CLI resolves this and copies both files. The JTE partial is the
server-rendered shell; the Lit component is the island that drives open/close state.

### 4.5 Component taxonomy for gestionale

Minimal "complete" set for a gestionale (internal management app), ordered by delivery
priority:

**Tier 1 — always needed, no ARIA complexity**:
`button`, `input`, `textarea`, `label`, `badge`, `table`, `card`, `separator`,
`spinner`, `alert`

**Tier 2 — forms + basic overlays**:
`checkbox`, `select` (native `<select>` wrapper), `switch`, `field` (label+input+error
composite), `toast` / `sonner`, `tooltip`, `progress`

**Tier 3 — navigation + data**:
`tabs`, `sidebar`, `breadcrumb`, `pagination`, `modal` (dialog), `combobox`

**Tier 4 — advanced (post-v0.1)**:
`dropdown-menu`, `date-picker`, `data-table` (with sort/filter), `file-upload`,
`rich-select` (multi-select with chips)

This maps closely to shadcn's catalogue, minus marketing/public-site components
(carousel, aspect-ratio, navigation-menu, resizable, hover-card, command palette).

---

## 5. Open questions / decisions needed

**5.1 JTE partial: copy or generate?**
shadcn copies `.tsx` files as-is. JTE partials have server-side template logic
(Spring model, `@param` types). The CLI could copy a JTE partial as a static file
OR generate it from a template at copy time (substituting package name, alias,
etc.). Decision: copy-as-is is simpler and consistent with the shadcn model; JTE
partials should be self-contained with typed `@param` declarations.

**5.2 Dark mode tokens: now or never?**
shadcn ships `light` + `dark` from day one. If gestionale adopters never need dark
mode, `--lv-*` tokens as single `:root` values are fine. But the schema should
leave room for a future `@media (prefers-color-scheme: dark)` block. Recommend
reserving the structure even if v0.1 only fills `light`.

**5.3 Floating UI as a shipped dependency or copy-in?**
`@floating-ui/dom` (~7 kB gzip) could be: (a) a declared `dependency` in each
floating component's registry entry (the CLI installs it), or (b) copied in as a
tiny inline helper. Option (a) is cleaner and matches how shadcn lists `radix-ui`
as a dependency. Decision needed before implementing tooltip/popover.

**5.4 Registry hosting: local vs. remote?**
shadcn's default is a hosted HTTPS endpoint (`https://ui.shadcn.com/r/{name}.json`).
For lievit-ui v0.1, the registry can be a local directory path or a GitHub raw URL.
The CLI should support both (shadcn does via the `registries` map in `lievit.toml`).

**5.5 `lievit.toml` vs. `lievit.json` (config file format)**
shadcn uses `components.json`. lievit using `.toml` is consistent with Java/Maven
ecosystems (Maven uses XML, but TOML is human-friendlier and increasingly familiar
in the Java world). No blocker, but pick one and lock it.

**5.6 Focus-trap: own code or thin wrapper?**
The Headless UI focus-trap is ~200 lines (with `useIsMounted`, `microTask`,
`useTabDirection`, `Hidden` sentinel elements). A vanilla-DOM lievit equivalent
probably runs 60-80 lines covering: `querySelectorAll` focusable candidates,
sentinel `tabindex` elements at top/bottom of modal, Escape handler, focus-restore
on close. Worth implementing once and unit-testing; it's the highest-risk ARIA piece.
