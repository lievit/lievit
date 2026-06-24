<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui kbd partial (v-next) -- a keyboard-key badge: the small recessed pill that
  shows a shortcut key (Ctrl, Cmd, Esc) or a chord (Ctrl+K).

  TIER: STATIC presentational -> JTE partial. Pure presentation, no client state.

  STRUCTURE (scientific decision rule): renders the semantic <kbd> element (the
  screen-reader-correct element for keyboard input). Single key: one <kbd> containing the
  key text. Chord (keys.size() > 1): outer <kbd> wrapping one inner <kbd> per key, separated
  by a Unicode <span aria-hidden> separator so the chord reads as individual keys to AT.

  A11y: the native <kbd> element is the correct semantic for keyboard input (HTML spec).
  pointer-events-none / select-none keep it from being selected as text, matching shadcn.
  ariaLabel on the outer element (smart attr: omitted when null) supports screen-reader
  overrides when the caller wants a bespoke announcement.

  TOKEN decision: bg from --lv-color-muted-bg, text from --lv-color-muted-fg (the same pair
  avatar/empty use), border from --lv-color-border (the 1px recessed "key" look), shadow
  from --lv-shadow-xs (slight depth), font from --lv-font-mono (monospace convention,
  confirmed present at tokens.css line 198).

  SIZE scale (text + padding, not height -- <kbd> is inline):
    sm  text-xs  px-space-2 py-space-1
    md  text-sm  px-space-2 py-space-1  (default)
    lg  text-base px-space-3 py-space-1

  Params:
    java.util.List<String> keys         REQUIRED: ordered list of key names (["Ctrl", "K"]).
    String size         = "md"          "sm" | "md" | "lg".
    String ariaLabel    = null          aria-label on the outer <kbd> (omitted when null).
    String cssClass     = ""            extra utility classes on the outer <kbd>.
    String attrs        = ""            TRUSTED raw ($unsafe) -- STATIC strings only.

  Usage:
    @@template.lievit.kbd(keys = java.util.List.of("Esc"))
    @@template.lievit.kbd(keys = java.util.List.of("Ctrl", "K"))
    @@template.lievit.kbd(keys = java.util.List.of("Cmd", "Shift", "P"), size = "sm")
    @@template.lievit.kbd(keys = java.util.List.of("Enter"), ariaLabel = "Premi Invio per confermare")
--%>
@param java.util.List<String> keys
@param String size = "md"
@param String ariaLabel = null
@param String cssClass = ""
@param String attrs = ""

!{var sizeClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)] px-[var(--lv-space-2)] py-[var(--lv-space-1)]";
    case "lg" -> "text-[length:var(--lv-text-base)] px-[var(--lv-space-3)] py-[var(--lv-space-1)]";
    default   -> "text-[length:var(--lv-text-sm)] px-[var(--lv-space-2)] py-[var(--lv-space-1)]";
  };}
!{var base = "inline-flex items-center select-none rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] bg-[var(--lv-color-muted-bg)] text-[var(--lv-color-muted-fg)] font-[var(--lv-font-mono)] shadow-[var(--lv-shadow-xs)]";}
!{var innerBase = "inline-flex items-center";}
!{boolean isChord = keys.size() > 1;}

@if(isChord)
<kbd
  data-slot="kbd"
  data-size="${size}"
  aria-label="${ariaLabel}"
  class="${base} ${sizeClass} gap-[var(--lv-space-1)] ${cssClass}"
  $unsafe{attrs}
>@for(int i = 0; i < keys.size(); i++)@if(i > 0)<span aria-hidden="true"> </span>@endif<kbd class="${innerBase}">${keys.get(i)}</kbd>@endfor</kbd>
@else
<kbd
  data-slot="kbd"
  data-size="${size}"
  aria-label="${ariaLabel}"
  class="${base} ${sizeClass} ${cssClass}"
  $unsafe{attrs}
>${keys.isEmpty() ? "" : keys.get(0)}</kbd>
@endif
