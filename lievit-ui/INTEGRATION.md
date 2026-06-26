<!--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").
-->

# lievit integration contract

This is the **consumer contract**: everything a host application must provide for lievit to work,
documented so you integrate from this page, not from lievit's source. If a deployment of lievit
breaks, it is almost always one of the three things below: the **Content-Security-Policy** does not
grant what the wire/scripts need, the **navigation** model was misunderstood (cross-origin auth put
behind a fetch), or the **runtime boot** order is wrong.

lievit is "Livewire for Spring": server-rendered HTML over the wire, type-safe JTE components, a
strict-CSP-clean client runtime. It assumes a same-origin backend and a Spring-style CSRF token.

---

## 1. Content-Security-Policy

lievit is designed to run under a **strict CSP** with no `unsafe-inline` and no `unsafe-eval`. The
client bundle is `eval`-free and `new Function`-free, and ships **zero inline scripts**. Your CSP
must, at minimum, grant:

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self';
  connect-src 'self';
  form-action 'self';
  img-src     'self' data:;
  style-src   'self';
```

What each directive is for, and why:

| Directive | Why lievit needs it |
|---|---|
| `script-src 'self'` | The runtime + components load as ordinary same-origin module scripts. **No** `unsafe-inline`/`unsafe-eval` is required: lievit never `eval`s and emits no inline `<script>`. If your page injects an inline bootstrap, use a **nonce** (lievit forwards the page nonce to any DOM it creates, ADR-0081) - never `unsafe-inline`. |
| `connect-src 'self'` | The **wire** is a same-origin `fetch`: `POST /lievit/{componentId}/call` (`Content-Type: application/json`). Streaming (`l:stream`) is a same-origin `POST /lievit/{id}/stream`; broadcast/live is a same-origin `EventSource`. All same-origin, so plain `'self'` covers them. **Do not** route the wire through another origin - see §2. |
| `form-action 'self'` | Every native `<form>` (login, search GET, any non-wire mutation) submits to your own origin. This is the load-bearing reason navigation is native by default (§2): a real POST is governed by `form-action`, **not** by `connect-src`. |
| `img-src 'self' data:` | Icons are inlined SVG / data URIs from the jar (lucide-static); no external image host is required. Add hosts only for your own content (avatars, brand logo) if they are off-origin. |
| `style-src 'self'` | Token stylesheet + component styles are same-origin. lievit sets no inline `style` attributes that violate a strict policy; dynamic per-element CSS variables ride on `style` attributes the browser allows under `style-src` (they are not inline `<style>` blocks). If your policy is `style-src 'self'` without `unsafe-inline` and you see violations, allow element `style` via a nonce or hash on the stylesheet, not `unsafe-inline`. |

The strict-CSP posture is not optional polish: it is the security property lievit chose Stimulus over
Alpine for (Alpine's inline expression eval fights a no-`eval` policy). Keep `'unsafe-eval'` **out**.

---

## 2. Navigation (and the cross-origin / auth guidance)

**The default is native browser navigation.** A link is a real `<a href>`; a form is a real
`<form method="post">`. The browser navigates; there is no client framework in the path. This is
robust, zero-JS, CSP-clean, and has no cross-origin trap. lievit's actual value - the **wire**
(partial component re-render: `fetch` + idiomorph morph) - is independent of full-page navigation and
works with or without any SPA layer.

**SPA-feel is opt-in, per link, via `l:navigate`.** If you want the no-reload-flash / scroll-restore
/ prefetch feel on some links, mark them:

```html
<a l:navigate href="/contacts">Contacts</a>   <!-- SPA-navigated -->
<a href="/logout">Log out</a>                  <!-- plain native navigation -->
```

`l:navigate` is a thin alias over Turbo Drive's documented **opt-in** mode. Under the hood lievit
mounts Turbo lazily on the first `l:navigate` it sees and sets `Turbo.session.drive = false`, so Drive
hijacks **nothing** globally - only elements carrying `l:navigate` (which sets `data-turbo="true"`)
are upgraded. A page with no `l:navigate` never even loads Turbo. The consumer writes `l:navigate` and
never touches Turbo; if the engine is ever swapped, the markup does not change.

> Why this matters: an earlier lievit booted Turbo Drive globally as an import side-effect, which
> hijacked **every** same-origin link and turned the login form POST into a Drive `fetch` that
> `connect-src` blocked. Opt-in navigation removes that whole bug class.

### Cross-origin and authentication: do NOT put it behind the wire

The single most important navigation rule: **authentication and any cross-origin hop must be a real
top-level navigation, never a wire `fetch` and never an `l:navigate` SPA visit.**

- The wire (`connect-src 'self'`) can only reach your own origin. If you point an auth call at an
  external IdP through a `fetch`/XHR, the browser blocks it on `connect-src` - the "connect-src trap".
- A real navigation (a top-level redirect, a `<form action>` submit, a plain `<a href>`) is governed
  by **navigation** directives (`form-action` / `default-src`), not `connect-src`, and may cross
  origins. So make the auth round-trip a navigation.

**The SSO interstitial pattern** (the canonical way to do cross-origin SSO under strict CSP):

1. The protected page, when unauthenticated, does a **full-page redirect** (302 / `<a href>` /
   `<form>` submit) to the IdP. This is a navigation, so the cross-origin hop is allowed.
2. The IdP authenticates and redirects back to a **same-origin interstitial** endpoint on your app
   (the callback). The token exchange and session establishment happen **server-side**, on your
   origin.
3. The interstitial completes the session and then **navigates** the user to the destination page.

Because every step is a navigation to-and-from your origin, nothing ever crosses `connect-src`, and a
form-login POST is governed by `form-action 'self'`. Keep `l:navigate` **off** auth links (a login
link, an IdP redirect, a logout): they must stay native so the redirect is a real navigation. The
wire is for in-page partial updates **after** the user is authenticated, talking only to your origin.

---

## 3. Runtime boot

Boot the runtime once from your `main.ts`, **in this order**: start the lievit runtime (registering
the client features, including the `l:navigate` directive), then start the single Stimulus
application that drives the interactive islands.

```ts
import { startLievit } from "lievit-ui/runtime";
import { installAllFeatures } from "lievit-ui/runtime/features";
import { startStimulus } from "lievit-ui/runtime/stimulus";

