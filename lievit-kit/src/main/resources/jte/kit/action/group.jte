@import java.util.List
@import dev.lievit.kit.AdminAction
@import dev.lievit.kit.ActionGroup
@import dev.lievit.kit.ActionPlacement
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.action.group - a CLUSTER of admin actions for one host placement (HEADER row,
  ROW cell, or the BULK bar), rendered onto the lievit-ui button-group + dropdown-menu partials.
  Composes kit/action.jte (the single trigger) for the flat actions and folds an optional
  dev.lievit.kit.ActionGroup into the Filament row "⋮" dropdown menu. Sibling of kit/table.jte's
  inline action rendering; the kit ships THIS so a host renders a whole action cluster from the model.

  PLACEMENT (dev.lievit.kit.ActionPlacement, the Filament BelongsToTable host context) decides the
  LAYOUT, not the trigger (the trigger is each action's own ActionVariant, owned by kit/action.jte):
    HEADER -> a horizontal toolbar of the resource-scoped actions (Create / Export), right-aligned.
    ROW    -> a tight inline cluster of per-row actions (Edit / Delete), usually icon/link variants,
              plus the ⋮ ActionGroup dropdown when the row is crowded.
    BULK   -> the selection-bar cluster (Delete selected, ...); rendered inside the table's
              selection-footer by the host, so here it is just the button row.
  The placement only sets the wrapper spacing + alignment; every action still renders through
  kit/action.jte, so a url action stays a real <a href>, a confirmed action opens its modal, a wire
  action fires l:click with the SAFE escaped row id.

  GROUPED (ActionGroup -> dropdown-menu). When a `group` is supplied and not hidden for the record,
  it renders as the Filament "⋮" trigger opening a dropdown-menu whose items are the grouped actions.
  A child action is rendered as kit/action.jte INSIDE a menuitem wrapper (a real <button>/<a>, so the
  menu stays server-first and the wire/url/confirm behaviour is identical to a flat action). The group
  hides itself when every child is hidden for the record (ActionGroup.isHiddenFor).

  CRITICAL JTE RULE: the HEADER/ROW/BULK wrappers each open a COMPLETE <div> per branch; the loop
  body renders complete elements. We never split one element across @if. Confirmed actions need their
  modal rendered too -- the host renders kit/action/modal.jte once per confirmed action under the same
  modalId this template hands the trigger (modalIdFor below), so the dialog and its invoker agree.

  Params:
    actions   - the flat actions for this placement (top-level, declaration order). Each visible action
                renders through kit/action.jte.
    group     - an optional ActionGroup folded into a ⋮ dropdown-menu; null => no dropdown.
    placement - the ActionPlacement (HEADER | ROW | BULK) deciding the cluster layout.
    record    - the host record (or null for HEADER scope); resolves per-action url + visibility.
    recordId  - the row id carried into wire/confirm actions as the SAFE wireArgs id (or "").
    dropdownId- the dropdown-menu panel id for the ⋮ group (unique per row/page); "" => derived.
    modalPrefix - the per-action <dialog> id prefix for confirmed actions; the trigger built here uses
                  modalPrefix + action.name(), which the host must mirror when rendering kit/action/modal.jte.
--%>
@param List<? extends AdminAction<?>> actions
@param ActionGroup<?> group = null
@param ActionPlacement placement = ActionPlacement.ROW
@param Object record = null
@param String recordId = ""
@param String dropdownId = ""
@param String modalPrefix = "lv-action-"
!{var wrapClass = switch (placement) {
    case HEADER -> "flex items-center justify-end gap-[var(--lv-space-2)]";
    case BULK -> "flex items-center gap-[var(--lv-space-2)]";
    default -> "flex items-center justify-end gap-[var(--lv-space-1)]";
  };}
!{var ddId = dropdownId == null || dropdownId.isBlank()
    ? ("kit-actions-" + (recordId == null || recordId.isBlank() ? placement.name().toLowerCase() : recordId))
    : dropdownId;}

<div data-slot="kit-action-group" data-action-placement="${placement.name()}" class="${wrapClass}">
  @for(AdminAction<?> action : actions)
    @if(action.isVisibleFor(record))
      @template.kit.action(action = action, record = record, recordId = recordId,
        modalId = action.requiresConfirmation() ? modalPrefix + action.name() : "",
        size = "sm")
    @endif
  @endfor

  @if(group != null && !group.isHiddenFor(record))
    @template.lievit.dropdown-menu(
      id = ddId,
      placement = "bottom",
      trigger = @`
        @template.lievit.icon(name = "ellipsis-vertical", size = "1rem")
        @if(group.label() != null)<span>${group.label()}</span>@endif
      `,
      content = @`
        @for(AdminAction<?> child : group.actions())
          @if(child.isVisibleFor(record))
            <div role="menuitem" data-slot="dropdown-menu-item" data-kit-action-menuitem="${child.name()}" class="flex items-center px-[var(--lv-space-1)] py-[var(--lv-space-1)]">
              @template.kit.action(action = child, record = record, recordId = recordId,
                modalId = child.requiresConfirmation() ? modalPrefix + child.name() : "",
                size = "sm")
            </div>
          @endif
        @endfor
      `)
  @endif
</div>
