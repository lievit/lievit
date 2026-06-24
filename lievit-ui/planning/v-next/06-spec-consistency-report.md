# lievit-ui v-next: spec consistency report

**Generated**: 2026-06-24
**Scope**: 73 spec files in `specs/`, cross-checked against `00-architecture-contract.md` and `04-component-spec-template.md`.
**Gold-standard exemplars**: `button.md` (trivial PARTIAL), `select.md` (WIRE+ENH, collection-nav), `dialog.md` (overlay WIRE+ENH, focus-trap).
**Token source-of-truth**: `registry/tokens/lievit-tokens.css` (from the live `lievit` repo, not the specs themselves).

---

## 1. Overall coherence verdict

**CONDITIONALLY COHERENT — systematic structural issues, no fatal semantic breaks.**

The 73 specs share the core conceptual model correctly: tier model, two-channel escaping, `data-slot`/`data-variant`/`data-size` root attributes, OKLCH colour tokens, shared a11y mechanism references (no re-implementation found). The wire integration pattern, popover seam, `focus-trap.enhancer.ts`, and `collection-nav.enhancer.ts` are consistently REFERENCED not RE-SPECIFIED.

What is not coherent is structural and mechanical:

- **Section numbering** is fragmented across three incompatible conventions: the template mandates exactly 8 sections (§8 = Agent instructions), but 49 of 73 specs deviate by adding §8 "Non-goals / anti-patterns" as a separate section, pushing Agent instructions to §9 (or dropping it entirely).
- **Variant vocabulary** has two outlier names (`neutral`, `danger`) that are v0.1 legacy aliases in the token file, not the canonical v-next vocabulary.
- **Font-weight token name**: three specs use `--lv-font-weight-medium` instead of the canonical `--lv-font-medium`.
- **"NET-NEW" declarations** for `--lv-color-warning`/`-fg`, `--lv-color-info`/`-fg`, `--lv-color-success`/`-fg` in several specs are factually wrong — these tokens already exist in `lievit-tokens.css`.

No spec re-specifies or re-implements a shared mechanism. No spec breaks the "state has one owner" invariant. No spec introduces inline colour literals. The acceptance-test depth is adequate across all specs audited.

---

## 2. Divergences

### D1 — Variant vocabulary: `neutral` and `danger` are legacy v0.1 aliases

**Severity**: medium. Calling convention inconsistency; token aliases exist in the token file but the names should be retired in v-next.

**Contract**: §5.a of `00-architecture-contract.md`: variant names for actions are `primary | secondary | destructive | ghost | outline`; for status are `info | success | warning | destructive`; elsewhere use `default | <intent>`.

**What `lievit-tokens.css` says** (live file, line 95–96):
```
--lv-color-danger: #dc2626; /* alias of --lv-color-destructive; kept for the 28 v0.1 components */
--lv-color-danger-fg: #ffffff;
```
`danger` is an explicit v0.1 legacy alias. `neutral` has no standalone token — specs using `neutral` as a variant name map to `--lv-color-muted-bg` / `--lv-color-muted-fg`, which are valid tokens but under a `default` or no-variant semantic.

**Affected specs and fix**:

| Spec | Divergence | Fix |
|---|---|---|
| `badge.md` (badge.jte + chip.jte) | `variant="neutral"` as the default badge state | Rename to `variant="default"` (same tokens, no visual change); update acceptance tests and `data-variant` assertions |
| `item-kbd-link.md` (item sub-template) | `variant="danger"` for destructive action row; maps to `--lv-color-destructive` correctly but uses the legacy name | Rename to `variant="destructive"` in the item param spec and the state table |
| `context-menu.md` | `item.danger` flag emits `data-variant="danger"` | Rename flag and attribute to `data-variant="destructive"` |
| `dropdown-menu.md` | `danger` flag on item level (same pattern as context-menu) | Same rename to `destructive` |

`popover.md` uses "neutral surface" as prose description, not as a `variant` param value — no change needed.

---

### D2 — Section structure: template mandates exactly 8 sections; 49 specs deviate

**Severity**: high. Every AI agent reading a spec encounters a different section order, which defeats the fan-out purpose of the template.

