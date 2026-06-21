@import java.util.Map
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.infolist-grid - one resolved infolist SECTION's body: an ordered label->value
  grid laid out in N columns (the Filament infolist entry grid), rendered onto the lievit-ui
  infolist-entry partial. Factored out of kit/page/resource-view.jte so the named-section and the flat
  (unnamed) section branches share ONE grid render (JTE has no in-file sub-template, so the shared grid
  is its own file).

  Each entry is the resolved label + STRING value (the view-model paints already-projected strings).
  The value renders through the infolist-entry text type; an empty value already carries the
  placeholder the view-model applied. The CSS grid columns follow the section's column count.

  Server-first / strict-CSP: pure server-rendered markup, no script.

  Params:
    entries - the ordered label->display map of the section.
    columns - the column count the entries lay out in (at least 1).
--%>
@param Map<String, String> entries
@param int columns = 1
<dl
  data-slot="kit-infolist-grid"
  class="m-0 grid gap-x-[var(--lv-space-6)] gap-y-[var(--lv-space-4)]"
  style="grid-template-columns:repeat(${columns}, minmax(0, 1fr));"
>
  @for(Map.Entry<String, String> entry : entries.entrySet())
    <div data-slot="kit-infolist-entry" class="flex flex-col gap-[var(--lv-space-1)]">
      <dt class="text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] uppercase tracking-wide text-[var(--lv-color-muted-fg)]">${entry.getKey()}</dt>
      <dd class="m-0">@template.lievit.infolist-entry(type = "text", value = entry.getValue())</dd>
    </div>
  @endfor
</dl>
