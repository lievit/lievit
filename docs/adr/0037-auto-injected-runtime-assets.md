# ADR-0037: Auto-injected runtime assets on full-page responses

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #121 (Livewire's `SupportAutoInjectedAssets`): a full-page lievit app should get the client
runtime with zero manual tags. Livewire injects its `<style>` before `</head>` and `<script>` before
`</body>` on full-page HTML 200s when a component actually rendered, leaving non-lievit pages clean,
disableable via config and force-enableable, robust to malformed markup, preserving the view object.

lievit already has the full-page path: `@LievitPage` components are mapped to routes by
`LievitPageRoutes`, rendered by `LievitPageRenderer`, and wrapped by a `LayoutRenderer` (ADR-0033).
That renderer produced a valid document but injected no lievit script/style, so a host had to wire the
runtime by hand. Two forces shape the lievit answer:

1. **"A component rendered" is structural here, not a scan.** `LievitPageRenderer` is only ever
   reached from a mounted `@LievitPage` component, so the Livewire gate ("did a component render on
   this response?") is true by construction at that seam. A non-lievit route never reaches the
   renderer and stays clean without any HTML inspection. A future global MVC response filter (for
   pages a host renders itself, outside the `@LievitPage` route) would gate on the presence of a
   `data-lievit-component` marker; that broader filter is deferred (it overlaps the asset-pipeline
   work, #171) and is not needed for the page-route case this ADR closes.

2. **The strict CSP forbids inline script (ADR-0019, repo discipline).** The injected `<script>` is
   an external module referenced by `src`, never inline, and carries a `nonce` when the host runs a
   nonce-based CSP so the external load is authorised. No inline handlers, no eval.

## Decision

- **`LievitAssetInjector`** (starter) does the deterministic string surgery only: inject the runtime
  `<link rel=stylesheet>` before the first `</head>` and the `<script type=module defer src=...>`
  before the last `</body>`. It is:
  - **idempotent** — a document that already references the runtime `src` is returned unchanged, so an
    explicit include plus the auto-inject fallback cannot double-load the runtime;
  - **robust to malformed / oddly-cased markup** — closing tags are matched case-insensitively; with
    no `</body>` the script is appended, with no `</head>` the style is prepended, so a bare fragment
    still ships the runtime rather than silently dropping it;
  - **CSP-aware** — stamps a `nonce` on the injected tags when one is supplied, and `data-csrf` /
    `data-update-uri` as the client bootstrap contract (`runtime/wire.ts`).
- **`LievitPageRenderer`** takes the injector (nullable) and injects after layout wrapping. The route
  handler (`LievitPageRoutes`) resolves the CSRF token (the well-known
  `org.springframework.security.web.csrf.CsrfToken` request attribute, read reflectively so the
  starter keeps **no hard spring-security dependency**) and the CSP nonce (`lievit.csp-nonce` or the
  Spring Security nonce attribute) off the request and passes them in.
- **Config** `lievit.assets.*`: `enabled` (default `true`, "it just works"), `force` (inject even when
  a runtime tag is already present), `script-url` (default `/lievit/lievit.js`), `style-url` (default
  empty: the zero-CSS default, ADR-0005, emits no `<link>`). `enabled=false` removes the injector
  bean entirely, so the renderer injects nothing.

## Consequences

- A full-page `@LievitPage` app boots the runtime with no manual tags, under the strict CSP, with the
  CSRF token and update endpoint already on the script. The original view/HTML is preserved (the
  injector only adds two tags).
- **Out of scope (tracked by #171):** how the runtime bundle is *built, served, and versioned* (the
  Vite manifest hash, the `/lievit/lievit.js` endpoint, sourcemaps, the CSP-safe `scriptConfig`
  variant). This ADR defines the injection *point* and the bootstrap *attributes*; the served bundle
  is the asset-pipeline concern. The default `script-url` is a convention the pipeline will satisfy.
- The reflective CSRF read means a typo in the Spring attribute name fails open (no `data-csrf`),
  never throws; acceptable because a missing token degrades to the runtime posting without it, which
  Spring then rejects loudly at the wire endpoint, not a silent security downgrade.
