# ADR-0062: CSP-safe mode, server half (`lievit.csp.*` config + nonce-aware emission)

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

Issue #127. The client half already ships: a restricted, non-`eval` expression evaluator
(`runtime/expression.ts`) that permits only the simple directive grammar and throws on arbitrary
inline JS (arrow fns, IIFEs). The remaining server half is the `csp_safe` configuration + nonce-aware
script/style injection so a strict `Content-Security-Policy` header produces no violations end-to-end.

lievit's posture is already strict-CSP by default (ADR-0019: no inline script, no `eval`; the injected
runtime is an external module by `src`). The asset injector (ADR-0039) and the page route already
stamp a nonce when one is on the request. So the server half is not a *toggle to a safer mode*; it is
making the nonce-aware emission **explicit and configurable**, and reading the nonce from the
host-configured request attribute. The canonical Spring approach (verified via the Spring Security CSP
docs) is that the host's `SecurityFilterChain` writes the `Content-Security-Policy` header and exposes
a per-request nonce as a request attribute; the framework reads it, it never writes the policy.

## Decision

- **`lievit.csp.*`** config (`LievitProperties.Csp`): `enabled` (default `true`, stamp the nonce on
  every lievit-injected `<script>`/`<link>`) and `nonce-attribute` (default `lievit.csp-nonce`, the
  request-attribute name the host exposes the per-request nonce under; settable to a Spring Security
  6.2+ nonce attribute).
- The page route (`LievitPageRoutes`) reads the nonce off the configured attribute (falling back to
  the Spring Security `org.springframework.security.web.csp.nonce`) and passes it to the asset
  injector, which stamps it on the injected runtime tags. `enabled=false` suppresses the nonce
  emission for an app that runs without a nonce-based CSP.
- lievit never generates a nonce and never writes the CSP header: that is the host's
  `SecurityFilterChain`. lievit only authorises its own external runtime load on the host's policy.

## Consequences

- A strict `script-src 'nonce-...'` / `style-src 'nonce-...'` policy authorises the lievit runtime
  with no `unsafe-inline`: the injected external module + stylesheet carry the host's per-request
  nonce, and the directive expressions are evaluated by the restricted client evaluator (no `eval`).
- The nonce source is host-configurable, so lievit works with the well-known `lievit.csp-nonce`
  attribute or a Spring Security nonce integration without a code change.
- The reflective/attribute reads fail open (a missing nonce omits the attribute, never throws), which
  is acceptable: a missing nonce degrades the load on a strict policy loudly (the browser blocks it),
  not silently.

## Alternatives considered

**A `window.lievitScriptConfig` inline-script variant (Livewire's `scriptConfig`).** Rejected: it is an
inline `<script>`, exactly what lievit's strict CSP refuses. lievit's bootstrap rides `data-*`
attributes on the external module tag (ADR-0039), which needs no inline script and no nonce-exempt
`unsafe-inline`.

**Generate the nonce in lievit.** Rejected: the nonce must match the one in the host's CSP header, which
the host's `SecurityFilterChain` owns. Generating a second nonce would never match the policy.