// 1) Start the wire runtime and register all client features BEFORE the first DOM scan.
//    The register callback runs before start() scans the document, so first-paint directives
//    (l:init, l:navigate, l:current, …) are bound on the initial render, not missed.
const runtime = startLievit(
  {
    csrfToken: /* your CSRF token, e.g. from a <meta> */ readMeta("_csrf"),
    csrfHeader: "X-CSRF-TOKEN", // Spring Security default; override if you renamed it
    // nonce: readMeta("csp-nonce"), // pass your page CSP nonce if you run nonced inline bootstrap
  },
  (rt) => installAllFeatures(rt),
);

// 2) Boot the single page Stimulus application AFTER startLievit; it auto-registers every
//    controllers/*-controller.ts and publishes the runtime to the wire bridge. Idempotent.
startStimulus({ runtime });
```

Key facts:

- **`installAllFeatures` does NOT auto-boot Turbo Drive.** It only registers the directives, including
  `l:navigate`. Turbo is mounted lazily, opt-in (§2). With no `l:navigate` on the page, navigation
  stays native and Turbo is never loaded.
- **Order is load-bearing.** Register features via the `startLievit(options, register)` callback (not
  after `startLievit` returns), so they are present for the first document scan. Call `startStimulus`
  after, once.
- **CSRF is a header, not a hidden field, for the wire.** The wire sends the token as the
  `X-CSRF-TOKEN` header (configurable) so Spring Security's filter accepts the `POST /lievit/.../call`.
  Native forms still use the normal hidden-field/synchronizer-token mechanism.
- **Icons need no setup.** The full Lucide set ships inside the jar (via `lucide-static`); consumers
  vendor **zero** SVG files. `@template.lievit.icon(name = "...")` resolves from the jar.

---

## 4. What you do NOT have to do

- You do not vendor the runtime JS or the icons by hand - both ship in the jar (re-vendoring an old
  copy is the migration step for pre-1.2.0 adopters; see CHANGELOG).
- You do not configure a positioning library - overlays use native CSS Anchor Positioning with the
  `@oddbird/css-anchor-positioning` polyfill as the Firefox/Safari fallback. No `floating-ui` setup.
- You do not write inline `<script>` or `style` to make components interactive - behavior lives in
  Stimulus controllers shipped with lievit, loaded under `script-src 'self'`.
