@import gg.jte.Content
<%--
  lievit-ui :: kbd (static JTE partial)

  A keyboard-key badge: the small pill that shows a shortcut key like Ctrl, Cmd, Esc.
  Mirrors shadcn's Kbd (a styled native <kbd>).

  Tier rationale: pure presentation, no client state, so a JTE partial (DONE criterion 1).

  Accessibility: renders the semantic <kbd> element (the screen-reader-correct element
  for keyboard input), not a styled <span>. pointer-events/select-none keep it from
  being selected as text, matching shadcn.

  Decision (scientific rule): shadcn fills with `bg-muted text-muted-foreground`.
  lievit-tokens has --lv-color-muted (a foreground grey) and --lv-color-surface (a light
  fill). We use --lv-color-surface for the pill fill, --lv-color-muted for the glyph,
  --lv-color-border for the 1px edge: this gives the recessed "key" look from the tokens.

  Params:
    key     - the key text to show (e.g. "Ctrl", "Esc", "Cmd"). Used when `content`
              is not given. Default "".
    content - optional rich content (a glyph + text, or composed keys); takes
              precedence over `key`.
    klass   - extra classes appended to the element.

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
@param String klass = ""
<kbd
  class="lv-kbd pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-[var(--lv-radius-sm)] border px-1.5 text-[var(--lv-text-sm)] font-medium ${klass}"
  style="background-color:var(--lv-color-surface);color:var(--lv-color-muted);border-color:var(--lv-color-border);font-family:var(--lv-font-sans);"
>@if(content != null)${content}@else${key}@endif</kbd>
