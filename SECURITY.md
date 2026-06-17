# Security policy

`lievit` signs the state snapshot that travels between the browser and the server on every wire
call. Vulnerabilities that allow forging or tampering with a snapshot, bypassing the HMAC
signature, or replaying an expired snapshot are treated as critical: the snapshot carries
**state, never code**, and the signature is the only thing standing between a client and the
server-side component state.

## Reporting a vulnerability

**Do not open a public GitHub issue for a security report.** Use a
[private security advisory](https://github.com/iambilotta/lievit/security/advisories/new),
or email:

- `francesco@iambilotta.com`

Include:

- a minimal reproduction (a component class + the wire payload, or a curl call),
- the affected version (release tag or git SHA),
- the impact you observed,
- whether the vulnerability is publicly known.

## What to expect

- **Acknowledgement**: within three working days.
- **Triage and severity**: within seven working days.
- **Fix or mitigation**: within thirty days for critical, sixty for high, ninety for the rest.
  The maintainer is one person; coordinate disclosure timelines accordingly.
- **Public credit**: by default, reporters are credited in the changelog. State explicitly if
  you prefer to remain anonymous.

## Severity heuristic

Critical:
- Forging a snapshot so that a tampered `{cid, cls, wire, iat, exp}` verifies as validly signed.
- Bypassing the HMAC signature check on `POST /lievit/{componentId}/call`.
- Replaying an expired snapshot (`exp` in the past) and having it accepted.
- Resolving an arbitrary FQN from a snapshot to instantiate a class that is not a `@LievitComponent`.

High:
- Leaking `_token`, `_snapshot`, the wire payload, cookies, or auth material into telemetry
  (the privacy rule forbids it: spans and metrics carry shape and timing only).
- Defeating the payload-size limit (64 kb) or the action timeout (5 s) so a single call can
  exhaust server resources.
- CSRF on the wire endpoint (the custom wire header + Spring Security CSRF is the chokepoint).

Medium / Low:
- DOM-patching glitches that lose or duplicate content without a state integrity impact.
- Performance regressions that exceed the wire latency budget without data loss.

## Out of scope

- Vulnerabilities in dependencies that have an upstream patch but no release yet (we track them
  via Dependabot and ship the bump when upstream does).
- Misuse where an adopter disables the signature or sets a trivial signing key.
- Denial of service that requires privileged access to the deploying environment.

## Cryptographic notes

- The snapshot is signed with HMAC-SHA-256 (HS256). The signing key must be at least 32 bytes
  (base64url). Key rotation is supported via the `kid` header and `LIEVIT_SIGNING_KEY_PREV`
  with a 24 h grace window.
- A full external penetration test (Cure53-grade, zero critical) is a release gate before any
  public Maven Central distribution.
