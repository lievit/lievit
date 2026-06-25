@import java.util.List
@import java.util.HashSet
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui command partial -- a CONTROLLED/UNCONTROLLED modal command palette overlay.

  TIER: PARTIAL + Stimulus lv-command controller (+ the still-shared collection-nav.enhancer.ts).
  No Java component, no @Wire field, no _component/_instance params. The open-state belongs to
  the CALLER's own Wire component.

  CONTROLLED/UNCONTROLLED doctrine:
    UNCONTROLLED (default, open=false): the overlay is entirely absent from the DOM. The caller
    places its own trigger (e.g. a button with l:click="openPalette"). While the panel is in the
    DOM the controller wires a global Cmd+K / Ctrl+K shortcut (data-shortcut) to close it on second
    press. Opening from keyboard when closed is the caller's responsibility (the trigger button).
    CONTROLLED (open=true): the full overlay renders -- scrim + centered panel. The panel carries
    data-controller="lv-command" which: traps Tab cycling + scroll-locks + returns focus (shared
    FocusTrap), fires data-lv-wire-close on Escape and on the shortcut (shared DismissableController
    doctrine), and does client-side filtering + Enter/Backspace dispatch. ArrowUp/Down/Home/End
    navigation over the listbox stays with collection-nav.enhancer.ts (data-lievit-collection),
    which keeps aria-activedescendant on the input current.

  STRUCTURE (WAI-ARIA APG Combobox + Listbox, aria-activedescendant model):
    - Overlay: role="presentation" scrim + panel wrapper, position:fixed, z-index:--lv-z-overlay.
    - Scrim: aria-hidden="true", l:click="${closeAction}" (click-outside closes).
    - Panel: role="presentation", position:relative, z-index:--lv-z-modal, focus-trap host.
    - Breadcrumb nav: shown when page is non-empty (nested command page). Back button fires
      backToRootAction. A11y: nav[aria-label="Command palette navigation"].
    - Search row: input[role=combobox][aria-controls][aria-haspopup=listbox][aria-autocomplete=list]
      [aria-expanded=true][aria-activedescendant] driven by collection-nav.enhancer.ts via
      data-lievit-collection-activedescendant-target on the listbox.
    - Listbox: ul[role=listbox][id] with data-lievit-collection + data-lievit-collection-orientation
      vertical. Each item: li[role=option][id="opt-{id}"][data-lievit-item].
    - Groups: outer li[role=presentation][data-slot=group] + span[id=grp-N-label] + ul[role=group]
      [aria-labelledby=grp-N-label] for items in that group.
    - Empty state: li[role=presentation][data-slot=empty] + nested div[role=status][aria-live=polite].
    - Items NOT in any group are rendered after the grouped blocks.

  Controller + enhancer wiring (data-attribute contract):
    data-controller="lv-command"   on the panel -- the Stimulus controller (trap + dismiss + filter
                                   + Enter/Backspace/shortcut).
    data-lv-wire-close             on the panel -- the close action; PRESENT => wire-CONTROLLED, so
                                   Escape/shortcut round-trip it. ABSENT => uncontrolled (no call).
    data-shortcut                  on the panel -- global shortcut (e.g. "mod+k") to close.
    data-page                      on the panel -- current nested page name (empty = root).
    data-action on the input       -- input->lv-command#filter, keydown->lv-command#onInputKey.
    data-lievit-collection         on the listbox -- activates collection-nav.enhancer.ts (shared,
                                   NOT converted; do NOT edit that enhancer).
    data-lievit-collection-orientation  "vertical" -- ArrowUp/Down navigation.
    data-lievit-collection-activedescendant-target  "#${inputId}" -- names the input to update.
    data-lievit-item               on each li[role=option] -- collection item.

  MISSING tokens (flagged for token audit):
    --lv-space-96 (24rem), --lv-space-128 (32rem), --lv-space-192 (48rem): used as listbox
    max-height and panel widths. Fallbacks inline: 24rem / 32rem / 48rem.
    --lv-motion-fast: use --lv-duration-fast instead.

  Params (all @param, no Wire fields):
    boolean        open                = false
    List<String>   commands            label per command (the filter target).
    List<String>   commandIds          stable key per command; defaults to index.
    List<String>   commandGroups       group name per command; blank = no group.
    List<String>   commandIcons        Lucide icon name per command; blank = no icon.
    List<String>   commandShortcuts    keyboard hint per command (display only); blank = none.
    List<String>   commandIntents      "default" | "destructive"; blank = "default".
    List<String>   commandHrefs        navigation href per command; blank = action command.
    List<String>   commandPageIds      nested page id per command; blank = action command.
    List<Boolean>  commandDisabled     whether the command is disabled; null or false = enabled.
    List<String>   groups              ordered list of group names to render (determines order).
    List<String>   recentCommandIds    command ids to mark as recently used (data-recent).
    String         page                current nested page name; empty = root palette.
    String         placeholder         search input placeholder text.
    String         emptyText           text shown when no commands match the query.
    String         size                "sm" (24rem) | "md" (32rem, default) | "lg" (48rem).
    String         shortcut            global keyboard shortcut expressed as "mod+k".
    String         closeAction         wire action name to close the palette.
    String         executeAction       wire action name fired on a plain command item.
    String         openPageAction      wire action name fired when a page-command is activated.
    String         backToRootAction    wire action name fired by the breadcrumb Back button.
    String         openAction          wire action name fired by the global shortcut to open.
    String         id                  root id; input and listbox ids derive from it.
    String         cssClass            extra classes on the overlay root.

  Usage:
    @@template.lievit.command(
      open            = myCmd.open(),
      commands        = myCmd.commandLabels(),
      commandIds      = myCmd.commandIds(),
      commandGroups   = myCmd.commandGroups(),
      commandIcons    = myCmd.commandIcons(),
      commandShortcuts = myCmd.commandShortcuts(),
      commandIntents  = myCmd.commandIntents(),
      commandHrefs    = myCmd.commandHrefs(),
      commandDisabled = myCmd.commandDisabled(),
      groups          = myCmd.groups(),
      recentCommandIds = myCmd.recentCommandIds(),
      page            = myCmd.page(),
      closeAction     = "closeCommand",
      executeAction   = "executeCommand",
      openPageAction  = "openPage",
      backToRootAction = "backToRoot",
      openAction      = "openCommand"
    )
