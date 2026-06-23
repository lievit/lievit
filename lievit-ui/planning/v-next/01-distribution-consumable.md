<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 01 — Distribution: ONE Maven artifact, consumed by IMPORT (RFC 0036)

STATUS: blueprint, 2026-06-23. **DECIDED (Francesco): lievit ships as a Java/Maven LIBRARY, not an
npm package.** The adopter (gest, or any Spring app) adds ONE Maven dependency and gets EVERYTHING:
the JTE primitive templates, the client JS runtime (served from inside the jar), and the WIRE Java
types. No npm. No copy-in by default. Copy-in (the `lievit add` CLI registry) stays as the OPTIONAL
opt-out (shadcn model, no vendor lock-in).

The DEFAULT is import: `io.github.lievit:lievit-ui:<version>` and you are done. The JTE half is
imported via **Path B**, PROVEN by the Phase-0 spike (below). The runtime ships as a pre-built JS
bundle resource INSIDE the same jar (webjar-style), served by lievit's Spring integration. So the
adopter gets templates + runtime + Java from ONE coordinate.

Docs-first basis (verified 2026-06-23 via context7 `/casid/jte`): JTE resolves template-to-template
calls (`@template.lievit.button(...)`) at the CALLER's compile time from the `.jte` SOURCE. A jar that
ships only precompiled `.class` files cannot satisfy a caller's `@template.lievit.*` reference, because
the caller's JTE compiler needs the `.jte` source to resolve the cross-template call. That single fact
is why Path A does not work and Path B does — see §1.

## 0. One artifact, three payloads (no second registry)

lievit-ui has three kinds of source to distribute. v-next ships ALL of them in ONE Maven jar:

| Payload | What | Today (RFC 0036 finding) | v-next target (in the ONE jar) |
|---|---|---|---|
| **JTE primitives** (PARTIAL + WIRE `.jte`) | the server-rendered components | only in `registry/` as copy-in source; NOT in any jar | the `.jte` **SOURCES shipped as jar resources**, unpacked + precompiled by the adopter (Path B) |
| **WIRE Java** (`<Name>Component.java`) | the typed server half | already import-native via JitPack | unchanged: normal Java classes in the jar |
| **Client runtime** (`runtime/**` + enhancers) | the dependency-free client glue | only in `registry/`; `package.json` `private:true` | a **pre-built JS bundle, shipped as a jar resource** (webjar-style), served by lievit's Spring integration |

There is no npm package and no separate JS registry to operate. The runtime is a build ARTIFACT
produced inside lievit's build and embedded in the jar; the adopter never touches a JS toolchain.

Copy-in (`lievit add <component>`) stays for the JTE + runtime source, as opt-out, unchanged in
mechanism (ADR-0009 stays valid; RFC 0036 demotes it from default to option). An adopter who wants to
OWN + edit a component still runs the CLI and gets the source copied into its tree.

---

## 1. JTE primitives by import: Path B, confirmed by the spike

### 1.a The target

`gest` (and any adopter) adds the Maven dependency and references `@template.lievit.button(...)` /
`@template.kit.table(...)` WITHOUT copying any `.jte` into `apps/gest/src/main/jte/`. A change to a
primitive = change it in lievit, publish, bump the pin (the upstream-first cycle of ADR
sw-construction-004 + RFC 0036). Today gest vendors copies that drift silently; this kills the drift.

### 1.b Why Path A (precompiled classes) does NOT work — the spike's finding

Path A would have lievit ship its templates as PRECOMPILED `.class` files and let the adopter's engine
find them on the classpath via `createPrecompiled`. The spike disproved it for our case:

- JTE resolves `@template.lievit.button(...)` at the CALLER's COMPILE time, from the `.jte` SOURCE of
  the called template. The adopter's `jte-maven-plugin` precompile pass needs `lievit/button.jte`
  present as source to generate the call site. A jar with only lievit's precompiled `.class` files does
  not expose that source, so the adopter's compile of its OWN templates cannot resolve the cross-jar
  `@template.lievit.*` call.
- `createPrecompiled` resolves a precompiled template the RUNTIME can render directly, but it does not
  make lievit's templates compose-able from the adopter's not-yet-compiled templates. The compose seam
  is compile-time, in the adopter's tree.

