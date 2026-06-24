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

## `popover.wire.*` + `modal.wire.*` + `dropdown-menu.wire.*` (Wave 5, deferred)

The v-next specs for the overlays (`popover.md`, `dialog.md`, `dropdown-menu.md`) designed them as
**WIRE** components (server-authoritative `@Wire open` state + `l:click` directives + a component
snapshot). Agents re-forged them to that surface. Parked here, not shipped, because:

1. **No Java backing exists** (PopoverComponent / DialogComponent / DropdownMenuComponent) and the
   wire behavior is inert without it — shipping a non-functional WIRE template is worse than the
   working PARTIAL it replaces.
2. **It breaks working consumers.** `blocks/app-shell.jte` + `data-table/column-visibility.jte` use
   the existing PARTIAL overlay API (Content `trigger`/`content` slots, native `[popover]`, zero-JS).
   Migrating them to a WIRE API with no backing is a regression (working → broken).
3. **It is over-engineering for most overlays (Appropriate Complexity).** A popover / dropdown-menu /
   hover-card / context-menu open state is **ephemeral CLIENT state** — there is no business reason to
   round-trip the server to open one. React-Aria itself is client-driven. The shared
   `popover-anchor.enhancer.ts` + `collection-nav.enhancer.ts` already provide the client behavior on
   the PARTIAL model. WIRE is only justified where the panel CONTENT is fetched-on-open (a lazy modal).

**OPEN DECISION FOR FRANCESCO — overlay tier.** Should the overlays be:
(a) **client-enhancer PARTIAL** (keep the existing zero-JS native-popover + enhancers, re-forge only
    the markup/styling/a11y to v-next; consumers keep working) — recommended for popover, dropdown-menu,
    context-menu, hover-card, tooltip; OR
(b) **WIRE** (server `open` state + Java component) — only where the open action does real server work.

The enhancer extensions the dropdown agent flagged (collection-nav submenu ArrowRight/ArrowLeft;
popover-anchor `data-lv-wire-close="<action>"` instead of a hardcoded `close()`) belong to whichever
tier is chosen. These drafts preserve the WIRE markup/a11y if (b) wins; the PARTIAL re-forge is a
fresh small wave if (a) wins.