--%>
@param boolean open = false
@param List<String> commands = java.util.List.of()
@param List<String> commandIds = java.util.List.of()
@param List<String> commandGroups = java.util.List.of()
@param List<String> commandIcons = java.util.List.of()
@param List<String> commandShortcuts = java.util.List.of()
@param List<String> commandIntents = java.util.List.of()
@param List<String> commandHrefs = java.util.List.of()
@param List<String> commandPageIds = java.util.List.of()
@param List<Boolean> commandDisabled = java.util.List.of()
@param List<String> groups = java.util.List.of()
@param List<String> recentCommandIds = java.util.List.of()
@param String page = ""
@param String placeholder = "Search commands…"
@param String emptyText = "No commands found."
@param String size = "md"
@param String shortcut = "mod+k"
@param String closeAction = "close"
@param String executeAction = "executeCommand"
@param String openPageAction = "openPage"
@param String backToRootAction = "backToRoot"
@param String openAction = "openPalette"
@param String id = "lv-cmd"
@param String cssClass = ""

!{var listboxId = id + "-listbox";}
!{var inputId = id + "-input";}
!{var recentSet = new HashSet<String>(recentCommandIds);}
!{var sizeWidth = "lg".equals(size) ? "48rem" : "md".equals(size) ? "32rem" : "24rem";}
!{var hasGroups = !groups.isEmpty();}

@if(open)
<div
    id="${id}"
    data-slot="overlay"
    role="presentation"
    class="${cssClass}"
    style="position:fixed;inset:0;z-index:var(--lv-z-overlay,1200);display:flex;align-items:center;justify-content:center;font-family:var(--lv-font-sans);"
