# lievit-ui v2 — complete component library (the plan + the contract for build agents)

STATUS: in progress (autonomous long-running build, started 2026-06-19). This file + the GitHub issues
(label `lievit-ui-v2`) are the DURABLE state: a cold session resumes by reading this file, then
`gh issue list --repo lievit/lievit --label lievit-ui-v2 --state open` (open = remaining work).

## Mission
Make lievit-ui a COMPLETE (100%, not 95), beautiful, robust component library: the "Filament/shadcn for
Spring + JTE" layer. Bring the Laravel/Next DX to JTE. Decisions are MADE (below); do not re-litigate.
When the library is complete, dogfood it into housetree gest IN PLACE OF Web Awesome.

## The model — TWO TIER (decided, non-negotiable)
- **Static / presentational components** -> **JTE partials** (`registry/jte/<name>.jte`) + **Tailwind v4**
  utility classes + the `--lv-*` design tokens. Open markup the adopter owns (copy-in). This is the
  Filament/shadcn-for-JTE layer. Examples: button, badge, card, alert, avatar, breadcrumb, separator,
  skeleton, kbd, label, table (markup), pagination, input, textarea, field, input-group, aspect-ratio,
  empty, item, button-group, native-select, progress (static bar).
- **Interactive components** (client behaviour, state, lifecycle) -> **light-DOM Lit** islands
  (`registry/components/<name>/`) + tokens. Light-DOM (`createRenderRoot(){return this}`) so Tailwind +
  tokens cascade in; NEVER shadow-DOM. Tree-shakeable ES modules. This is the agnostic core (works in
  any template engine). Examples: accordion, collapsible, dialog, drawer/sheet, dropdown-menu,
  context-menu, menubar, navigation-menu, popover, hover-card, tooltip, tabs, toggle, toggle-group,
  select, combobox, command, calendar/date-picker, carousel, checkbox, radio-group, switch, slider,
  scroll-area, resizable, sidebar, input-otp, data-table, file-upload, toast, form (validation).
- **Tokens**: `registry/tokens/lievit-tokens.css` — the `--lv-*` vocabulary (color, radius, space,
  font, ring, shadow...). Rebrand = override tokens. Extend as needed; keep names stable.
- **Icons**: **Lucide** (decided). Raw SVG (MIT), NOT a web-component, NOT Font Awesome. Ship a JTE icon
  partial `registry/jte/icon.jte` that renders an inline `<svg>` by name from a vendored Lucide sprite
  (or per-icon SVG). Tree-shakeable (only the icons used).
- **The upgrade split (the shadcn answer to copy-in)**: the BEHAVIOUR (Lit islands + the wire runtime +
  the tokens defaults) is the DEPENDENCY tier (central upgrades via the pinned dependency / `lievit add`
  pulling a newer source). The STYLE/MARKUP (JTE partials + the adopter's Tailwind + their token
  overrides) is copy-in (owned, customised). So a behaviour bugfix flows via the dependency; the
  adopter's look stays theirs.

## Stack
- Tailwind v4, JTE 3.x (the consumer's engine; the partials are plain `.jte`), Lit 3.x (light-DOM,
  tree-shakeable). The Lit islands follow the EXISTING lievit-ui conventions (see `registry/components/
  button/button.ts` + `light-dom/light-dom.ts` helper `adoptLightStyles`). Each component dir has the
  Lit source + a `meta.json` (files, registryDependencies, npm deps, post-copy docs) — mirror the
  existing 28.

## DONE criteria per component (what "100%" means — agents must hit ALL)
1. Implemented on the correct tier (static -> JTE partial; interactive -> light-DOM Lit). If unsure,
   the rule: does it need client state/behaviour/lifecycle? yes -> Lit; no -> JTE partial.
2. Styled with the `--lv-*` tokens + Tailwind; beautiful, Filament/shadcn-grade defaults. Match the
   shadcn-ui reference's structure/variants/sizes (clone at `~/workspaces/ui-refs/shadcn-ui`, the
   new-york-v4 registry) and Radix's accessibility behaviour (`~/workspaces/ui-refs/radix-primitives`).