**Template rule** (`04-component-spec-template.md`): exactly 8 sections, §8 = "Agent instructions (the discipline reminders)". No §8 "Non-goals" section exists in the template.

**Observed patterns across 73 specs**:

| Pattern | Spec count | Affected specs (examples) |
|---|---|---|
| Exactly 8 sections, §8 = Agent instructions (CORRECT) | 24 | `button`, `select`, `dialog`, `accordion`, `combobox`, `command`, `file-upload`, `builder`, `cascader`, … |
| 9 sections: §8 = Non-goals, §9 = Agent instructions | 11 | `alert-dialog`, `color-picker`, `drawer`, `empty`, `form`, `input`, `item-kbd-link`, `native-select`, `popover`, `slider`, `transfer` |
| 9 sections: duplicate §8 (Non-goals + Agent instructions both labelled §8) | 18 | `aspect-ratio`, `badge`, `breadcrumb`, `cascader`, `data-list`, `dropdown-menu`, `hover-card`, `icon`, `key-value-input`, `mentions`, `menubar`, `pagination`\*, `radio-group`, `scroll-area`, `sheet`, `sidebar`, `tooltip`, `tree-select` |
| 8 sections, §8 = Non-goals only (Agent instructions MISSING) | 20 | `alert`, `avatar`, `calendar`, `chart`, `checkbox`, `date-picker`, `field`, `infolist-entry`, `input-otp`, `loading-section`, `navigation-menu`, `resizable-panes`, `section-card`, `separator`, `stat-card`, `switch`, `table`, `theme-switcher`, `tree-view`, `wizard` |

\* `pagination.md` uses `## 8.1 Agent instructions` — a subsection, not a top-level section.

**Fix**: The Non-goals content is valuable but belongs inside §8 "Agent instructions" as a named subsection, not as a separate numbered section. Template update:

```
## 8. Agent instructions (the discipline reminders)

### Anti-patterns / non-goals
[content from current "Non-goals" sections]

### Discipline checklist
[current Agent instructions content]
```

All 49 divergent specs need this consolidation. The 20 specs missing Agent instructions entirely need a §8 added with at minimum the two universal anti-patterns: (1) do not re-implement a shared mechanism; (2) do not hand-edit `_generated/` files.

---

### D3 — Font-weight token: three specs use wrong name `--lv-font-weight-medium`

**Severity**: low-medium. Implementation agents will reference a non-existent token.

**Canonical name** (from `registry/tokens/lievit-tokens.css`, line 159): `--lv-font-medium: 500`. The token set is `--lv-font-{normal,medium,semibold,bold}` — no `--lv-font-weight-*` prefix exists.

**Affected specs**:

| Spec | Wrong token | Correct token |
|---|---|---|
| `avatar.md` | `--lv-font-weight-medium` (initials weight) | `--lv-font-medium` |
| `label.md` | `--lv-font-weight-medium`, `--lv-font-weight-semibold` | `--lv-font-medium`, `--lv-font-semibold` |
| `wizard.md` | `--lv-font-weight-medium`, `--lv-font-weight-normal` | `--lv-font-medium`, `--lv-font-normal` |

**Fix**: do a global token-name replace in each of the three specs. No visual impact, just naming correctness.

---

### D4 — "NET-NEW" declarations for tokens that already exist

**Severity**: medium. Implementation agents may add duplicate token declarations to `lievit-tokens.css`, creating drift.

**Canonical state**: `--lv-color-success`, `--lv-color-success-fg`, `--lv-color-warning`, `--lv-color-warning-fg`, `--lv-color-info`, `--lv-color-info-fg` **all exist** in `lievit-tokens.css` (lines 89–94). They are part of the shared status vocabulary the architecture contract lists as `info | success | warning | destructive`.

**Affected specs**:

| Spec | What it claims as NET-NEW | Reality |
|---|---|---|
| `alert-dialog.md` | `--lv-color-warning`, `--lv-color-warning-fg` | Already in token file |
| `alert.md` | `--lv-color-warning`, `--lv-color-warning-fg`, `--lv-color-info`, `--lv-color-info-fg`, `--lv-color-success`, `--lv-color-success-fg` | All already in token file |

