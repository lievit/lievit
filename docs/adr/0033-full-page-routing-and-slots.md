# ADR-0033: Full-page routing + layout wrapping, and server-side slots

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

> **ADR numbering note.** This server/engine P1/P2 work claims **0032–0033**. The sibling client
> branch claims 0024–0029 and may add 0034+. These two are server-only.

## Context

Two composition/routing items remained after the per-feature pass:

- **#63/#181 — full-page routing + layout wrapping.** ADR-0031 added the `@LievitLayout` /
  `@LievitTitle` declarations and the core `PageComponent` reflector, but left the *web wiring* unbuilt:
  nothing mapped a component to a URL, mounted it as a full page, wrapped it in its layout, or bound
  route params. Livewire's `Route::livewire($uri, Component::class)` macro points a route at one
  shared `LivewirePageController` that mounts + renders the component inside the layout and binds path
  variables (incl. implicit route-model binding).
- **#91 — slots.** A parent passes named + default content into a child, rendered in the *parent's*
  scope (a button in a slot mutates the parent, not the child), and the content survives child
  re-renders. New in Livewire v4 (`SupportSlots`).

## Decision

### Full-page routing — `@LievitPage`, a shared RouterFunction, the layout SPI

- **`@LievitPage("/post/{slug}")`** (new type annotation) maps a component to a route. `PageComponent`
  now also reflects it (`route()`), so the core only *declares* the mapping; the web layer wires it.
- **`LievitPageRoutes`** scans the `@LievitComponent` beans, and for each carrying `@LievitPage`
  registers a `GET` on a single `RouterFunction` (the lievit `Route::livewire` + `LivewirePageController`).
  The handler extracts the route's path variables and passes them as **props**, which seed the
  component's same-named `@Wire` fields before mount (the lievit analogue of implicit route-model
  binding; `WireField.write` coerces the raw string to the field type). An app with no `@LievitPage`
  component gets an empty router (the bean is harmless).
- **`LievitPageRenderer`** mounts the component (seeding the props), reads its `@LievitLayout` /
  `@LievitTitle` via `PageComponent`, stamps the top-level wire markers on the component root
  (`LievitWireService.mountStamped` → `ChildRenderer.stampRoot`, so the client hydrates a route-target
  component the same way it hydrates an embedded one), and wraps it via the **`LayoutRenderer` SPI**.
  The default `DefaultLayoutRenderer` ships a minimal valid HTML5 document (title set, layout recorded
  as `data-lievit-layout`); a host that wants its real app shell provides its own `LayoutRenderer`
  bean and renders the layout with its own view engine. The component stays adapter-agnostic; the
  layout is the host's concern.

### Slots — a `LievitSlots` proxy + parent-rendered fragments substituted by the web layer

The slot content is **rendered by the parent in the parent's scope** (so its state/events stay
parent-owned) and passed into the child declaration: `LievitChildren.child(key, class, props, slots)`
where `slots` is a `Map<name, parentHtml>` (`"default"` = unnamed). On the child render the web layer
binds a `LievitSlots` proxy (`bindFor`/`clearFor`, a request-scoped `ThreadLocal` like `LievitChildren`
/ `LievitEffects`); the child positions a slot with `slots.get(name)` / `slots.slot()` (returning a
`<!--lievit:slot:name-->` placeholder) and tests presence with `has(name)`. `ChildRenderer` then
substitutes each placeholder with the parent HTML wrapped in `<!--lievit:slot-start:name-->` …
`<!--lievit:slot-end:name-->` fragment markers, so the client can match and morph the slot as a
distinct region keeping parent ownership. A slot the child positioned but the parent did not supply
collapses to nothing; a slotless child binds an empty proxy and is unaffected. Because the parent
re-supplies the fragments on every re-render (the slot HTML is recomputed in the parent's render),
slots survive the child's re-render with the parent's current state.

## Consequences

- One new annotation (`@LievitPage`); `PageComponent` gains `route()`. The core stays Spring-free: the
  routing/layout wiring lives entirely in the starter (`LievitPageRoutes`, `LievitPageRenderer`,
  `LayoutRenderer`/`DefaultLayoutRenderer`).
- `ChildComponent` gains a `slots` field (a 3-arg convenience constructor keeps existing call sites);
  `LievitChildren` gains a slots overload; `LievitSlots` is a new core proxy. No protocol surface: a
  slot is parent-rendered HTML substituted into the child markup, never a new snapshot key.
- The full-page client glue (the markers) and the slot fragment markers are the contract with the
  sibling client bundle (the client matches slot fragments by name + component + parent).

## Alternatives considered

**Full-page layout via the template adapter rendering the layout template directly.** Rejected: the
adapter renders a *component's* template; a layout is the host app's shell, best rendered by the
host's own view engine. The `LayoutRenderer` SPI keeps lievit out of the host's layout concern while
shipping a working default.

**Slots as a child snapshot key (carrying the rendered content in the child's state).** Rejected: the
content is the parent's, not the child's; putting it in the child snapshot would violate ADR-0001's
per-component statelessness and let a client tamper with parent-owned markup. Re-supplying the slot
fragments from the parent's render each cycle keeps ownership where it belongs.
