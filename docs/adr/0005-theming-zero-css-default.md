# ADR-0005: Zero-CSS default, opt-in theme package

- **Status:** accepted
- **Date:** 2026-06-17
- **Deciders:** Francesco Bilotta

## Context

A full-stack layer can ship its own opinionated styling, which speeds up a demo but imposes a
look on every adopter and creates a vendor-lock surface (you fight the framework's CSS to match
your design system). lievit's positioning is explicitly anti-lock-in and "fine HTML control": an
imposed stylesheet would contradict both.

## Decision

lievit ships **zero CSS by default**. The markup it generates carries no opinionated styling;
the adopter owns all of it.

A polished default look is available as an **opt-in** package, `lievit-theme-italian-grade`
(Cucinelli-pattern craft). It is never imposed and never on the default path.

The brand-visible custom elements (`<lievit-loading>`, `<lievit-error>`, `<lievit-stream>`)
ship unstyled or minimally styled and are themeable by the adopter.

## Consequences

- lievit drops into any existing design system without a CSS fight: there is nothing to override.
- The out-of-the-box demo looks plain unless the adopter opts into the theme or brings their own
  styles. The teaser screencasts use the theme package to look polished; the runtime does not.
- The theme is a separate artifact with its own release cadence, decoupled from the runtime.

## Alternatives considered

**Ship an opinionated default stylesheet (Vaadin / many component-library style).** Faster first
impression, but imposes a look and creates the exact lock-in the positioning rejects. Rejected.

**No theme at all.** Purest, but leaves no polished path for adopters who want one and weakens
the screencast story. Rejected in favour of the opt-in package.
