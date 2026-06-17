# Support

## Where to get help

| You want to | Go to |
|---|---|
| Report a bug or unexpected behaviour | [Issues](https://github.com/iambilotta/lievit/issues/new/choose) |
| Suggest a feature, a template adapter, a component | [Issues](https://github.com/iambilotta/lievit/issues/new/choose) |
| Ask whether lievit is the right fit for your app | [Discussions](https://github.com/iambilotta/lievit/discussions) |
| Report a vulnerability | [Private security advisory](https://github.com/iambilotta/lievit/security/advisories/new). Do NOT open a public issue. See [SECURITY.md](SECURITY.md). |
| Commercial support, integration help, custom adapters | francesco@iambilotta.com |

## Response times

This is an open-source project maintained by one engineer in Europe. SLAs are best-effort:

- **Security advisories**: triaged within 5 working days.
- **Bugs with a clean reproducer**: triaged within 7 days.
- **Feature requests**: triaged when the maintainer has bandwidth. New public API is hard-capped
  (seven annotations); a feature request that needs an eighth annotation will be declined by default.
- **Discussions**: best-effort, usually within a week.

## Before opening an issue

- Verify the bug reproduces against the latest tag (or `main` SHA while pre-release).
- Check [existing issues](https://github.com/iambilotta/lievit/issues?q=) for duplicates.
- Read the [README](README.md) and the [ADRs](docs/adr/): some answers live there.
- Strip secrets from your reproducer (never paste a real `LIEVIT_SIGNING_KEY`).

## Versioning and breaking changes

The project follows [Semantic Versioning](https://semver.org/) from v1.0 onward. The `0.x` series
is the pre-freeze line; do not assume API stability if you pin to a `0.x`. The wire protocol
version (currently `v0.1`) is tracked separately and changes only via an ADR.

## Out of scope

The maintainer will not:

- Build adapters for non-Spring frameworks as a free request.
- Add a public annotation past the seven-annotation cap to fit a single use case.
- Reimplement Spring's DI, routing, session, or filter chain inside lievit.
