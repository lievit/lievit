@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui empty partial -- an empty-state block: a Lucide icon in a tinted tile, a title,
  a description, and an optional action slot. The "no results / nothing here yet" panel.

  TIER: STATIC presentational -> JTE partial. Pure presentation; the action (a button/link)
  is the adopter's and keeps its own behaviour.

  STRUCTURE (scientific decision rule): shadcn composes Empty + EmptyHeader + EmptyMedia +
  EmptyTitle + EmptyDescription + EmptyContent. We collapse the common case into one partial
  driven by params (icon name + title + description) plus an `action` Content slot for the
  CTA, matching shadcn's dashed-border, centred, balanced-text layout. shadcn wins styling;
  no Radix behaviour applies to a static panel.

  A11y: the panel is a labelled region (role="status" + aria-live="polite" by default) so that
  when it replaces a list after an async update, AT announces the empty state. The icon is
  decorative (aria-hidden via the Lucide partial); the title carries the human-readable text.
  Override role to "region" (with aria-label) for a static, non-live empty page.

  Params:
    String title                  the headline (e.g. "Nessun contatto").
    String description = null     supporting line; null => omitted.
    String icon        = "info"   Lucide icon name shown in the tile; "" => no icon tile.
    gg.jte.Content action = null  optional CTA slot (button/link).
    String role        = "status" status (live) | region (static; pair with an aria-label via cssClass-less wrapper).
    String cssClass    = ""       extra utility classes on the root.

  Usage:
    @template.empty(
      icon = "search",
      title = "Nessun risultato",
      description = "Nessun contatto corrisponde ai filtri attivi.",
      action = @`@template.button(content = @`Azzera filtri`)`
    )

    @template.empty(icon = "folder", title = "Cartella vuota")
--%>
@param String title
@param String description = null
@param String icon = "info"
@param gg.jte.Content action = null
@param String role = "status"

!{var hasIcon = icon != null && !icon.isBlank();}
!{var hasDescription = description != null && !description.isBlank();}

<div
  data-slot="empty"
  role="${role}"
  aria-live="${role.equals("status") ? "polite" : null}"
  class="flex min-w-0 flex-1 flex-col items-center justify-center gap-[var(--lv-space-6)] rounded-[var(--lv-radius-lg)] border border-dashed border-[var(--lv-color-border)] p-[var(--lv-space-8)] text-center"
>
  <div data-slot="empty-header" class="flex max-w-sm flex-col items-center gap-[var(--lv-space-2)]">
    @if(hasIcon)
      <div data-slot="empty-icon" class="mb-[var(--lv-space-2)] flex h-[var(--lv-space-10)] w-[var(--lv-space-10)] shrink-0 items-center justify-center rounded-[var(--lv-radius-lg)] bg-[var(--lv-color-muted-bg)] text-[var(--lv-color-fg)]">
        @template.icon(name = icon, size = "1.5rem")
      </div>
    @endif
    <div data-slot="empty-title" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-medium)] tracking-tight text-[var(--lv-color-fg)]">${title}</div>
    @if(hasDescription)
      <p data-slot="empty-description" class="text-[length:var(--lv-text-sm)] leading-[var(--lv-leading-relaxed)] text-[var(--lv-color-muted-fg)]">${description}</p>
    @endif
  </div>
  @if(action != null)
    <div data-slot="empty-content" class="flex w-full max-w-sm min-w-0 flex-col items-center gap-[var(--lv-space-4)]">
      ${action}
    </div>
  @endif
</div>
