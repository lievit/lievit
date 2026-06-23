<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 02 — Licensing: THE HARD GATE (settle before any component conversion starts)

STATUS: blueprint, 2026-06-23. lievit is a PUBLIC OSS repo under **Apache-2.0** (`LICENSE` at the repo root,
Apache License 2.0, January 2004). Every file already carries the `Copyright 2026 Francesco Bilotta /
Licensed under the Apache License, Version 2.0` header. This doc is the legal contract for adapting from
three named sources. **No component conversion (Phase 2) may begin until this gate is settled and the
provenance mechanism is in place.** This is a one-way door (public redistribution of code) — waterfall it.

This is engineering guidance grounded in the licenses' plain terms, not legal advice; the rule set is
deliberately conservative so the public repo is safe by construction. Where a call is genuinely ambiguous it
is flagged for Francesco (and, if he wants certainty, a lawyer — `legal-ops` is the skill that frames that).

## 0. The three sources, the three regimes (the one-paragraph truth)

| Source | License | What we may take | Obligation |
|---|---|---|---|
| **React Aria** (Adobe) | **Apache-2.0** | the a11y INTERACTION SPEC (keyboard maps, focus order, ARIA wiring) and, where we adapt actual code, the code itself | attribution + NOTICE + keep the Apache-2.0 license text for the adapted portion; Apache-2.0 → Apache-2.0 is clean |
| **Ant Design** (Ant Group) | **MIT** | the COMPONENT INVENTORY + feature/variant ideas, and adapted code where useful | attribution (preserve the MIT copyright + permission notice for any adapted code) |
| **Tailwind UI / Tailwind Plus** (Tailwind Labs) | **COMMERCIAL / proprietary** | **NOTHING copyable.** Only un-copyrightable visual CONVENTIONS (spacing rhythm, the general look of a "clean admin table") may inspire an ORIGINAL implementation | **its code/markup MUST NEVER be copied or redistributed.** Inspiration-only, original implementation, no paste. |

The whole gate reduces to one rule with one absolute exception:
**Apache-2.0 and MIT inputs are ADAPTABLE WITH ATTRIBUTION; Tailwind UI is INSPIRATION-ONLY, NEVER CODE.**

---

## 1. License-compatibility argument (why Apache-2.0 + MIT flow into lievit's Apache-2.0)

- **lievit is Apache-2.0.** Apache-2.0 is permissive: it allows redistribution of derivative works provided
  the license/notice obligations are met.
- **React Aria → lievit**: Apache-2.0 → Apache-2.0. This is the simplest possible case: same license. We
  retain the Apache-2.0 license text and the NOTICE attribution for any adapted portion. No conflict.
- **Ant Design → lievit**: MIT → Apache-2.0. MIT is more permissive than Apache-2.0; MIT code can be
  included in an Apache-2.0 work provided MIT's copyright notice + permission notice are preserved for the
  adapted code. This is a standard, well-trodden combination (Apache-2.0 projects routinely vendor MIT
  code with the MIT notice retained). No conflict.
- **Tailwind UI → lievit**: proprietary → Apache-2.0 is **INCOMPATIBLE for code**. Redistributing Tailwind
  UI's markup/code under Apache-2.0 in a public repo would be license violation + copyright infringement.
  Hence the absolute no-code rule. Only the IDEA of a visual convention (which is not copyrightable as
  such) may inform an original implementation.

**The directionality clamp (load-bearing)**: we only ever pull Apache-2.0 + MIT INTO lievit. We never need
to push anything out under a foreign license. So the only compatibility question is "can input license X be
included in an Apache-2.0 work?" — yes for Apache-2.0 + MIT (with notice), no for proprietary.

---

## 2. The attribution / NOTICE mechanics (concrete, buildable)

Apache-2.0 §4 requires that derivative works carry: (a) the Apache-2.0 license, (b) a NOTICE file's
attributions if the original had one, (c) prominent notices of modification. lievit's mechanism:

