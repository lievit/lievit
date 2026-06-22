@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui infolist-entry partial -- the read-only DISPLAY leaf of a detail page: the value
  variants the kit's infolist entries resolve to, one partial driven by a `type` switch. Mirrors
  io.lievit.kit.schema.infolist's read-only entries (the filament-infolists entry types carried
  over): ColorEntry / IconEntry / ImageEntry / CodeEntry. The READ counterpart of a form control:
  it shows a value, it never edits one.

  TIER: STATIC presentational -> JTE partial. Pure presentation; `value` is the already-projected
  display the controller resolved (ResolvedNode.Field.display / Entry.resolveDisplay). When empty,
  the caller passes the entry placeholder as `value` (Entry.placeholder), so the partial just shows
  the muted text; the kind switch only changes the chrome around a non-empty value.

  STRUCTURE (scientific decision rule): the kit's Entry.kind() tag ("color" / "icon" / "image" /
  "code", default "text") is exactly the branch a renderer keys on (ResolvedNode.Field carries the
  kind), so ONE partial with a `type` switch is the server-first mirror of the sealed entry set
  rather than four near-identical partials. Each branch REUSES an existing primitive rather than
  re-implementing: the icon branch renders @template.lievit.icon, the image branch an avatar-style
  tile, the color branch a swatch + the @template.lievit.badge value, the code branch a <pre><code>.
  A "text" type falls through to the plain value (so callers can route every entry kind here).

  Per-type meaning (matching the kit):
    - color: ColorEntry -> a swatch chip of the CSS color `value` + the value text (copyable adds a
      title hint; the click-to-copy wire is the adopter's, no inline JS here).
    - icon:  IconEntry -> the Lucide icon named by `icon`, tinted by `color` (the boolean/enum-state
      mirror); `value` is the optional adjacent label.
    - image: ImageEntry -> an <img> tile sized by width/height, optionally circular (the disk-resolved
      URL is `value`, already a full URL by the time it reaches the template).
    - code:  CodeEntry -> a monospace <pre><code> block of `value`; `language` tags it (data-language),
      lineNumbers toggles the gutter affordance class. Highlighting is the runtime's, not inline JS.

  TOKEN FIDELITY: swatch border + code surface read --lv-color-border / --lv-color-muted-bg; the
  icon tint maps a Color name to a --lv-color-* var; nothing is a raw hex.

  A11y: the color swatch is decorative (aria-hidden) with the value text carrying the meaning; the
  icon entry's icon is decorative unless `value` is absent, in which case pass `label` so AT reads
  it; image entries MUST carry alt (the partial requires `alt`); the code block is readable text.

  Params:
    String type     = "text"      color | icon | image | code | text (the kit Entry.kind()).
    String value    = ""          the projected display string (or the resolved URL for image).
    String icon     = null        (icon) the Lucide icon name the IconEntry resolved.
    String color    = null        (icon/color) a semantic colour token name (primary, success,
                                  warning, danger, info) or, for color type, the raw CSS color value.
    boolean copyable = false      (color/code) hint that a click-to-copy wire is attached.
    String alt      = null        (image) the required alt text for the image.
    Integer width   = null        (image) rendered width in px (intrinsic when null).
    Integer height  = null        (image) rendered height in px (intrinsic when null).
    boolean circular = false      (image) crop to a circle (an avatar-style tile).
    String language = null        (code) the highlighting language tag.
    boolean lineNumbers = false   (code) show the line-number gutter.
    String label    = null        (icon) accessible label when the icon stands alone.
    String cssClass = ""          extra utility classes on the entry root.

  Usage:
    @@template.lievit.infolist-entry(type = "color", value = "rgb(29 78 216)")
    @@template.lievit.infolist-entry(type = "icon", icon = "check", color = "success", value = "Verificato")
    @@template.lievit.infolist-entry(type = "image", value = "/avatars/1.jpg", alt = "Mario", circular = true, width = 40)
    @@template.lievit.infolist-entry(type = "code", value = "{\"ok\":true}", language = "json", lineNumbers = true)
--%>
@param String type = "text"
@param String value = ""
@param String icon = null
@param String color = null
@param boolean copyable = false
@param String alt = null
@param Integer width = null
@param Integer height = null
@param boolean circular = false
@param String language = null
@param boolean lineNumbers = false
@param String label = null
@param String cssClass = ""

!{var tintVar = switch (color == null ? "" : color) {
    case "primary" -> "var(--lv-color-primary)";
    case "secondary" -> "var(--lv-color-secondary)";
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger", "destructive" -> "var(--lv-color-danger)";
    case "info" -> "var(--lv-color-info)";
    case "muted" -> "var(--lv-color-muted-fg)";
    default -> "var(--lv-color-fg)";
  };}

@if(type.equals("color"))
  <span
    data-slot="infolist-entry"
    data-type="color"
    data-copyable="${copyable}"
    title="${copyable ? value : null}"
    class="inline-flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >
    <span data-slot="infolist-entry-swatch" aria-hidden="true" class="inline-block size-4 shrink-0 rounded-[var(--lv-radius-full)] border border-[var(--lv-color-border)]" style="background-color:${value};"></span>
    <span data-slot="infolist-entry-value" class="font-[var(--lv-font-mono)]">${value}</span>
  </span>
@elseif(type.equals("icon"))
  <span
    data-slot="infolist-entry"
    data-type="icon"
    class="inline-flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] ${cssClass}"
    style="font-family:var(--lv-font-sans); color:${tintVar};"
  >
    @if(icon != null && !icon.isBlank())
      @template.lievit.icon(name = icon, label = (value == null || value.isBlank()) ? label : null)
    @endif
    @if(value != null && !value.isBlank())
      <span data-slot="infolist-entry-value">${value}</span>
    @endif
  </span>
@elseif(type.equals("image"))
  <img
    data-slot="infolist-entry"
    data-type="image"
    src="${value}"
    alt="${alt == null ? "" : alt}"
    width="${width == null ? null : String.valueOf(width)}"
    height="${height == null ? null : String.valueOf(height)}"
    class="inline-block shrink-0 object-cover ${circular ? "rounded-[var(--lv-radius-full)]" : "rounded-[var(--lv-radius-sm)]"} border border-[var(--lv-color-border)] ${cssClass}"
  >
@elseif(type.equals("code"))
  <pre
    data-slot="infolist-entry"
    data-type="code"
    data-language="${language}"
    data-line-numbers="${lineNumbers}"
    data-copyable="${copyable}"
    class="m-0 overflow-x-auto rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-muted-bg)] p-[var(--lv-space-4)] text-[length:var(--lv-text-xs)] text-[var(--lv-color-fg)] ${lineNumbers ? "[&_code]:block" : ""} ${cssClass}"
    style="font-family:var(--lv-font-mono);"
  ><code data-slot="infolist-entry-code">${value}</code></pre>
@else
  <span
    data-slot="infolist-entry"
    data-type="text"
    class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >${value}</span>
@endif
