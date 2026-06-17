## Summary

<!-- One paragraph: what changes and why. -->

## Decision

<!-- If the change involves a non-trivial choice, name the alternatives considered
     and the reason for picking this shape. If it locks a design decision, add or
     update an ADR under docs/adr/. Skip for trivial fixes. -->

## Test plan

- [ ] Tests cover the change (RED before GREEN)
- [ ] `./mvnw verify` runs green locally (once the build exists)
- [ ] CHANGELOG.md updated (Added / Changed / Removed / Security / Documentation)
- [ ] Documentation updated (README, docs/) where the change is user-visible

## Wire-protocol impact (if applicable)

<!-- For changes that touch the snapshot schema, the HMAC signing, the codec, or the
     POST /lievit/{id}/call contract: explain the wire-protocol implication and any
     backwards-compatibility concern for existing snapshots. A snapshot schema change
     needs a roundtrip golden test and a tampering test. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Refactor (no behavior change)
- [ ] Build / CI
