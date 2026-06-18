# ADR-0082: Fail loud on an unknown `l:` directive (validation poka-yoke)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

The client runtime's `DirectiveRegistry.bindElement` (`lievit-ui/runtime/directives.ts`) deliberately
**ignores** an `l:*` attribute whose name it does not recognize: a forward-compatible no-op, so a
template that uses a not-yet-loaded directive does not throw in the browser. The cost of that
leniency is silent breakage. A real adopter wrote, copied from lievit's own hello-admin example:

```html
<button l:model="x" l:value="${id}" l:click="arm">
```

`l:value` is **not** a lievit directive, and `l:model` binds an *input* listener that a `<button>`
never fires. The button armed nothing. The server-side ITs passed (they inject the model update
directly), so nothing failed: the bug shipped, invisible, all the way to the browser. The canonical
row-arm is the `$set` magic action in the value: `l:click="$set('field', value)"`.

This is the worst failure shape a framework can have: looks wired, tests green, dead at runtime, no
error anywhere. We want this class of bug to be **impossible**: an unknown `l:<name>` directive must
fail loudly, as early as we can make it.

The natural earliest point would be a build-time pass over the `.jte` template **bodies**. lievit has
no such pass today: `ComponentCompiler` reflects + caches at runtime; `LievitTagCompiler` parses only
`<lievit:...>` *mount tags*, not the `l:*` attributes on arbitrary elements; nothing walks template
bodies for directives at adopter build time. The `l:*` attributes are processed purely client-side.

## Decision

Ship the validator now at **application startup** (fail-fast), with the validation logic factored so
the true compile-time pass can reuse it verbatim later.

- **Pure validator in `lievit-compiler`** (Spring-free, the layer that already owns
  "parse/validate template source"): `DirectiveValidator` scans a template's source for
  `l:<name>[.modifiers]` attributes *inside start tags only* (never prose / URLs) and reports a
  `Violation` (template + line + offending `l:<name>` + an actionable hint) for every name not in the
  known set. It validates the directive **name + modifier structure**, never the **value**: a magic
  action (`l:click="$set(...)"`, `$refresh`, `$call`) lives in the value and the directive is
  `click` (valid). Modifiers (`.live`, `.enter`, `.500ms`, `.disabled`) are open per directive and
  are not enumerated. `wire:*` is out of scope (the tag compiler owns it).

- **Single source of truth for the valid set:** `DirectiveNames.BUILTIN`, a hand-mirrored copy of the
  client runtime registry (`runtime/directives.ts` builtins + `runtime/v4-directives.ts` +
  `runtime/features/*.ts` installers + the `runtime.ts` structural attrs), each entry annotated with
  the runtime source that registers it. The two cannot share a literal (Java vs TypeScript), so the
  drift is pinned by `DirectiveNamesParityTest`, which reads the TypeScript sources and asserts the
  Java set matches the runtime registry both ways (a new client directive that forgets the Java
  mirror, or a stale Java entry, fails the build). The parity test skips gracefully when the UI tree
  is not checked out (isolated module build).

- **Fail-fast startup bean in the starter:** `DirectiveTemplateValidator` (an `InitializingBean`)
  scans `classpath*:jte/**/*.jte` (configurable) via `PathMatchingResourcePatternResolver`, runs the
  pure `DirectiveValidator`, and throws `IllegalStateException` listing every unknown directive,
  failing the context refresh **before any request**. Wired in `LievitAutoConfiguration`, enabled by
  default ("it just works" when the starter is on the classpath), `@ConditionalOnMissingBean` so an
  app can replace it.

- **Config + escape hatch** (`lievit.directives.*`): `validate` (default `true`) toggles the check;
  `template-location` (default `classpath*:jte/**/*.jte`) sets the scan pattern; `extra` (default
  empty) allowlists app-registered custom directive names (`runtime.directives.register({name})`),
  which a static scan cannot see.

## Consequences

- The `l:value` class of bug now fails the boot with a precise message
  (`listing-list.jte:31: unknown lievit directive 'l:value': ... use l:click="$set('field', value)"`),
  on every environment, before traffic. Not compile-time, but a categorical improvement over a silent
  browser no-op, and it costs nothing on the request path.
- Zero-config for the common case: add the starter, get the check. An app with custom directives adds
  one line (`lievit.directives.extra=foo`); an app that wants it off sets `validate=false`.
- The valid set is mirrored, not shared, so it *can* drift; the parity test is the guard, and it is the
  honest residual risk if someone deletes the test or the UI tree is absent in a given build.
- The pure `DirectiveValidator` + `DirectiveNames` are the reusable core: the compile-time follow-up
  (a Maven mojo, or the CLI `doctor` check) feeds it the same `.jte` sources and gets the same
  diagnostics, with no logic duplicated.

## Follow-ups

- **True compile-time poka-yoke (preferred long-term):** a `lievit doctor` check or a Maven mojo that
  runs `DirectiveValidator` over the source `.jte` files at adopter build time, so the failure lands in
  the build, not the boot. Reuses this ADR's `DirectiveValidator`/`DirectiveNames` unchanged.
- **Runtime defense-in-depth (proposal):** the client `DirectiveRegistry.bindElement` could
  `console.warn` (dev mode) on an unknown `l:*` attribute instead of silently dropping it, catching the
  case of a directive added to a template the startup scan did not cover (e.g. server-pushed HTML). Out
  of scope here; noted for a future client RFC.

## Alternatives considered

**Make the client runtime throw on an unknown `l:*` attribute.** Rejected as the *primary* fix: it
trades silent-no-op for runtime-crash in the browser and breaks the forward-compatibility no-op that
lets a template reference a directive whose feature module is loaded later. A dev-mode `console.warn`
is the most it should do (see follow-up).

**Put the validator in the starter only (no `lievit-compiler` class).** Rejected: it would bind the
validation logic to Spring and to runtime classpath scanning, blocking the compile-time follow-up from
reusing it. The pure validator in the compiler module is the seam that makes both the startup check and
the future build-time check the same code.

**Enumerate modifiers too (`.live`, `.enter`, ...).** Rejected: modifiers are open per directive (any
key for `l:keydown`, any attr for `l:bind`, arbitrary `debounce.Nms`), so enumerating them would
produce false positives and need constant maintenance. Validating the bare name catches the entire
observed bug class.
