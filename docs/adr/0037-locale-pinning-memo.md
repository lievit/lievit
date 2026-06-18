# ADR-0037: Locale pinning across the stateless round trip (MessageSource + memo)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta
- **Issues:** #169, #143

## Context

A lievit component is stateless: every wire update is a fresh HTTP request whose locale Spring
resolves anew (from `Accept-Language`, a cookie, a session, per the configured `LocaleResolver`).
Without intervention, a multilingual gestionale renders the first page in the user's locale and then
every subsequent wire update reverts to the server default, because the AJAX request carries a
different (or no) `Accept-Language`. The component renders `it` once, then flips to `en` on the next
keystroke. It is a small but genuinely confusing, hard-to-diagnose bug.

Livewire's whole locale feature is two listeners: on `dehydrate` store `app()->getLocale()` in the
snapshot memo; on `hydrate` `app()->setLocale($memo['locale'])`. This pins the locale across the
round trip via the snapshot, with no server-side session.

lievit already has the seam ADR-0022 anticipated for exactly this: the lifecycle bus (`HYDRATE`,
`DEHYDRATE` phases) and the snapshot **memo** (the `@memo` bag the `WireDispatcher` round-trips,
HMAC-signed). The locale feature is the canonical first consumer of that memo.

## Decision

lievit pins the active locale across the round trip with a `LocaleListener` on the lifecycle bus,
mirroring Livewire's two-listener design and the existing `SessionListener` pattern:

- **`HYDRATE`**: read the language tag from the snapshot memo (`memo["locale"]`) and call
  `LocaleSource.set(Locale)` before client updates and the render run, so the template's
  `MessageSource` / JTE i18n resolves in the component's pinned locale, not the fresh request
  default.
- **`MOUNT` / `DEHYDRATE`**: read the active locale from `LocaleSource.get()` and store its
  language tag in the memo, so it rides the signed snapshot to the next request.

### Spring-free core, Spring-bound edge (ADR-0007)

The core stays Spring-free. The listener talks to a `LocaleSource` SPI (`get()` / `set(Locale)`),
bound for the duration of a wire call via a `ThreadLocal` (exactly like `SessionListener`'s
`SessionStore`). The starter binds `SpringLocaleSource`, the only class that knows about Spring's
`LocaleContextHolder` — the canonical Spring idiom for reading and changing the request-active
locale. When no source is bound (a pure-core unit test, or an app without web i18n), the listener
no-ops and the component still works statelessly (the locale just tracks the request default).

### Per-component, session-free

The pinned tag lives in the **memo**, not the HTTP session: it survives the round trip via the
signed snapshot, so it is per-component (two components on a page can pin different locales) and
needs no server-side state. The memo is HMAC-signed (ADR-0001), so the tag cannot be tampered.

### Wiring (where the source is bound)

- The wire-call endpoints (`/lievit/{id}/call`, `/lievit/update`, `/lievit/{id}/stream`) bind
  `SpringLocaleSource` next to `SessionListener`, cleared in the same `finally`.
- The page-mount funnel (`LievitPageRenderer.renderPage`) binds it around `mountStamped`, so the
  **first** snapshot already carries the locale memo and the first update can restore it.

## Consequences

- A component first rendered in `it` keeps rendering in `it` on every wire update, even when the
  update request asks for `en`. Message resolution (`MessageSource`) and validation messages follow
  the pinned locale.
- The memo grows by one short string (`"it"`); a component with no `LocaleSource` bound writes
  nothing, so the snapshot is unchanged for a non-web or non-i18n app (the Counter is byte-identical).
- `#169` and `#143` are the same feature at two altitudes (the cross-cutting idiom vs the
  persistence guarantee); one listener satisfies both.

## Alternatives considered

**Store the locale in the HTTP session.** Rejected: it breaks the per-component property (all
components on a page would share one locale), reintroduces server-side state lievit deliberately
avoids (ADR-0001), and does not survive a stateless horizontal scale-out. The signed memo is the
stateless, per-component answer.

**A dedicated annotation (`@LievitLocale`).** Rejected: it is an eighth annotation (ADR-0002 cap)
for a cross-cutting concern that needs no per-field opt-in. The listener applies uniformly.

**Resolve the locale fresh on every request (do nothing).** The status quo, and the bug. Rejected.

## Changed / new files

| File | Change |
|---|---|
| `lievit-core/.../component/LocaleSource.java` | NEW — the Spring-free SPI (`get`/`set`). |
| `lievit-core/.../component/LocaleListener.java` | NEW — the MOUNT/HYDRATE/DEHYDRATE listener. |
| `lievit-spring-boot-starter/.../SpringLocaleSource.java` | NEW — `LocaleContextHolder`-backed source. |
| `lievit-spring-boot-starter/.../LievitAutoConfiguration.java` | Registers `LocaleListener` on the bus. |
| `lievit-spring-boot-starter/.../LievitWireController.java` | Binds the source on the 3 wire endpoints. |
| `lievit-spring-boot-starter/.../LievitPageRenderer.java` | Binds the source around the page mount. |