### 2.a A root `NOTICE` file (net-new, required)

Create `/NOTICE` at the repo root (Apache convention, sits beside `LICENSE`). It lists every adapted-from
source with its license + copyright:
```
lievit-ui
Copyright 2026 Francesco Bilotta

This product includes software adapted from:

- React Aria (https://github.com/adobe/react-spectrum)
  Copyright Adobe. Licensed under the Apache License, Version 2.0.
  Accessibility interaction patterns adapted; see per-component @provenance.

- Ant Design (https://github.com/ant-design/ant-design)
  Copyright Ant Group and contributors. Licensed under the MIT License.
  Component inventory and feature design adapted; see per-component @provenance.
```
The npm package (`package.json` → `files`) and the Maven jar both include `NOTICE`. The NOTICE propagates
to every adopter automatically (that is its job).

### 2.b A bundled `THIRD-PARTY-LICENSES` (the MIT text)

Because MIT requires its permission notice travel WITH the adapted code, ship the Ant Design MIT license
text (and the React Aria Apache notice, already covered by our LICENSE) under `licenses/` (e.g.
`licenses/ant-design-MIT.txt`). The NOTICE points to it. This satisfies MIT's "include the copyright +
permission notice" for any adapted Ant Design code.

### 2.c Per-component `@provenance` (the traceability record — the auditable unit)

Every v-next component's JTE header doc-comment (already mandatory, §3 of `00-architecture-contract.md`)
gains a REQUIRED provenance line stating what was adapted from where, e.g.:
```
@provenance a11y: WAI-ARIA APG Dialog + React Aria useDialog interaction spec (Apache-2.0, adapted).
            inventory: Ant Design Modal feature set (MIT, design-adapted).
            styling: ORIGINAL over --lv-* tokens; visual rhythm inspired by Tailwind UI (NO code copied).
```
This makes provenance a per-component, grep-able fact. The doc-header lint (extend the existing one) FAILS
a component whose header lacks `@provenance`. So provenance is not a hope; it is a gate. The same line is
the audit trail if a source's licensing is ever questioned: every component declares exactly what it owes.

### 2.d Modification notices (Apache §4.b)

Where we adapt React Aria code (not just its spec), the adapted file carries a one-line "adapted from React
Aria; modified by lievit" note in addition to the Apache header. For spec-only adaptation (we transcribe the
keyboard map / ARIA wiring into a JTE template + a vanilla enhancer, writing original code) the `@provenance`
line is the record; no code was copied, so no file-level modification notice is owed, but we still attribute
the SPEC in NOTICE + `@provenance` (courtesy + clean conscience, and it documents the a11y source for the
maintainer).

---

## 3. The Tailwind UI rule, spelled out (the bright line)

**Tailwind UI / Tailwind Plus is a paid, proprietary product. Its component code, HTML markup, and class
strings are copyrighted and licensed to the purchaser, NOT redistributable.** For a public OSS repo this is
the single most dangerous source. The rules, absolute:

1. **NEVER copy** Tailwind UI markup, class strings, or component code into lievit. Not "lightly edited",
   not "as a starting point". Zero paste.
2. **NEVER reference** a Tailwind UI file path, component name, or snippet in a commit, a spec, or a
   `@provenance` line as a CODE source. Tailwind UI appears ONLY as `styling: ... inspired by Tailwind UI
   (NO code copied)` — an inspiration note, never a code provenance.
3. **What IS allowed**: un-copyrightable visual CONVENTIONS — the general idea that an admin table has zebra
   rows + a sticky header + right-aligned numeric columns; that a form uses a 36px control height with an
   8px label gap; that a card has a subtle border + a soft shadow. These are functional/aesthetic
   conventions, not protected expression. We implement them ORIGINALLY over `--lv-*` tokens, deriving the
   ACTUAL markup from our own conventions (the `button.jte` house style) + the WAI-ARIA structure, NOT from
   Tailwind UI's HTML.
