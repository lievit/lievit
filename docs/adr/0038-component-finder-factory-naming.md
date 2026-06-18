# ADR-0038: Component discovery, factory, and naming (Finder / Factory / component stack)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #183: Livewire's `Finder` + `Factory` + `LivewireManager` map a component *name* (`'foo.bar'`,
`<livewire:foo.bar>`) to a class, instantiate it with a generated id, and track a *current-component
stack* (parent/child) that `$parent` and nested-children rely on. lievit already had part of this:
`ComponentRegistry` resolves a *fully-qualified class name* (the wire `cls`) to a fresh
prototype-scoped instance, and `ChildRenderer` mounts declared children recursively with generated
ids. Two pieces were missing and are easy to get subtly wrong:

1. **The dotted-name convention.** Nothing mapped `foo.bar` (the authoring identity in a tag or
   route) to a class or to a default template path. Without it, every mount/tag/route had to spell
   the FQN.
2. **The current-component stack.** Children mounted recursively but no request-scoped record said
   "this is the component rendering now and that is its parent", so `$parent` and the
   deterministic-key view-path hashing (ADR-0023) had no parent to read.

## Decision

- **`ComponentNames`** (core, pure): the name convention in one tested place. `nameFor(type,
  template)` = the declared template with slashes lowered to dots, else the decapitalised simple
  class name with a trailing `Component` stripped (`UserTableComponent -> userTable`).
  `nameToPath` / `pathToName` are the dot&lt;-&gt;slash inverse (Livewire's `Finder` view-path
  convention).
- **`ComponentRegistry`** gains a dotted-name index built at startup: `resolveName(name)` (name or
  FQN -> FQN), `metadataByName`, `templatePath(name)` (the declared template, else the dot-to-slash
  default), and `nameOf(fqn)` (the inverse, to label a stack frame). Two components resolving to the
  same name is a **startup error**, not a silent race: the author gives one an explicit template.
- **`ComponentStack`** (core): a `ThreadLocal`-bound push/pop stack of `(name, id)` frames, bound
  around a render exactly like `LievitChildren` / `LievitEffects` / `DeterministicKeyScope` (cleared
  in a `finally`, nothing survives the call, ADR-0001). The top is the component rendering now; the
  frame beneath is its parent; a root has `parent() == null`.
- **Wiring.** `LievitWireService.mount` / `mountStamped` bind a stack and push the root frame around
  child substitution. `ChildRenderer.mountChild` generates the child id up front and pushes the child
  frame **before** the child's mount/render hooks run, so during a child's own mount
  `ComponentStack.parent()` is the component that declared it; popped in a `finally` so a sibling
  sees the right parent.

## Consequences

- A dotted name resolves to the right component and template by convention, with no per-component
  config; an ambiguous name fails loudly at startup.
- A nested mount records its parent, the foundation `$parent` and the deterministic-key view-path
  hashing build on. The stack is request-scoped and self-clearing, so it holds the ADR-0001
  statelessness invariant.
- **Scope.** This ADR lands the *resolution layer* (name -> class/template) and the *parent
  tracking*. The client-facing `$parent` magic object and `<lievit:foo.bar>` tag *authoring* sit on
  top of this and on the compiler (lievit-compiler, ADR-0023); they are unchanged here. The registry
  now accepts a dotted name anywhere it previously required an FQN, so the tag/route layers can adopt
  it without a wire-protocol change (the wire `cls` stays an FQN).
