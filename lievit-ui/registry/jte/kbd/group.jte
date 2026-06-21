@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui kbd/group partial -- shadcn new-york-v4 KbdGroup (data-slot="kbd-group"): the inline
  wrapper that holds several <kbd> keys as one shortcut, e.g. "Ctrl + K" or the "Then" sequence.

  TIER: STATIC presentational -> JTE partial. Pure layout (an inline flex row with a gap), no
  client state; server-rendered, zero JS, CSP-clean.

  STRUCTURE (scientific decision rule): shadcn's KbdGroup is `inline-flex items-center gap-1`; the
  keys (and any "+"/"then" connector text) are the children. We reproduce that exactly with the
  token gap, and the content slot carries the @@template.lievit.kbd calls + connectors.

  A11y: a plain grouping wrapper; each inner <kbd> is the screen-reader-correct element for the
  key. The visible "+"/"then" connectors are content, announced as text.

  Params:
    gg.jte.Content content      the <kbd> keys and any connector text (e.g. "+").
    String cssClass = ""        extra utility classes on the group.

  Usage:
    @@template.lievit.kbd.group(content = @@`
      @@template.lievit.kbd(key = "Ctrl") + @@template.lievit.kbd(key = "K")
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""
<kbd
  data-slot="kbd-group"
  class="inline-flex items-center gap-[var(--lv-space-1)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>${content}</kbd>
