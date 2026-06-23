<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 04 — Component spec template (the unit an implementation agent executes against)

STATUS: blueprint, 2026-06-23. A v-next component spec is the contract SLICE one Phase-2 agent needs to
implement ONE component against the shared architecture contract (`00-architecture-contract.md`), with no
further questions. A complete, reviewable spec is what makes the parallel fan-out DETERMINISTIC: the agent
writes the implementation, not the design. Three filled exemplars follow in `specs/` (button = trivial,
select = complex-a11y, dialog = overlay), spanning the difficulty range.

A spec is REVIEWED + approved by Francesco at the Phase-1 checkpoint BEFORE its component is implemented. The
spec is the porta-a-senso-unico (the design is the irreversible part); the implementation against it is the
reversible part the agent ships.

---

## The template (copy this into `specs/<component>.md`)

```markdown
# Spec — <component>

- **tier**: PARTIAL | WIRE | HTMX | (+ENH if a typed-TS enhancer is needed)
- **priority**: P0 | P1 | P2
- **status (current)**: COVERED (re-forge of registry/jte/<name>.jte) | NET-NEW
- **@provenance**:
    - a11y: <WAI-ARIA APG pattern> + <React Aria hook spec, Apache-2.0, adapted | BUILT against raw APG>
    - inventory: <Ant Design component, MIT, design-adapted | none>
    - styling: ORIGINAL over --lv-* tokens; visual rhythm inspired by Tailwind UI (NO code copied)

## 1. What it is (one paragraph)
The job of the component, the decision rule for its tier, and why server-first works for it.

## 2. API — params / props (the typed surface)
A table: param · type · default · meaning. Mirrors the JTE @param shape (or the @Wire fields for WIRE).
- For PARTIAL: the @param list incl. content/leading/trailing/footer slots, the two escaping channels
  (attrs trusted-raw vs dataAttrs/wireArgs escaped) where a per-row action is possible.
- For WIRE: the @Wire fields (state), the @LievitProperty(locked=true) server-config, the @LievitAction
  methods, the @LievitRender hook; AND the template @param list (one per @Wire field + _component + _instance).

## 3. Variants / sizes / states
- variants: the INTENT vocabulary (shared library set), mapped to token pairs.
- sizes: sm|md|lg, height-based, the --lv-space token per size (toolbar-aligned).
- states: disabled, hover, focus-visible (--lv-ring), aria-invalid, aria-busy (runtime-managed for wire),
  and the stateful state (open/selected/value for WIRE) reflected into ARIA.

## 4. The a11y contract (the heart — non-negotiable, fully specified)
- **WAI-ARIA pattern**: name it (e.g. "APG Dialog, modal").
- **roles + ARIA**: every role / aria-* the template emits, and the state each reflects.
- **keyboard map**: the EXACT keys (Tab, Enter, Space, Esc, ArrowUp/Down/Left/Right, Home, End, typeahead),
  what each does, and WHO supplies it (platform native element vs the typed-TS enhancer). One row per key.
- **focus management**: initial focus, focus order, trap (if overlay), restore-on-close, roving-tabindex (if
  collection). State which enhancer owns it (focus-trap / collection-nav) or "platform".
- **live region**: if it announces (status/error/toast).
- **the shared mechanism it composes**: popover seam / focus-trap / collection-nav / announcer (do NOT
  re-implement; compose the one source — architecture contract §2.b / inventory §4).

## 5. Tokens
The --lv-* tokens it reads. Any NET-NEW token proposed (justified, additive, goes in :root + .dark).
No literal colours, ever.

## 6. Wire actions (WIRE/HTMX only)
- the l:* directives the template binds (l:click="action", l:model="field", l:keydown.enter, $set('f','v')).
- the server action signatures + what they mutate; validation + authz happen in Java BEFORE state mutates.
- the round-trip: which click → which action → what re-renders.
- the enhancer's wire-action wiring if +ENH (the directive it registers, the action it fires on which gesture).

## 7. Acceptance tests (the gate — refute-by-default)
The component is DONE only when ALL pass, on a REAL substrate (not a mocked one — the client-island-fidelity
lesson). Each row is a concrete assertion:
- **render** (jsdom for PARTIAL / real LievitRuntime for WIRE / Playwright for gesture): the observable DOM/
  text is asserted (e.g. "the dialog body content is visible after open", not "the template has a body div").
- **axe-core**: zero violations of the cited APG rules on the rendered DOM.
- **keyboard**: each key in the §4 map does what the map says (assert the observable outcome).
- **focus**: trap holds / restores / roving moves, where §4 specifies it.
- **variants/sizes**: each renders the right token classes + data-variant/data-size.
- **wire round-trip** (WIRE): a real-runtime IT (the CollapsibleComponentIT pattern) — mount → interact →
  re-render asserts the new state's DOM.
- **JTE compiles + renders**: covered by the test/jte-compile real-compiler + render gate.
- **escaping** (where a per-row action exists): a hostile dataAttrs/wireArgs value renders inert (the XSS
  abuse-case from button.jte).

## 8. Agent instructions (the discipline reminders, verbatim in the spec)
- Style ORIGINALLY over --lv-* tokens. You MAY read public react-aria + ant-design patterns from training
  knowledge. You MUST NOT reproduce Tailwind UI code/markup/class-strings — implement the visual intent from
  the token system + the APG structure. (Licensing gate, 02-licensing.md §3.)
- Compose the ONE shared a11y mechanism (popover seam / focus-trap / collection-nav); do NOT hand-roll it.
- Mirror button.jte's house conventions exactly (header doc-comment incl. @provenance, typed @param,
  data-slot, the two escaping channels, zero <script>).
- Minimal code to GREEN against the acceptance tests; refactor only while green.
```

---

## How a spec is sized (so reviewing 60 of them is tractable)

- A **PARTIAL** spec is short (button-grade): API + variants + a platform-a11y line + render/axe tests.
- A **WIRE** spec is medium: + the @Wire/@LievitAction surface + the wire round-trip + the real-runtime IT.
- A **+ENH** spec is the longest (select/dialog-grade): + the keyboard map the enhancer implements + the
  focus management + the shared-mechanism composition. These get the most review attention; they are where a
  naive fan-out diverges.

The Phase-1 checkpoint reviews the ~32 P0 specs first (the golden path), in batches, before any P0
implementation; P1/P2 specs follow. A spec that composes a shared mechanism is only approvable AFTER that
mechanism (popover seam / focus-trap / collection-nav) is itself specced + built (Phase 0), so the
dependency order is real, not nominal.
