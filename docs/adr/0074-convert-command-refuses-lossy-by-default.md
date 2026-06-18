# ADR-0074: The convert command refuses a lossy convert by default

- **Status:** accepted
- **Date:** 2026-06-18
- **Deciders:** Francesco Bilotta

## Context

`lievit convert <Component>` (issue #141) rewrites a component's source in place across the SFC<->MFC
boundary. The markup parsers (ADR-0070/0071) warn-and-skip any construct they cannot faithfully
represent (a JTE `@if`/`@for` block, a DSL `fragment(...)` root). The question is what the *command*
does when the conversion is partial: silently writing the lossy result would destroy authored markup
with no signal, which is the opposite of the convert's promise ("convert what is safe, do not emit
wrong output").

## Decision

The command is destructive-safe by default:

- **Auto-detect direction** from the component's current shape (single-file vs `template=`); `convert`
  takes no direction flag.
- **Refuse a lossy convert** (exit 1, **source left untouched**) when any construct was warn-and-skipped,
  printing each `WARN [construct] detail` so the author sees exactly what cannot convert. Pass
  `--force` to write the partial result (the safe parts) with the warnings printed.
- **No-overwrite on the target side.** SFC->MFC refuses if the target `.jte` already exists; the class
  rewrite is in place (it is the source of the conversion).
- **MFC->SFC removes the template** after a successful, gated write (single-file colocates the markup);
  the removal happens only after the class has been rewritten, so a failure never leaves a class with
  no markup.

## Consequences

- The author never loses markup silently: a clean convert just works, a lossy one is a loud refusal
  with a precise diff of what is unconvertible, and `--force` is an explicit opt-in to the partial
  result.
- The default is safe for the irreversible direction (MFC->SFC deletes the template) because the gate
  runs before any deletion.
- A component using template control flow cannot be one-shot converted to single-file; that is correct
  (the control flow belongs in Java, which the convert does not author), and the warning tells the
  author what to hand-migrate.

## Alternatives considered

**Always write, just print warnings.** Rejected: it silently drops authored markup on a destructive,
in-place edit; the refusal-by-default is the poka-yoke.

**A separate `--dry-run` instead of refuse-by-default.** Rejected: dry-run is opt-in, so the unsafe
write stays the default; refusing by default and requiring `--force` puts the safety on the default
path. `--force` plus the printed warnings already gives the "I know, do it anyway" escape.
