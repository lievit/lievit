@import static dev.lievit.ui.LievitIcons.body
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui icon partial -- renders an inline Lucide <svg> by name.

  DELIVERY DECISION (scientific, issue #428): inline-per-name, NOT an SVG sprite.
  Compared against MUI (font/SVG components), Radix (per-icon SVG components), shadcn
  (lucide-react, per-icon, tree-shaken) and Web Awesome (<wa-icon>, font/registry):
    (1) zero adopter vendoring -- the WHOLE Lucide set is bundled in the jar's body map
        (generated from the lucide-static npm package at build time), so a consumer
        references any glyph by name with ZERO vendored SVGs and ZERO custom resolver.
        A sprite ships the whole <symbol> sheet (or needs a build to assemble a per-page
        subset) and an extra request / external <use href> with its CSP+cross-doc quirks.
    (2) ergonomics for a JTE adopter -- name any Lucide icon and it just renders. Nothing
        to vendor, no sheet to maintain, no <use> id registry. (Updating to a newer Lucide
        release = bump lucide-static in lievit-ui and re-run generate-icon-map.mjs.)
    (3) robustness -- no <use href>, no external ref, CSP-clean, zero JS.
  The body map is rendered server-side, so only the glyphs a page actually emits hit the wire;
  the sprite's only edge (repeated-icon byte savings) is marginal in a gestionale and costs the
  copy-in simplicity, so inline-per-name is objectively best here.

  The uniform <svg> wrapper lives HERE once (sized + coloured by --lv-* tokens); the per-icon
  inner body (paths/circles/...) comes from dev.lievit.ui.LievitIcons.body(name) -- a lievit-OWNED
  facade over an IconResolver SPI, defaulting to the bundled, tree-shaken Lucide set
  (LucideIconResolver). The partial names NO adopter class, so it renders standalone out of the box.
  To ship a different icon set, implement dev.lievit.ui.IconResolver and call
  LievitIcons.setResolver(...) once at startup; this call site never changes. The Lucide SVGs
  stroke with currentColor, so colour follows the surrounding text colour or any Tailwind `text-*`
  utility / --lv-color-* override on a wrapping element.

  Usage:
    @template.lievit.icon(name = "chevron-down")
    @template.lievit.icon(name = "trash-2", cssClass = "text-[var(--lv-color-danger)]")
    @template.lievit.icon(name = "search", size = "1.25rem")
    @template.lievit.icon(name = "settings", label = "Open settings")   // labelled (img role)

  By default the icon is decorative: aria-hidden="true" + focusable="false". Pass a `label`
  to expose it to assistive tech (role="img" + aria-label); then it is NOT aria-hidden.

  Any Lucide icon name resolves out of the box (the full set is bundled). To refresh the set to
  a newer Lucide release: bump lucide-static in lievit-ui/package.json and run
  `node registry/icons/generate-icon-map.mjs`, then commit the regenerated map.
--%>
@param String name
@param String size = "var(--lv-icon-size)"
@param String cssClass = ""
@param String label = null
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  width="${size}"
  height="${size}"
  fill="none"
  stroke="currentColor"
  stroke-width="var(--lv-icon-stroke)"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="lv-icon ${cssClass}"
  role="${label == null ? null : "img"}"
  aria-hidden="${label == null ? "true" : null}"
  aria-label="${label}"
  focusable="false"
  data-lucide="${name}"
>$unsafe{body(name)}</svg>
