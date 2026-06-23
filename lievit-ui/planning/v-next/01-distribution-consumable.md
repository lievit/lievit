<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# 01 — Distribution: consumable by IMPORT (RFC 0036, the structural delta)

STATUS: blueprint, 2026-06-23. The DECISION is locked (RFC 0036, Francesco): the DEFAULT is non-copy-in
(import / dependency); copy-in (the `lievit add` CLI registry) stays as the OPTIONAL opt-out (shadcn model,
no vendor lock-in). This doc is the buildable plan to make import-by-default real, with the hard parts flagged.

Docs-first basis (verified 2026-06-23 via context7 `/casid/jte`): JTE supports precompiling templates from a
`sourceDirectory` and shipping a **self-contained jar with the precompiled `.class` (+ `.bin`) files**, loaded
at runtime by `TemplateEngine.createPrecompiled(ContentType.Html)` straight from the application classloader.
That is the mechanism the import path is built on. The blocker the RFC found ("lievit-ui ships no `.jte` in
any jar") is real but solvable; below is how.

## 0. The two channels, the two artifacts

lievit-ui has TWO kinds of source to distribute, and they ship through two different registries:

| Channel | What | Today (RFC 0036 finding) | v-next target |
|---|---|---|---|
| **JTE primitives** (PARTIAL `.jte` + WIRE `.jte` + the WIRE Java) | the server-rendered components | only in `registry/` as copy-in source; NOT in any Maven jar | a **published Maven jar** the adopter precompiles against (import) |
| **TS runtime** (`runtime/**` + the `*.enhancer.ts`) | the dependency-free client glue | only in `registry/`; `package.json` is `private:true`, no `exports`, no npm path | a **published npm package** with `exports` (import) |

Copy-in (`lievit add <component>`) stays for BOTH, as opt-out, unchanged in mechanism (ADR-0009 stays valid;
RFC 0036 demotes it from default to option). An adopter who wants to own + edit a component still runs the CLI.

---

## 1. JTE primitives as a precompilable jar artifact (the hard one)

### 1.a The target

`gest` (and any adopter) adds a Maven dependency on `io.github.lievit:lievit-ui:<version>` and gets the
primitive `.jte` templates resolvable at build + runtime WITHOUT copying them into `apps/gest/src/main/jte/`.
A change to a primitive = change it in lievit, publish, bump the pin (the upstream-first cycle of ADR
sw-construction-004 + RFC 0036). Today gest vendors copies that drift silently; this kills the drift.

### 1.b What JTE actually supports (docs-first, the load-bearing facts)

1. **Precompile from a filesystem `sourceDirectory`** via `jte-maven-plugin` `precompile` goal → emits
   template `.java`, javac-compiles to `.class` under a `targetDirectory` (`jte-classes`).
2. **Ship those `.class` (+ `.bin` for binary templates) inside a jar** ("self-contained JAR with
   precompiled templates", documented for Gradle; the Maven equivalent is adding `jte-classes` to the jar
   via `maven-resources`/`build-helper`).
3. **Load them at runtime** with `TemplateEngine.createPrecompiled(ContentType.Html)` — it reads the
   precompiled template classes from the **application classloader**, i.e. transitively from any jar on the
   classpath. This is the seam that makes a jar-shipped template resolvable by an adopter with NO copy.

### 1.c The two viable build paths (and which is canonical)

**Path A — lievit-ui ships its OWN precompiled templates in its jar; the adopter's engine finds them on
the classpath.**
- lievit-ui's Maven build precompiles `registry/jte/**` + `registry/wire/**/*.jte` to `jte-classes`, packs
  them into `lievit-ui.jar`.
- gest stays on `createPrecompiled(ContentType.Html)` (it already runs precompiled in prod for parity — the
  deploy lesson). At runtime gest's engine loads BOTH gest's own precompiled templates AND lievit-ui's from
  the classpath, because precompiled templates are just classes.
- **Hard part (flag)**: the template-NAME namespace. A precompiled template's class name is derived from its
  path under the `sourceDirectory`. gest references `@template.lievit.button(...)` → expects the template at
  `lievit/button.jte` in ITS source tree. For the jar's precompiled class to answer that name, the jar must
  precompile its templates under the SAME logical root (`lievit/...`, `kit/...`) the adopter references, and
  the two precompiled sets must not COLLIDE on class names. This needs verification on a spike: do two
  precompiled `jte-classes` sets (gest's + the jar's) coexist on one classpath without name clash, and does
  `createPrecompiled` resolve `lievit/button` to the jar's class? **This is the #1 build risk; spike it in
  Phase 0 before committing.**

**Path B — lievit-ui ships the `.jte` SOURCES as jar resources; the adopter precompiles them together with
its own, via a multi-root `sourceDirectory`.**
- lievit-ui.jar contains `src/main/jte/lievit/**` etc. as plain resources (`.jte` files under `META-INF` or
  a resources root).
- gest's `jte-maven-plugin` precompiles from a `sourceDirectory` that includes BOTH gest's templates AND the
  unpacked jar templates. The jar templates are unpacked (e.g. `maven-dependency-plugin:unpack` of the
  `.jte` resources into `target/jte-sources/lievit/...`) before precompile, then precompiled as one tree.
- **Hard part (flag)**: the unpack step is a build wart (RFC 0036 noted `jte-maven-plugin` precompiles from
  ONE filesystem `sourceDirectory`, no documented jar mode). It works (unpack → single root → precompile) but
  it is non-zero-config. It is also the SAFER path because the adopter compiles everything as one coherent
  tree (no two-precompiled-set collision risk of Path A).

**Recommendation**: spike BOTH in Phase 0. Path A is cleaner IF the namespace coexistence holds; Path B is
the reliable fallback (unpack-then-precompile is deterministic and a Makefile target hides the wart). Lock
the choice in an ADR (`sw-architecture-007`, the RFC's promotion target) after the spike. Do NOT pick from
first principles — this is exactly the "docs-first on the precompile config BEFORE executing" the RFC demands.

### 1.d The WIRE Java half (already solved)

The WIRE component Java classes (`<Name>Component.java`) already ship in the lievit-ui jar path via JitPack
(gest already pins lievit Java types this way — RFC 0036 Stadio 0). No change needed: the Java half is
import-native today. Only the `.jte` half is the gap, and §1.c closes it.

### 1.e The anti-shadow guard (RFC 0036 Stadio 3, KEEP)

A CI check FAILS if an adopter ships a `.jte` (or TS module) that SHADOWS a lievit primitive of the same
logical name. Default = consume-canonical; the escape-hatch (a genuine domain customization, or an adopter
who deliberately opted into copy-in for one component) is DECLARED explicitly (a marker comment / registry
entry), never a silent copy. This is the poka-yoke that makes "you cannot diverge in silence" true. It is
already active in gest (RFC 0036); v-next keeps it as the consumption contract for every `apps/*`.

---

## 2. The TS runtime as an npm package (the tractable one)

### 2.a The target

`gest` adds `@lievit/ui` (or `lievit-ui`) as an npm dependency, imports `startLievit` + the features +
the enhancers, and deletes `apps/gest/frontend/src/lievit/**`. The runtime is the kept DEPENDENCY (it always
was, per the server-first blueprint §1.c); npm is its canonical channel. JitPack=Maven-only was the historical
reason it was vendored; npm fixes that.

### 2.b The concrete build changes

- **`lievit-ui/package.json`**: flip `private:true` → publishable. Add:
  - `"name": "@lievit/ui"` (or the chosen scope), `"version"` (SemVer, see §2.d), `"license": "Apache-2.0"`,
    `"type": "module"`.
  - `"exports"` map: a main barrel (`startLievit` + `installAllFeatures`), plus subpath exports for the
    enhancers so an adopter imports only what it uses (tree-shakeable):
    ```json
    "exports": {
      ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
      "./features": { "import": "./dist/features/index.js" },
      "./enhancers/*": { "import": "./dist/enhancers/*.js" }
    }
    ```
  - `"files": ["dist"]`, `"sideEffects": false` (the runtime is mostly pure; the feature-install modules that
    register directives are the exception — mark those explicitly so tree-shaking doesn't drop a needed
    `installAllFeatures` side effect). **Flag**: audit which modules have register-on-import side effects
    before setting `sideEffects:false` globally; an over-broad `false` would tree-shake away the directive
    registrations. This is the #1 npm-packaging risk.
- **Build**: add a bundler/`tsc` build emitting `dist/` (ESM + `.d.ts`). The runtime is already
  dependency-free + strict-CSP-safe (ADR-0019), so the build is plain `tsc` (or `tsup`/`esbuild` for the
  barrel) with `declaration:true`. No transpilation gymnastics. Keep the 60-80 kb budget (ADR-0019); a
  bundle-size check in CI guards it.
- **Publish**: a `RELEASING.md`-driven `npm publish` (the repo already has a `RELEASING.md` for the Maven
  side; add the npm flow). [OPEN DECISION D4: publish to the public npm registry, or to GitHub Packages, or
  a git-dep pinned to a sha as the BRIDGE until npm-publish is set up? RFC 0036 names "a git-dep pinned or a
  re-vendor scripted+gated as the bridge". Recommendation: ship the git-dep-pinned bridge first (zero
  registry setup, unblocks gest immediately), then public npm once the package shape is stable. Flag for
  Francesco — it gates whether gest can de-vendor the runtime in the same cycle as the jte jar.]

### 2.c What does NOT change

The runtime CODE. ADR-0019's architecture (dependency-free, registry-based extension, bespoke morph) is
sound and untouched. This is purely a PACKAGING change: same modules, now with an `exports` surface + a
`dist` build + a publish step. The enhancers move under a clear `enhancers/` export subpath but keep their
behavior.

### 2.d Versioning

- **SemVer on the public surface**: the `exports` API (`startLievit` signature, the directive/lifecycle
  registry shapes, the enhancer module names) is the contract. A breaking change to it = major bump.
- **Lockstep with the jte jar**: the runtime version and the lievit-ui Maven jar version move together (a
  wire template that emits a new `l:*` directive needs the runtime that handles it). Document the
  compatibility matrix in `RELEASING.md`; a mismatched pair is a deploy footgun. [OPEN DECISION D5: same
  version number for both jar + npm, or independent SemVer with a documented compat matrix? Recommendation:
  same number (one release = one version across both artifacts) — simplest to reason about, matches "one
  release = one version" of the deploy lessons.]

---

## 3. Copy-in stays as the opt-out (ADR-0009 demoted, not deleted)

The `lievit add <component>` CLI + the `registry.json` manifest stay exactly as built. They are now the
OPT-OUT for an adopter who wants to OWN + edit a specific component (the shadcn no-vendor-lock-in value).
The default is import; copy-in is one CLI command away. No mechanism change — only the DEFAULT framing flips
(RFC 0036). The registry build (`build-registry.ts`) keeps producing `registry.json` from the registry tree;
the same tree is the precompile source for the jar (§1) — one source, two distribution channels.

---

## 4. The build-change summary (what's hard, ranked)

| Change | Difficulty | Risk |
|---|---|---|
| flip `package.json` private→public + `exports` + `dist` build | LOW | the `sideEffects` audit (could tree-shake away directive registration) — §2.b |
| publish runtime to npm (or git-dep bridge) | LOW-MED | registry/publish setup; the bridge defers it |
| precompile jte primitives into the lievit-ui jar | **MED-HIGH** | the template-NAME namespace coexistence (Path A) or the unpack-then-precompile wart (Path B) — §1.c, the #1 risk, spike in Phase 0 |
| adopter (gest) consumes jte from jar, deletes vendored copies | MED | bound to the precompile-path choice; per-stage, each green (RFC 0036 staging) |
| anti-shadow CI guard | LOW | already built in gest (RFC 0036 Stadio 3) |
| version lockstep jar↔npm | LOW | a documented compat matrix + RELEASING.md flow |

**The single gating spike (Phase 0)**: prove an adopter can precompile + render a lievit-ui primitive
resolved FROM THE JAR (not a copy), via Path A or Path B, with the gest-parity precompiled engine. Until that
spike is green, import-by-default for the JTE half is unproven. The npm half is low-risk and can ship first.

---

## 5. Open decisions for Francesco (distribution)

- **D4 — runtime publish channel**: public npm vs GitHub Packages vs git-dep-pinned bridge first.
  Recommendation: git-dep bridge now, public npm when stable.
- **D5 — version scheme**: single version across jar+npm vs independent SemVer + compat matrix.
  Recommendation: single version.
- **D6 — precompile path**: Path A (jar ships precompiled classes, classpath resolution) vs Path B
  (jar ships `.jte` sources, adopter unpacks + precompiles as one tree). Recommendation: spike both Phase 0,
  lock in the `sw-architecture-007` ADR; bias to B if A's namespace coexistence is shaky.
- **D7 — npm scope/name**: `@lievit/ui`? Confirm the npm org/scope (ties to the `io.lievit` Maven coordinates
  + the `lievit.io` domain — memory: lievit canonical ns is `io.lievit`, org `lievit`). Recommendation:
  `@lievit/ui`.