**Fix**: remove the "NET-NEW" flag from these token rows in §5 of both specs. Change description to "reads existing token". No implementation change needed.

---

### D5 — Avatar size vocabulary undocumented extension (`xs`, `xl`, `2xl`)

**Severity**: low. The contract allows components whose sizing is not toolbar-aligned to use an extended vocabulary, but requires justification.

**Contract** (§5.b): "A `button`, `input`, `native-select` of the same size are pixel-aligned. Every form-control + button v-next component obeys this scale." Crucially, this constraint is on FORM-CONTROL components.

**What avatar.md does**: size = `xs | sm | md | lg | xl | 2xl`, diameter-based (not height-based). The spec explicitly justifies this: "Avatar is a presentational element, not a form control; its sizes are diameter-based (the circle) and are deliberately not toolbar-aligned."

**Assessment**: the justification is sound. However, the architecture contract does not document this pattern explicitly. Any future non-form-control component could invent its own extended vocabulary without guidance.

**Fix**: add one paragraph to `00-architecture-contract.md` §5.b explicitly stating that the `sm | md | lg` height-based scale is ONLY mandatory for form controls and action buttons; display/presentational components may extend the vocabulary when the component's natural sizing axis is different, with explicit justification in §3 of the spec. `avatar.md` and `icon.md` (which also extends to `xs | xl`) become the reference examples for this pattern.

---

### D6 — `--lv-color-muted` vs `--lv-color-muted-bg` for hover/subtle backgrounds

**Severity**: low. Both tokens exist in `lievit-tokens.css` and are semantically distinct. The inconsistency is in how specs DESCRIBE their role, not in whether they exist.

**Canonical distinction** (from token file, line 58–60):
- `--lv-color-muted`: `#6b7280` — a text-weight muted grey (foreground use, subdued text)
- `--lv-color-muted-bg`: `#f3f4f6` — a fill/surface grey (background use, low-emphasis fills)
- `--lv-color-muted-fg`: same as `--lv-color-muted` (foreground on top of a muted-bg surface)

**What some specs do**: `builder.md`, `button-group.md`, `carousel.md` use `--lv-color-muted` for hover BACKGROUNDS and subtle fills. These are using a text-weight grey as a background tint, which is technically using the wrong token for the semantic role (a hover fill on a light surface should be `--lv-color-muted-bg`, not `--lv-color-muted`).

**Affected specs**: `builder.md`, `button-group.md`, `carousel.md` (hover fill), `accordion.md` (collapsed header tint). The badge, command, data-list, toggle specs correctly use `--lv-color-muted-bg` for surface fills.

**Fix**: audit §5 token tables in the four affected specs. Replace `--lv-color-muted` (text-weight grey) with `--lv-color-muted-bg` wherever the token role is "hover fill" or "subtle surface". Add a clarifying comment to the architecture contract's §4 token section: "`--lv-color-muted` = subdued text; `--lv-color-muted-bg` = subtle surface/fill; do not interchange."

---

### D7 — `alert-dialog.md` has §6 "Wire / island integration" despite being PARTIAL tier

**Severity**: low. The content is useful and accurate; the violation is structural.

**Template rule**: §6 is labelled "Wire actions (WIRE/HTMX only)". PARTIAL specs that have no wire surface should use §6 to state "none of its own" (as `button.md` and `label.md` correctly do).

**What alert-dialog.md does**: §6 contains a detailed section explaining how the PARTIAL integrates with the `dialog` WIRE shell — which consuming WIRE template to compose, how to set the initial focus param, how Esc routing works through the WIRE parent. This content is genuinely useful to an implementation agent.

**Assessment**: the content belongs in §8 Agent instructions (as a composition note) or in a "§6 Wire / island integration" section with "Static PARTIAL, no Wire surface of its own; composition contract:" header — which is what it effectively says. The structure is tolerable but inconsistent.

**Fix**: change the §6 heading to "## 6. Wire / island integration" (matching the PARTIAL pattern) and add the opening line "Static PARTIAL, no Wire surface of its own. Composition contract with the dialog WIRE shell:" before the current content.

---

### D8 — Carousel uses custom height tokens `--lv-carousel-height-{sm,md,lg}`

