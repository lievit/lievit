@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui typography.text partial -- inline text with style intents (Ant Typography.Text parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state. Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Typography.Text carries a colour `type` (secondary/success/warning/danger) plus emphasis
    flags (strong/italic/underline/delete/mark/code/keyboard). Each emphasis maps to the correct
    SEMANTIC inline element so meaning is in the HTML, not just the paint: strong -> <strong>,
    italic -> <em>, delete -> <del>, underline -> <u>, mark -> <mark>, code -> <code>,
    keyboard -> <kbd>. When no emphasis is set it renders a plain <span>. Exactly one emphasis is
    honoured (the first that is true, in that precedence) to keep a single semantic element.
    Inventory reference: Ant Design Typography.Text. Original generation over --lv-* tokens.

  A11y: the chosen semantic element supplies its own meaning to AT (del/mark/code/kbd are
    meaningful). Colour intent is decorative -- never the sole signal.

  Params:
    gg.jte.Content content              the text/markup.
    String type      = "default"        default|secondary|success|warning|danger (colour intent).
    boolean strong   = false            bold emphasis -> <strong>.
    boolean italic   = false            italic -> <em>.
    boolean underline= false            underline -> <u>.
    boolean delete   = false            strike-through -> <del>.
    boolean mark     = false            highlight -> <mark>.
    boolean code     = false            inline code -> <code> (monospace, subtle fill).
    boolean keyboard = false            keystroke -> <kbd>.
    boolean disabled = false            dim + not-allowed cursor (decorative; not a control).
    String cssClass  = ""               extra utility classes.
    String attrs     = ""               TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.typography.text(type = "secondary", content = @@`muted note`)
    @@template.lievit.typography.text(strong = true, content = @@`important`)
    @@template.lievit.typography.text(code = true, content = @@`npm install`)
--%>
@param gg.jte.Content content
@param String type = "default"
@param boolean strong = false
@param boolean italic = false
@param boolean underline = false
@param boolean delete = false
@param boolean mark = false
@param boolean code = false
@param boolean keyboard = false
@param boolean disabled = false
@param String cssClass = ""
@param String attrs = ""

!{var color = switch (type) {
    case "secondary" -> "var(--lv-color-muted-fg)";
    case "success"   -> "var(--lv-color-success)";
    case "warning"   -> "var(--lv-color-warning)";
    case "danger"    -> "var(--lv-color-danger)";
    default          -> "var(--lv-color-fg)";
  };}
!{var dim = disabled ? "opacity:var(--lv-opacity-disabled);cursor:not-allowed;" : "";}
!{var baseStyle = "font-family:var(--lv-font-sans);color:" + color + ";" + dim;}
!{var codeStyle = "font-family:var(--lv-font-mono);background:var(--lv-color-muted-bg);color:" + color + ";border-radius:var(--lv-radius-sm);padding:0 var(--lv-space-1);" + dim;}

@if(strong)
<strong data-slot="text" data-type="${type}" class="font-[var(--lv-font-semibold)] ${cssClass}" style="${baseStyle}" $unsafe{attrs}>${content}</strong>
@elseif(italic)
<em data-slot="text" data-type="${type}" class="${cssClass}" style="${baseStyle}" $unsafe{attrs}>${content}</em>
@elseif(delete)
<del data-slot="text" data-type="${type}" class="${cssClass}" style="${baseStyle}" $unsafe{attrs}>${content}</del>
@elseif(underline)
<u data-slot="text" data-type="${type}" class="${cssClass}" style="${baseStyle}" $unsafe{attrs}>${content}</u>
@elseif(mark)
<mark data-slot="text" data-type="${type}" class="${cssClass}" style="background:var(--lv-color-warning-subtle);color:var(--lv-color-warning-subtle-fg);${dim}" $unsafe{attrs}>${content}</mark>
@elseif(code)
<code data-slot="text" data-type="${type}" class="text-[length:var(--lv-text-sm)] ${cssClass}" style="${codeStyle}" $unsafe{attrs}>${content}</code>
@elseif(keyboard)
<kbd data-slot="text" data-type="${type}" class="text-[length:var(--lv-text-sm)] ${cssClass}" style="${codeStyle}border:1px solid var(--lv-color-border);" $unsafe{attrs}>${content}</kbd>
@else
<span data-slot="text" data-type="${type}" class="${underline ? "underline" : ""} ${cssClass}" style="${baseStyle}" $unsafe{attrs}>${content}</span>
@endif