So precompiled-classes-in-the-jar is a dead end for a template LIBRARY whose templates are called by
the adopter's templates. The spike settled this empirically; do not relitigate from first principles.

### 1.c Path B (the confirmed model): the jar ships `.jte` SOURCES, the adopter precompiles them with its own

- **lievit-ui.jar contains the `.jte` SOURCES** as jar resources (under a resources root, e.g.
  `META-INF/lievit/jte/lievit/**` + `.../kit/**`).
- The adopter's build **unpacks** those `.jte` sources into its precompile source tree
  (`maven-dependency-plugin:unpack` → `target/jte-sources/lievit/...`, `kit/...`) BEFORE the JTE
  precompile goal runs.
- The adopter's `jte-maven-plugin` precompiles ONE coherent `sourceDirectory` that includes BOTH its
  own templates AND the unpacked lievit templates. Everything compiles as one tree; the adopter's
  `@template.lievit.button(...)` resolves against the unpacked `lievit/button.jte`. In prod the adopter
  runs precompiled (gest already does, for parity — the deploy lesson).
- **Namespace coexistence is a NON-ISSUE.** Each logical root (`lievit/`, `kit/`, the adopter's own)
  becomes a Java SUB-PACKAGE of the generated template classes. `lievit/button.jte` →
  `gg.jte.generated...lievit.JtebuttonGenerated`; the adopter's `home/dashboard.jte` →
  `...home.Jte...`. Different packages, no class-name collision. The two-precompiled-set collision that
  worried Path A simply does not arise, because there is only ONE precompile pass over one tree.

### 1.d The build step (deterministic, hideable)

The unpack-then-precompile is the one extra build step. It is fully deterministic (unpack the jar's
`.jte` resources → single source root → precompile → done) and hidden behind a **Maven profile / Make
target** so the adopter does not hand-wire it:

- a `lievit-import` Maven profile binds `maven-dependency-plugin:unpack` (lievit's `.jte` resources) to
  `generate-sources`, just before `jte-maven-plugin:precompile`.
- a `make code-docs`-style target (or the adopter's existing precompile step) drives it; the wart is a
  one-time config, not a per-build manual action. Lock the precise binding in the ADR
  (`sw-architecture-007`, the RFC's promotion target).

### 1.e The WIRE Java half (already solved)

The WIRE component Java classes (`<Name>Component.java`) already ship in the jar (gest already pins
lievit Java types via JitPack — RFC 0036 Stadio 0). No change: the Java half is import-native today.
Only the `.jte` half needed the spike, and §1.c closes it.

### 1.f The anti-shadow guard (RFC 0036 Stadio 3, KEEP)

A CI check FAILS if an adopter ships a `.jte` (or runtime module) that SHADOWS a lievit primitive of
the same logical name. Default = consume-canonical; the escape-hatch (a genuine domain customization,
or an adopter who deliberately opted into copy-in for one component) is DECLARED explicitly (a marker
comment / registry entry), never a silent copy. This is the poka-yoke that makes "you cannot diverge
in silence" true. It is already active in gest (RFC 0036); v-next keeps it as the consumption contract
for every `apps/*`.

---

## 2. The client runtime: a jar-served JS bundle (no npm)

### 2.a The target

`gest` gets the client runtime from the SAME Maven dependency. lievit's Spring integration serves the
pre-built bundle as a static resource (webjar-style: a `/lievit/lievit-runtime.js` route, or a
`classpath:/META-INF/resources/lievit/` mapping picked up by Spring's resource handling). gest's
template includes `<script src="/lievit/runtime.js">` (or imports it via its existing bundler if it
prefers), and deletes `apps/gest/frontend/src/lievit/**`. No `@lievit/ui` npm dependency, no copy-in.

### 2.b The concrete build changes

- **lievit's build produces the bundle as an artifact**: the existing TS sources (`runtime/**` +
  the `*.enhancer.ts`, dependency-free + strict-CSP-safe, ADR-0019) are built with `tsc`/`esbuild`
  into ONE ESM bundle, emitted into lievit's Maven resources (`src/main/resources/META-INF/resources/
  lievit/`) BEFORE the jar is packaged. Keep the 60-80 kb budget (ADR-0019); a bundle-size check in
  CI guards it.
- **lievit ships a tiny Spring auto-config** (or documents the resource mapping) so the adopter gets
  the `/lievit/*.js` route by adding the dependency — webjar ergonomics without the webjar packaging
  ceremony.
- **the runtime CODE does not change.** ADR-0019's architecture (dependency-free, registry-based
  extension, bespoke morph) is sound and untouched. This is purely a DELIVERY change: same modules,
  now built into a jar-embedded bundle instead of a vendored `frontend/src/lievit/**` tree.
- **`package.json` stays `private:true`.** It is the build manifest for producing the bundle, not a
  published package. No npm publish, no `exports` map to maintain, no public npm scope.

### 2.c Versioning — one version, one artifact

There is now ONE artifact (the Maven jar) carrying templates + runtime + Java, so there is ONE version.
A wire template that emits a new `l:*` directive ships in the same jar as the runtime that handles it,
so they can never drift apart. SemVer on the public surface: the `@template.lievit.*` names + `@param`
shapes, the WIRE Java types, and the runtime's directive/lifecycle registry shapes are the contract; a
breaking change to any of them = a major bump. The jar-only model retires the jar↔npm compat-matrix
problem entirely (it was an artifact of two registries; there is now one).

---

## 3. Copy-in stays as the opt-out (ADR-0009 demoted, not deleted)

The `lievit add <component>` CLI + the `registry.json` manifest stay exactly as built. They are now the
OPT-OUT for an adopter who wants to OWN + edit a specific component (the shadcn no-vendor-lock-in
value). The default is import (the Maven jar); copy-in is one CLI command away, copying the `.jte` +
the enhancer source into the adopter's tree. No mechanism change — only the DEFAULT framing flips
(RFC 0036). The registry build (`build-registry.ts`) keeps producing `registry.json` from the registry
tree; the SAME tree is the source for the jar's bundled `.jte` resources (§1) and the bundled runtime
(§2) — one source, packaged once.

---

## 4. The build-change summary (what's hard, ranked)

| Change | Difficulty | Risk |
|---|---|---|
| ship lievit's `.jte` SOURCES as jar resources | LOW | packaging-only (resources root) |
| build the runtime into a jar-embedded JS bundle + serve it (Spring resource/auto-config) | LOW-MED | the resource mapping + the bundle-size budget — §2.b |
| adopter unpacks lievit `.jte` + precompiles as ONE tree (Path B, behind a Maven profile / Make target) | MED | the unpack→single-root→precompile binding; deterministic, hide it in a profile — §1.d |
| adopter (gest) consumes from the jar, deletes vendored `.jte` + `frontend/src/lievit/**` | MED | per-stage, each green (RFC 0036 staging); bound to the Path-B build wiring |
| anti-shadow CI guard | LOW | already built in gest (RFC 0036 Stadio 3) |

**The Phase-0 spike (DONE): proven** an adopter can unpack + precompile + render a lievit-ui primitive
resolved FROM THE JAR (not a copy) via Path B, with the gest-parity precompiled engine. Path A
(precompiled classes) was tried and rejected (§1.b). The runtime-from-jar half is low-risk and can
ship alongside.

---

## 5. Open decisions for Francesco (distribution)

- **D4 — DECIDED**: lievit ships as ONE Maven/Java library; the client runtime is a jar-served JS
  bundle (webjar-style), NOT a separate npm package. No npm.
- **D6 — DECIDED by the spike**: the JTE half imports via **Path B** (jar ships `.jte` sources, adopter
  unpacks + precompiles them with its own as one tree). Path A (precompiled classes) does not work —
  JTE resolves template-to-template calls at the caller's compile time from `.jte` source. Lock in ADR
  `sw-architecture-007`.
- **D5 — CLOSED by D4**: there is ONE artifact, so ONE version; the jar↔npm compat-matrix question is
  retired (no npm).
- **D7 — CLOSED by D4**: no npm scope to choose. The Maven coordinates stay `io.github.lievit:lievit-ui`
  (the `io.lievit` namespace, org `lievit`, domain `lievit.io` — memory: lievit canonical ns is
  `io.lievit`).