3. Accessible: correct ARIA roles/states, full keyboard interaction, focus management, `:focus-visible`
   ring via `--lv-ring`. (Radix is the accessibility source of truth — match its keyboard/ARIA model.)
4. For Lit islands: light-DOM, tree-shakeable, dependency-free where possible (only lit + @floating-ui
   for positioning if needed, as the existing components do). A `meta.json`.
5. Tests: vitest (the lievit-ui suite, happy-dom) for an interactive component's behaviour; for a JTE
   partial, a render/golden check. New tests green.
6. A short usage doc (the `docs` in meta.json or a comment) showing the JTE/HTML usage.
7. Icons via the Lucide partial, never Font Awesome / wa-icon.

## The scientific decision rule (for any choice not pre-decided)
When a design choice arises (API shape, a behaviour, a styling approach), compare how **MUI, Radix,
shadcn/ui, and Web Awesome** solved it, and pick the OBJECTIVELY best on these non-debatable criteria,
in order: (1) accessibility (ARIA correctness, keyboard, focus, screen-reader), (2) customisability
(light-DOM + Tailwind + tokens beats shadow-DOM + CSS parts), (3) bundle size / tree-shakeability,
(4) API ergonomics (least surprise, composability, "data down events up"), (5) robustness (edge cases,
controlled/uncontrolled, SSR-friendliness). Radix usually wins accessibility/behaviour; shadcn wins
styling/markup ergonomics; take the best of each. Document the choice in a one-line comment. Do NOT ask
a human — auto-deduce from the criteria.

## Repo structure (lievit-ui)
```
lievit-ui/
  registry/
    components/<name>/{<name>.ts, meta.json}   # light-DOM Lit interactive islands
    jte/<name>.jte                              # static presentational partials (NEW in v2)
    jte/icon.jte                                # Lucide icon partial (NEW)
    tokens/lievit-tokens.css                    # --lv-* design tokens (extend)
    icons/                                       # vendored Lucide sprite/svgs (NEW)
  test/                                          # vitest
```

## Backlog (the GitHub issues, label `lievit-ui-v2`)
### Components lievit-ui ALREADY has (28 — audit/refit to v2 model + tokens only if needed, do not rebuild): accordion, alert, badge, breadcrumb, button, card, checkbox, data-table, date-picker, dialog, drawer, dropdown-menu, field, file-upload, input, label, progress, radio-group, rich-select(=combobox), select, separator, slider, spinner, switch, tabs, textarea, toast(=sonner), tooltip.
### Components to BUILD (gap vs shadcn ~30):
- STATIC (JTE partial): alert-dialog (uses dialog), aspect-ratio, avatar, button-group, empty, input-group, item, kbd, native-select, pagination, skeleton, table.
- INTERACTIVE (Lit island): calendar, carousel, chart, collapsible, command, context-menu, hover-card, input-otp, menubar, navigation-menu, popover, resizable, scroll-area, sheet (drawer variant), sidebar, toggle, toggle-group.
### BLOCKS (compositions, JTE templates using the components) — the distinct PATTERNS (dedupe the 16 near-identical variants): login, signup, sidebar-app-shell, dashboard. (A representative, useful set; not 16 sidebar clones.)

## Orchestration (how the build runs)
- One GitHub issue per component / block (label `lievit-ui-v2`). Each build subagent takes one issue,
  works in its OWN lievit worktree off `feat/lievit-ui-v2`, builds to the DONE criteria, runs tests,
  commits (no push). The orchestrator merges into `feat/lievit-ui-v2`, closes the issue, launches the
  next. Parallel in batches (concurrency cap ~16). Loop until 0 open issues.
- Integration branch: `feat/lievit-ui-v2`. Merged to `main` + the dogfood (gest) only when 100% + green.
- Progress is the issue list. Resume after a compact: read this file + `gh issue list ... --state open`.
