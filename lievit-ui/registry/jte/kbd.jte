@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: kbd (static JTE partial)

  A keyboard-key badge: the small pill that shows a shortcut key like Ctrl, Cmd, Esc.
  Mirrors shadcn's Kbd (a styled native <kbd>).

  Tier rationale: pure presentation, no client state, so a JTE partial (DONE criterion 1).

  Accessibility: renders the semantic <kbd> element (the screen-reader-correct element
  for keyboard input), not a styled <span>. pointer-events/select-none keep it from
  being selected as text, matching shadcn.

  Decision (scientific rule): shadcn fills with `bg-muted text-muted-foreground`. lievit-tokens
  has --lv-color-muted-bg (the muted FILL) + --lv-color-muted-fg (the muted glyph), the same
  pair avatar/empty use; --lv-color-border draws the 1px edge for the recessed "key" look.

  Params:
    key      - the key text to show (e.g. "Ctrl", "Esc", "Cmd"). Used when `content`
               is not given. Default "".
    content  - optional rich content (a glyph + text, or composed keys); takes
               precedence over `key`.
    cssClass - extra classes appended to the element.

  Usage:
    @@template.lievit.kbd(key = "Esc")
    @@template.lievit.kbd(content = @@`<span>Ctrl</span>`)
    For a combo, render several side by side:
      <span class="inline-flex items-center gap-1">
        @@template.lievit.kbd(key = "Ctrl") @@template.lievit.kbd(key = "K")
      </span>
--%>
@param String key = ""
@param gg.jte.Content content = null
@param String cssClass = ""
<kbd
  data-slot="kbd"
  class="lv-kbd pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-[var(--lv-radius-sm)] border px-1.5 text-[var(--lv-text-sm)] font-medium ${cssClass}"
  style="background-color:var(--lv-color-muted-bg);color:var(--lv-color-muted-fg);border-color:var(--lv-color-border);font-family:var(--lv-font-sans);"
>@if(content != null)${content}@else${key}@endif</kbd>