**Severity**: informational. Correctly justified; the issue is documentation gap in the contract.

`carousel.md` introduces `--lv-carousel-height-sm` (200px), `--lv-carousel-height-md` (360px), `--lv-carousel-height-lg` (540px). The spec correctly notes: "Not expressible via existing `--lv-space-*` (those top out at `--lv-space-10` = 40px; a carousel track is a content container at a different scale)."

This is the RIGHT decision. But the contract has no documented pattern for component-scoped dimension tokens. `aspect-ratio.md` introduces `--lv-ar-ratio` as a component-scoped CSS custom property for a similar reason.

**Fix**: document the pattern in `00-architecture-contract.md` §4: "When a component's dimension is at a different scale than `--lv-space-*` (e.g. a content container height, an aspect-ratio value), introduce a component-scoped CSS custom property named `--lv-<component>-<dimension>` (e.g. `--lv-carousel-height-sm`). These are NOT added to `:root`; they live as defaults inside the component's CSS class."

---

### D9 — `--lv-space-5` referenced without confirming its existence in some specs

**Severity**: low. Checkbox and other specs note `--lv-space-5` (20px) may not exist in the token scale.

The token file for the `lievit` repo does include `--lv-space-5` in the spacing scale. However, multiple specs flag it as uncertain (`checkbox.md`: "The `--lv-space-5` (20px) flagged as possibly missing"). A token gap check should confirm the complete `--lv-space-*` scale is declared before implementation starts.

**Fix**: add a one-line note to §4 of the architecture contract listing the complete `--lv-space-*` scale or pointing to the token file as the canonical authority. Remove the uncertainty flags from checkbox, color-picker, and other specs that note the gap.

---

## 3. Thin or incomplete specs vs the exemplars

The exemplars (button/select/dialog) set the bar: rich §3 state tables, named ARIA attributes per state in §4, token table with dark re-point notes in §5, typed action signatures in §6, named test IDs anchored to the substrate rule in §7 ("real LievitRuntime, not mocked"), precise anti-patterns in §8.

**Specs that fall short of this bar**:

| Spec | Gap |
|---|---|
| `separator.md` | Shortest spec at 351 lines. §7 acceptance tests are thin (5 test cases). A separator with no interaction surface has few tests by nature, but the `aria-orientation` + screen reader announcement round-trip is not tested. |
| `progress.md` | §4 a11y contract does not mention `aria-valuetext` for percentage announcement, which is a WAI-ARIA spec requirement for `role="progressbar"`. |
| `infolist-entry.md` | §7 has only 82 lines and no Agent instructions section. Missing tests for the `horizontal | vertical` orientation rendering contract. |
| `section-card.md` | No Agent instructions section. §4 a11y is thin — no explicit APG pattern reference (landmark role `<section>` with `aria-labelledby` is not called out). |
| `loading-section.md` | No Agent instructions. §4 lacks explicit `aria-live="polite"` attribute test. |
| `navigation-menu.md` | No Agent instructions. WIRE + ENH tier with `collection-nav.enhancer.ts` but §4 does not name the APG Navigation pattern URL. |
| `resizable-panes.md` | No Agent instructions. §4 does not specify the `aria-valuenow` / `aria-valuemin` / `aria-valuemax` contract for the splitter handle, which WAI-ARIA requires. |
| `chart.md` | No Agent instructions. §4 a11y is structurally shallow for a complex component: does not specify the `role="img"` + `aria-label` fallback contract, or the data table accessibility alternative. |
| `theme-switcher.md` | No Agent instructions. §7 does not test the system-preference sync (`prefers-color-scheme` media query path). |
| `wizard.md` | WIRE tier, no Agent instructions. §4 does not specify `aria-current="step"` on the active step indicator. |

The 20 specs missing Agent instructions are individually the most structurally thin — adding §8 content (even a brief paragraph citing the two universal anti-patterns) would make them conformant without a full rewrite.

---

## 4. Shared primitives that recur — candidates to specify once

These mechanisms appear by reference across many specs. All are correctly REFERENCED not RE-SPECIFIED. Listing them makes the single-specification rule explicit and confirms where each lives.