>
  <%-- Scrim: full-viewport cover, click fires close. aria-hidden keeps it out of the a11y tree. --%>
  <div
      aria-hidden="true"
      data-slot="scrim"
      l:click="${closeAction}"
      style="position:absolute;inset:0;background:var(--lv-color-overlay);"
  ></div>

  <%-- Panel: the modal box centered over the scrim. Stimulus lv-command host (trap + dismiss). --%>
  <div
      role="presentation"
      data-slot="panel"
      data-size="${size}"
      data-controller="lv-command"
      data-lv-wire-close="${closeAction}"
      data-shortcut="${shortcut}"
      data-page="${page}"
      data-execute-action="${executeAction}"
      data-open-page-action="${openPageAction}"
      data-back-to-root-action="${backToRootAction}"
      data-open-action="${openAction}"
      style="position:relative;z-index:var(--lv-z-modal,1300);width:${sizeWidth};max-width:calc(100vw - 2rem);background:var(--lv-color-popover);color:var(--lv-color-popover-fg);border:1px solid var(--lv-color-border);border-radius:var(--lv-radius-lg);box-shadow:var(--lv-shadow-xl);overflow:hidden;display:flex;flex-direction:column;"
  >
    <%-- Breadcrumb: shown only when displaying a nested command page. --%>
    @if(!page.isEmpty())
    <nav
        data-slot="breadcrumb"
        aria-label="Command palette navigation"
        style="display:flex;align-items:center;gap:var(--lv-space-2);padding:var(--lv-space-2) var(--lv-space-4);border-bottom:1px solid var(--lv-color-border);font-size:var(--lv-text-xs);color:var(--lv-color-muted);"
    >
      <button
          type="button"
          data-slot="back"
          l:click="${backToRootAction}"
          style="display:inline-flex;align-items:center;gap:var(--lv-space-2);cursor:pointer;border:none;background:transparent;color:var(--lv-color-muted);font:inherit;font-size:var(--lv-text-xs);padding:0;transition:color var(--lv-duration-fast);"
      >@template.lievit.icon(name = "chevron-left", size = "0.75rem")Back</button>
      <span aria-hidden="true" style="color:var(--lv-color-border);">/</span>
      <span>${page}</span>
    </nav>
    @endif

    <%-- Search row: combobox input + decorative search icon. --%>
    <div
        data-slot="search-input"
        style="display:flex;align-items:center;gap:var(--lv-space-2);padding:0 var(--lv-space-4);border-bottom:1px solid var(--lv-color-border);height:var(--lv-space-9);"
    >
      <span aria-hidden="true" style="display:inline-flex;flex-shrink:0;color:var(--lv-color-muted);">@template.lievit.icon(name = "search", size = "1rem")</span>
      <input
          id="${inputId}"
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-controls="${listboxId}"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-activedescendant=""
          autocomplete="off"
          data-lv-command-target="input"
          data-action="input->lv-command#filter keydown->lv-command#onInputKey"
          placeholder="${placeholder}"
          style="flex:1;min-width:0;border:none;background:transparent;outline:none;color:var(--lv-color-popover-fg);font:inherit;font-size:var(--lv-text-sm);"
      />
    </div>

    <%-- Listbox: the scrollable list of command items. --%>
    <ul
        id="${listboxId}"
        role="listbox"
        aria-label="Commands"
        data-slot="listbox"
        data-lievit-collection=""
        data-lievit-collection-orientation="vertical"
        data-lievit-collection-activedescendant-target="#${inputId}"
        style="margin:0;padding:var(--lv-space-2);list-style:none;overflow-y:auto;max-height:var(--lv-space-96,24rem);"
    >
      @if(hasGroups)
        <%-- Grouped rendering: render each group header + its items, then ungrouped items. --%>
        @for(String groupName : groups)
          !{var grpLabelId = id + "-grp-" + groups.indexOf(groupName) + "-label";}
          <li role="presentation" data-slot="group" data-group-name="${groupName}" style="list-style:none;">
            <span
                id="${grpLabelId}"
                data-slot="group-label"
                style="display:block;padding:var(--lv-space-3) var(--lv-space-2) var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);color:var(--lv-color-muted);text-transform:uppercase;letter-spacing:0.06em;"
            >${groupName}</span>
            <ul role="group" aria-labelledby="${grpLabelId}" style="margin:0;padding:0;list-style:none;">
              @for(int i = 0; i < commands.size(); i++)
                !{var _cg = i < commandGroups.size() ? commandGroups.get(i) : "";}
                @if(groupName.equals(_cg))
                  !{var cmdLabel = commands.get(i);}
                  !{var cmdId = i < commandIds.size() && !commandIds.get(i).isEmpty() ? commandIds.get(i) : String.valueOf(i);}
                  !{var cmdIcon = i < commandIcons.size() ? commandIcons.get(i) : "";}
                  !{var cmdShortcut = i < commandShortcuts.size() ? commandShortcuts.get(i) : "";}
                  !{var cmdIntent = i < commandIntents.size() && !commandIntents.get(i).isEmpty() ? commandIntents.get(i) : "default";}
                  !{var cmdHref = i < commandHrefs.size() ? commandHrefs.get(i) : "";}
                  !{var cmdPageId = i < commandPageIds.size() ? commandPageIds.get(i) : "";}
                  !{boolean cmdIsDisabled = i < commandDisabled.size() && Boolean.TRUE.equals(commandDisabled.get(i));}
                  !{boolean cmdIsRecent = recentSet.contains(cmdId);}
                  !{boolean isDestructive = "destructive".equals(cmdIntent);}
                  <li
                      id="opt-${cmdId}"
                      role="option"
                      data-slot="option"
                      data-intent="${cmdIntent}"
                      data-id="${cmdId}"
                      data-recent="${cmdIsRecent ? "true" : null}"
                      data-href="${!cmdHref.isEmpty() ? cmdHref : null}"
                      data-page-id="${!cmdPageId.isEmpty() ? cmdPageId : null}"
                      aria-selected="false"
                      aria-disabled="${cmdIsDisabled ? "true" : null}"
                      data-lievit-item=""
                      style="list-style:none;"
                  >
                    <div
                        data-slot="option-inner"
                        style="display:flex;align-items:center;gap:var(--lv-space-2);padding:0 var(--lv-space-2);height:var(--lv-space-9);border-radius:var(--lv-radius-md);cursor:${cmdIsDisabled ? "not-allowed" : "pointer"};opacity:${cmdIsDisabled ? "var(--lv-opacity-disabled)" : "1"};color:${isDestructive ? "var(--lv-color-destructive)" : "var(--lv-color-popover-fg)"};font-size:var(--lv-text-sm);"
                    >
                      @if(!cmdIcon.isEmpty())
                        <span aria-hidden="true" style="display:inline-flex;flex-shrink:0;">@template.lievit.icon(name = cmdIcon, size = "1rem")</span>
                      @endif
                      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cmdLabel}</span>
                      @if(!cmdShortcut.isEmpty())
                        <kbd aria-hidden="true" style="display:inline-flex;align-items:center;flex-shrink:0;border-radius:var(--lv-radius-md);background:var(--lv-color-muted-bg);padding:0 var(--lv-space-2);font-size:var(--lv-text-xs);color:var(--lv-color-muted);font-family:var(--lv-font-sans);letter-spacing:0.04em;">${cmdShortcut}</kbd>
                      @endif
                    </div>
                  </li>
                @endif
              @endfor
            </ul>
          </li>
        @endfor
        <%-- Items with no group, rendered after all group blocks. --%>
        @for(int i = 0; i < commands.size(); i++)
          !{var _cg2 = i < commandGroups.size() ? commandGroups.get(i) : "";}
          @if(_cg2.isEmpty())
            !{var cmdLabel = commands.get(i);}
            !{var cmdId = i < commandIds.size() && !commandIds.get(i).isEmpty() ? commandIds.get(i) : String.valueOf(i);}
            !{var cmdIcon = i < commandIcons.size() ? commandIcons.get(i) : "";}
            !{var cmdShortcut = i < commandShortcuts.size() ? commandShortcuts.get(i) : "";}
            !{var cmdIntent = i < commandIntents.size() && !commandIntents.get(i).isEmpty() ? commandIntents.get(i) : "default";}
            !{var cmdHref = i < commandHrefs.size() ? commandHrefs.get(i) : "";}
            !{var cmdPageId = i < commandPageIds.size() ? commandPageIds.get(i) : "";}
            !{boolean cmdIsDisabled = i < commandDisabled.size() && Boolean.TRUE.equals(commandDisabled.get(i));}
            !{boolean cmdIsRecent = recentSet.contains(cmdId);}
            !{boolean isDestructive = "destructive".equals(cmdIntent);}
            <li
                id="opt-${cmdId}"
                role="option"
                data-slot="option"
                data-intent="${cmdIntent}"
                data-id="${cmdId}"
                data-recent="${cmdIsRecent ? "true" : null}"
                data-href="${!cmdHref.isEmpty() ? cmdHref : null}"
                data-page-id="${!cmdPageId.isEmpty() ? cmdPageId : null}"
                aria-selected="false"
                aria-disabled="${cmdIsDisabled ? "true" : null}"
                data-lievit-item=""
                style="list-style:none;"
            >
              <div
                  data-slot="option-inner"
                  style="display:flex;align-items:center;gap:var(--lv-space-2);padding:0 var(--lv-space-2);height:var(--lv-space-9);border-radius:var(--lv-radius-md);cursor:${cmdIsDisabled ? "not-allowed" : "pointer"};opacity:${cmdIsDisabled ? "var(--lv-opacity-disabled)" : "1"};color:${isDestructive ? "var(--lv-color-destructive)" : "var(--lv-color-popover-fg)"};font-size:var(--lv-text-sm);"
              >
                @if(!cmdIcon.isEmpty())
                  <span aria-hidden="true" style="display:inline-flex;flex-shrink:0;">@template.lievit.icon(name = cmdIcon, size = "1rem")</span>
                @endif
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cmdLabel}</span>
                @if(!cmdShortcut.isEmpty())
                  <kbd aria-hidden="true" style="display:inline-flex;align-items:center;flex-shrink:0;border-radius:var(--lv-radius-md);background:var(--lv-color-muted-bg);padding:0 var(--lv-space-2);font-size:var(--lv-text-xs);color:var(--lv-color-muted);font-family:var(--lv-font-sans);letter-spacing:0.04em;">${cmdShortcut}</kbd>
                @endif
              </div>
            </li>
          @endif
        @endfor
      @else
        <%-- Flat rendering: no groups, render all commands in order. --%>
        @for(int i = 0; i < commands.size(); i++)
          !{var cmdLabel = commands.get(i);}
          !{var cmdId = i < commandIds.size() && !commandIds.get(i).isEmpty() ? commandIds.get(i) : String.valueOf(i);}
          !{var cmdIcon = i < commandIcons.size() ? commandIcons.get(i) : "";}
          !{var cmdShortcut = i < commandShortcuts.size() ? commandShortcuts.get(i) : "";}
          !{var cmdIntent = i < commandIntents.size() && !commandIntents.get(i).isEmpty() ? commandIntents.get(i) : "default";}
          !{var cmdHref = i < commandHrefs.size() ? commandHrefs.get(i) : "";}
          !{var cmdPageId = i < commandPageIds.size() ? commandPageIds.get(i) : "";}
          !{boolean cmdIsDisabled = i < commandDisabled.size() && Boolean.TRUE.equals(commandDisabled.get(i));}
          !{boolean cmdIsRecent = recentSet.contains(cmdId);}
          !{boolean isDestructive = "destructive".equals(cmdIntent);}
          <li
              id="opt-${cmdId}"
              role="option"
              data-slot="option"
              data-intent="${cmdIntent}"
              data-id="${cmdId}"
              data-recent="${cmdIsRecent ? "true" : null}"
              data-href="${!cmdHref.isEmpty() ? cmdHref : null}"
              data-page-id="${!cmdPageId.isEmpty() ? cmdPageId : null}"
              aria-selected="false"
              aria-disabled="${cmdIsDisabled ? "true" : null}"
              data-lievit-item=""
              style="list-style:none;"
          >
            <div
                data-slot="option-inner"
                style="display:flex;align-items:center;gap:var(--lv-space-2);padding:0 var(--lv-space-2);height:var(--lv-space-9);border-radius:var(--lv-radius-md);cursor:${cmdIsDisabled ? "not-allowed" : "pointer"};opacity:${cmdIsDisabled ? "var(--lv-opacity-disabled)" : "1"};color:${isDestructive ? "var(--lv-color-destructive)" : "var(--lv-color-popover-fg)"};font-size:var(--lv-text-sm);"
            >
              @if(!cmdIcon.isEmpty())
                <span aria-hidden="true" style="display:inline-flex;flex-shrink:0;">@template.lievit.icon(name = cmdIcon, size = "1rem")</span>
              @endif
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cmdLabel}</span>
              @if(!cmdShortcut.isEmpty())
                <kbd aria-hidden="true" style="display:inline-flex;align-items:center;flex-shrink:0;border-radius:var(--lv-radius-md);background:var(--lv-color-muted-bg);padding:0 var(--lv-space-2);font-size:var(--lv-text-xs);color:var(--lv-color-muted);font-family:var(--lv-font-sans);letter-spacing:0.04em;">${cmdShortcut}</kbd>
              @endif
            </div>
          </li>
        @endfor
      @endif

      <%-- Empty state: visible when no items match the current query (toggled by the enhancer). --%>
      <li role="presentation" data-slot="empty" style="list-style:none;padding:var(--lv-space-6) var(--lv-space-4);text-align:center;">
        <div role="status" aria-live="polite" style="font-size:var(--lv-text-sm);color:var(--lv-color-muted);">${emptyText}</div>
      </li>
    </ul>
  </div>
</div>
@endif
