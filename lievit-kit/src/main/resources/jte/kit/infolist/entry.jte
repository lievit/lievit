@import io.lievit.kit.schema.infolist.ResolvedNode
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.infolist.entry - renders ONE resolved infolist LEAF (a ResolvedNode.Field), the
  single canonical place every kit detail page renders a typed entry value the same way (the View
  counterpart of kit.table.rich-cell). The KeyValue node is NOT a leaf field, so it is dispatched by
  the container walk (kit/infolist.jte), not here; this partial handles the ResolvedNode.Field set.

  An Infolist resolves each entry into a ResolvedNode.Field carrying:
    label       - the humanized entry label (the <dt> term the caller renders, not painted here)
    display     - the ALREADY-PROJECTED display string (placeholder already applied to empties)
    kind        - the Entry.kind() tag the dispatch branches on:
                    text  -> plain escaped value (TextEntry default; a badged TextEntry also lands
                             here because the badge flag is not carried on the resolved Field, see
                             the gap note below)
                    icon  -> IconEntry  -> the lievit-ui infolist-entry icon variant
                    image -> ImageEntry -> the lievit-ui infolist-entry image variant
                    color -> ColorEntry -> the lievit-ui infolist-entry color swatch variant
                    code  -> CodeEntry  -> the lievit-ui infolist-entry <pre><code> variant
    columnSpan  - the grid span (the caller's description-list.item owns the span, not painted here)

  GAP (reported, not worked around): ResolvedNode.Field carries only label/display/kind/columnSpan,
  so the typed entry FACTS the builder set (IconEntry's icon name + color, ImageEntry's dimensions +
  circular crop, CodeEntry's language + line-numbers, TextEntry's badge flag + color) are NOT in the
  resolved tree: resolveNode flattens every leaf to its display string. This partial therefore paints
  the kind-appropriate chrome around `display` (e.g. an icon entry whose value is the projected text)
  but cannot render the icon glyph / image src / code language faithfully until the Field carries
  those facts. The "text" badge case falls through to plain text for the same reason. The dispatch is
  in place so widening the Field (or a per-kind resolved record) lights these up with no caller change.

  Strict-CSP clean: every primitive is a lievit-ui partial, server-rendered and token-styled; no
  inline script. JTE static-checker safe: each branch delegates to a partial that owns its own root
  tag (no @if/@else opening a different ROOT tag in THIS template).

  Params:
    field - the resolved leaf field to render.
--%>
@param ResolvedNode.Field field
@if(field.kind().equals("icon"))
    @template.lievit.infolist-entry(type = "icon", value = field.display(), label = field.label())
@elseif(field.kind().equals("image"))
    @template.lievit.infolist-entry(type = "image", value = field.display(), alt = field.label())
@elseif(field.kind().equals("color"))
    @template.lievit.infolist-entry(type = "color", value = field.display())
@elseif(field.kind().equals("code"))
    @template.lievit.infolist-entry(type = "code", value = field.display())
@else
    @template.lievit.infolist-entry(type = "text", value = field.display())
@endif