| Primitive | Specs that compose it | Where it should be fully specified |
|---|---|---|
| **Popover seam** (native `popover` + CSS Anchor Positioning) | `select`, `cascader`, `combobox`, `command`, `date-picker`, `dropdown-menu`, `context-menu`, `mentions`, `tooltip`, `hover-card`, `popover`, `time-picker`, `color-picker`, `tree-select` (14 specs) | Already specified in `select.md` §4 + the architecture contract §2.a. No standalone spec needed; confirm reference link in each spec's §4. |
| **`focus-trap.enhancer.ts`** | `dialog`, `alert-dialog`, `drawer`, `sheet`, `date-picker`, `color-picker` (6 specs) | Already specified in `dialog.md` §4. Architecture contract §2.a flags it as NET-NEW shared mechanism. |
| **`collection-nav.enhancer.ts`** | `select`, `combobox`, `command`, `tabs`, `menubar`, `navigation-menu`, `tree-select`, `tree-view`, `cascader`, `transfer` (10 specs) | Already specified in `select.md` §4. Architecture contract §2.a flags it as NET-NEW. |
| **Live-region announcer** | `toast`, `progress`, `loading-section`, `file-upload`, `tags-input` (5 specs) | Referenced in the architecture contract §2.a. Not yet specified in a canonical spec — the first overlay/status component to be implemented should write the canonical live-region setup once. Candidate: `toast.md` (it has the most detailed live-region contract already). |
| **Two-channel escaping** (`attrs` trusted-raw vs `dataAttrs`/`wireArgs` SAFE) | Applies to every WIRE spec and every PARTIAL that accepts per-row dynamic data | Specified in `button.md` §2 (the `wireClick`/`wireArgs` canonical example) + architecture contract §3. Consistent across all specs audited. |
| **`data-slot` / `data-variant` / `data-size` root attributes** | All 73 specs | Consistent. Specified in architecture contract §5. No standalone spec needed. |
| **`sr-only` + peer-visible label pattern** | `checkbox.md`, `radio-group.md`, `switch.md`, `input.md`, `field.md` (5 specs) | Not formally specified as a shared primitive; each spec re-states the pattern. Candidate to document once in `field.md` (the layout wrapper) as the canonical SR label pattern. |
| **`CollapsibleComponentIT` wire round-trip test pattern** | Referenced across all WIRE specs as the canonical integration test class | Specified in the repo CLAUDE.md. Not yet named explicitly in the spec template §7 — worth adding a one-liner in the template: "Wire round-trip: follow the `CollapsibleComponentIT` pattern (real `LievitRuntime` + real morph, not a mocked `$lievit`)." |
| **`@LievitProperty(locked=true)` server-config lock** | `calendar`, `data-grid`, `tags-input`, `combobox`, `select` (specs where server-config fields must not be client-injectable) | Specified in `select.md` §2 API table footnotes. Consistent where used; no standalone spec needed. |
| **OKLCH token authoring format** | All 73 specs (token values) | Specified in architecture contract §4 (D1 DECIDED). Most specs that introduce NET-NEW tokens correctly use OKLCH. `badge.md` is the one to check (it references existing `#f3f4f6` value — confirm it has the OKLCH form). |

---

## Summary fix priority

| Priority | Divergence | Effort |
|---|---|---|
| 1 | D2 — Section numbering: add/move §8 Agent instructions in 49 specs | High (bulk, mechanical) |
| 2 | D1 — Rename `neutral`/`danger` variants to `default`/`destructive` in 4 specs | Low |
| 3 | D4 — Remove false NET-NEW flags on warning/info/success tokens in 2 specs | Trivial |
| 4 | D3 — Fix `--lv-font-weight-*` to `--lv-font-*` in 3 specs | Trivial |
| 5 | D6 — Replace `--lv-color-muted` with `--lv-color-muted-bg` for fill roles in 4 specs | Low |
| 6 | D5/D8 — Document extended-size and component-dim-token patterns in `00-architecture-contract.md` | Low (one paragraph each) |
| 7 | Thin specs — add §8 Agent instructions to 20 specs, fill §4 a11y gaps in 8 specs | Medium |
