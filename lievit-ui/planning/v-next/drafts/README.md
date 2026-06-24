<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->
# v-next drafts (deferred, not yet shippable)

Work-in-progress component re-forges that are NOT presentational-only primitives and
therefore do NOT belong in the presentational validation batch / the `jte-compile` gate.

## `tabs.wire.jte.draft` + `tabs.wire.meta.json.draft`

The v-next `tabs` spec (`planning/v-next/specs/tabs.md`) is a **WIRE** component, not a
static presentational primitive: the active tab is a server fact (`@Wire String activeTab`),
with `activate` / `closeTab` / `addTab` actions and an HTMX panel-swap path. An agent re-forged
the template accordingly, importing `io.lievit.wire.TabsComponent`, `io.lievit.wire.TabItem` and
`io.lievit.component.ComponentMetadata`.

It is parked here, not in `registry/jte/`, because:

1. **It needs Java backing that does not exist yet.** `TabItem` is not a class anywhere;
   the v-next `TabsComponent` (with the spec's locked properties + abstract `addTab` hook) is
   not written. The draft template references types that have no source.
2. **It collides with the existing wire tabs.** `io.lievit.wire.TabsComponent` already exists
   (`registry/wire/tabs/`, ADR-0012 Wave 2, server-first tabs). The re-forge must reconcile with
   that component — re-forge ITS template + styling + a11y — not introduce a parallel one.
3. **The `jte-compile` gate cannot validate it.** That gate mirrors only `registry/jte/**` +
   `registry/icons` onto the classpath (JDK + jte + icons). A wire template depends on
   lievit-core + the wire Java classes, which the gate deliberately does not compile. The wire
   tier has its own test harness (the `lievit-kit` wire tests), not this smoke.

`registry/jte/tabs.jte` therefore stays the existing presentational link-tab surface; the
WIRE re-forge belongs to the **wire workstream**, where the Java backing + collision resolution
+ wire test harness live. This draft preserves the agent's markup/styling/a11y work so it is not
re-done from scratch when that workstream picks it up.
