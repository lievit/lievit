@import dev.lievit.kit.Cell
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.table.rich-cell - renders ONE kit Cell value, the single canonical place every
  kit-Table screen renders a typed cell the same way (moved out of the per-adopter gest template).

  The kit's AdminListView.Row.cells() returns List<Cell>, the sealed Cell set:
    Cell.Text        -> plain escaped text
    Cell.Badge       -> a status pill via @@template.lievit.badge
    Cell.Link        -> a deep-link <a href> (token-styled, rel=noopener on new-tab)
    Cell.Icon        -> a Lucide glyph via @@template.lievit.icon (+ optional adjacent text)
    Cell.Tags        -> chips for the visible tags + a "+K" overflow badge
    Cell.AvatarStack -> overlapped avatars (image or initials) + a "+K" overflow badge
    Cell.View        -> the ViewColumn escape hatch: the adopter's trusted fragment, stamped raw

  A new Cell kind is added in ONE place. Strict-CSP clean: no inline script; new-tab links carry
  rel=noopener. Every primitive is a lievit-ui partial, server-rendered and token-styled.

  Params: cell - the kit Cell to render.
--%>
@param Cell cell
@if(cell instanceof Cell.Badge badge)
    @template.lievit.badge(variant = badge.variant().isEmpty() ? "neutral" : badge.variant(), label = badge.text())
@elseif(cell instanceof Cell.Link link)
    @if(link.href() == null || link.href().isEmpty())
        ${link.text()}
    @else
        <a href="${link.href()}"
           class="text-[var(--lv-color-primary)] hover:underline"
           rel="${link.newTab() ? "noopener noreferrer" : null}"
           target="${link.newTab() ? "_blank" : null}">${link.text()}</a>
    @endif
@elseif(cell instanceof Cell.Icon icon)
    <span class="inline-flex items-center gap-[var(--lv-space-2)]">
        @if(icon.name() != null && !icon.name().isEmpty())
            @template.lievit.icon(name = icon.name(), cssClass = icon.color() == null || icon.color().isEmpty() ? "" : "text-[var(--lv-color-" + icon.color() + ")]")
        @endif
        @if(icon.text() != null && !icon.text().isEmpty())
            <span>${icon.text()}</span>
        @endif
    </span>
@elseif(cell instanceof Cell.Tags tags)
    <span class="inline-flex flex-wrap items-center gap-[var(--lv-space-1)]">
        @for(String tag : tags.visible())
            @template.lievit.chip(label = tag)
        @endfor
        @if(tags.hasOverflow())
            @template.lievit.badge(variant = "neutral", label = "+" + tags.overflow())
        @endif
    </span>
@elseif(cell instanceof Cell.AvatarStack stack)
    @if(stack.visible().isEmpty())
        <span class="text-[var(--lv-color-muted-fg)]"></span>
    @else
        <div class="flex items-center">
            <div class="flex -space-x-2">
                @for(dev.lievit.kit.AvatarStackColumn.Avatar avatar : stack.visible())
                    @template.lievit.avatar(name = avatar.label(),
                        src = avatar.hasImage() ? avatar.image() : null,
                        size = "sm",
                        cssClass = "ring-2 ring-[var(--lv-color-bg)]")
                @endfor
            </div>
            @if(stack.hasOverflow())
                @if(stack.hasOverflowUrl())
                    <a href="${stack.overflowUrl()}" title="${stack.overflowTitle()}"
                       class="ml-1 inline-flex h-[1.5rem] items-center rounded-[var(--lv-radius-full)] bg-[var(--lv-color-muted-bg)] px-[var(--lv-space-2)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)] no-underline hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]">+${stack.overflow()}</a>
                @else
                    <span title="${stack.overflowTitle()}"
                          class="ml-1 inline-flex h-[1.5rem] items-center rounded-[var(--lv-radius-full)] bg-[var(--lv-color-muted-bg)] px-[var(--lv-space-2)] text-[length:var(--lv-text-xs)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">+${stack.overflow()}</span>
                @endif
            @endif
        </div>
    @endif
@elseif(cell instanceof Cell.View viewCell)
    <%-- ViewColumn escape hatch: the fragment is the adopter's trusted server-rendered markup,
         stamped RAW (the Cell.View trust contract; the adopter owns escaping). --%>
    $unsafe{viewCell.html()}
@else
    ${cell.text()}
@endif