4. **The test for a reviewer**: "could this markup/class string be traced back to a Tailwind UI file?" If
   there is ANY doubt, it is rewritten from the token system + the APG structure. The burden of proof is on
   the contributor to show the implementation is original.
5. **An agent implementing a component is INSTRUCTED in its spec**: "style ORIGINALLY over `--lv-*`; you may
   read public react-aria + ant-design patterns from training knowledge; you must NOT reproduce Tailwind UI
   code — implement the visual intent from the token system." (This line is in the spec template,
   `04-component-spec-template.md`.)

[OPEN DECISION D8: does Francesco actually HAVE a Tailwind Plus license, and is the intent merely to LOOK AT
it for visual inspiration while implementing originally? That is legally fine (looking is not copying), but
it must be disciplined — looking-then-implementing-from-memory is the riskiest path for accidental copying.
Recommendation: treat Tailwind UI as a MOOD-BOARD reference only (overall density/polish target), implement
every pixel from `--lv-*` + APG, and never have a Tailwind UI file open in the same context as the
implementation. Flag for Francesco to confirm the discipline.]

---

## 4. The license gate as a CI check (poka-yoke, not memory)

Per repo doctrine, the rule lives at the most deterministic layer that can hold it:

| Gate | Check |
|---|---|
| every component header has `@provenance` | doc-header lint (extend existing), FAIL on missing |
| `NOTICE` + `licenses/` ship in jar + npm | a packaging test asserts both files are present in the artifact |
| no Tailwind-UI provenance as a CODE source | a grep gate: `@provenance` lines mentioning Tailwind only in the `styling: ... (NO code copied)` form; FAIL if Tailwind appears as an `a11y:`/`inventory:`/code source |
| (soft) a "tailwindui" / known-Tailwind-UI-class-pattern grep | a heuristic lint flags suspicious verbatim Tailwind-UI-shaped strings for human review (best-effort, not authoritative) |

The provenance lint is the load-bearing one: it makes "where did this come from?" answerable for every
component by `grep @provenance`, which is the whole point of the gate.

---

## 5. The conversion-start precondition (the gate, restated)

Before ANY component is implemented in Phase 2, ALL of these must be TRUE:
1. `/NOTICE` exists and lists React Aria (Apache-2.0) + Ant Design (MIT).
2. `licenses/ant-design-MIT.txt` (+ any other adapted-code license texts) exist.
3. The `@provenance` header field is mandated in the spec template AND the doc-header lint enforces it.
4. The Tailwind-UI-inspiration-only rule is written into the spec template's agent instructions.
5. The packaging test (NOTICE + licenses ship in both artifacts) is in CI.

This is a one-way door (public redistribution). It is settled ONCE, in Phase 0, and then every component
inherits a clean provenance record by construction.

---

## 6. Open decisions for Francesco (licensing)

- **D8 — Tailwind UI discipline** (above): confirm it is mood-board-only, original implementation, never a
  file open beside the implementation context.
- **D9 — adapt React Aria CODE vs SPEC-only**: do we ever transcribe actual react-aria TS into our
  enhancers (Apache→Apache, clean), or strictly re-implement from its documented spec? Recommendation:
  spec-only by default (cleaner provenance, and react-aria's React-coupled code rarely maps to our vanilla
  enhancers anyway); allow code-adaptation only where it demonstrably saves real work, with the
  modification notice (§2.d). Flag so the default is conscious.
- **D10 — do we want a lawyer pass on the NOTICE/attribution mechanics before the public PR?** This is a
  public OSS repo + a future authority asset (the case study / book funnel). Recommendation: the mechanics
  here are conservative + standard, so a lawyer pass is optional, but it is a cheap insurance for a public
  one-way door. `legal-ops` frames what to ask. Flag for Francesco's risk appetite.
