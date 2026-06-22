@import gg.jte.Content
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui command-palette partial -- the STATIC shadcn Command: a searchable command list
  (input + a role=listbox of role=option items) rendered ENTIRELY server-side, with a tiny CSP-clean
  typed-TS enhancer for the interactive filtering + keyboard nav. It is the static sibling of the
  WIRE command (registry/wire/command/): that one filters SERVER-SIDE per keystroke (the catalog
  never ships, the query is a @Wire string re-querying the server); THIS partial ships the WHOLE
  small/preloaded catalog as real HTML and filters it in the browser. Use the wire command when the
  catalog is large / lazy / server-owned; use this when the commands are a fixed, page-known set (the
  kit's io.lievit.kit.Command render path).

  TIER: STATIC presentational -> JTE partial + a progressive enhancer. JS-OFF the partial is fully
  usable: every command is a real <a href> (navigate, middle-click works) or a real <button>
  (formAction POST), so the list is a plain navigable menu without the search box doing anything.
  The enhancer (command.enhancer.ts) UPGRADES it: it filters the rendered items by the query (hiding
  non-matches, no re-render, the catalog is already on the page) and wires ArrowUp/Down + Enter +
  Escape keyboard navigation. There is nothing for the server to decide between keystrokes once the
  options are on the page, so there is NO wire round-trip -- that is exactly the line between this
  and the wire command. No inline <script> (the strict CSP refuses inline on* handlers; the enhancer
  attaches listeners in code).

  ITEMS via index-aligned lists (the tabs-static convention): the caller passes parallel
  List<String> columns (labels + the optional values/hrefs/formActions/formIds/icons/shortcuts/
  groups), one entry per command, so the partial needs no custom record type and stays JTE-pure. A
  blank cell (or a shorter list) means "absent"; an item with a non-blank href renders a real <a>,
  otherwise a real <button> (a formAction POST, or a plain type=button the adopter wires).

  STRUCTURE (scientific decision rule): WAI-ARIA combobox + listbox (the same model the wire command
  cites): the search <input role="combobox" aria-controls> -> the list; the list is
  <ul role="listbox">; groups are role="group"-captioned headings; items are <li role="option">
  carrying a real <a>/<button>. The enhancer sets aria-activedescendant + a per-item active state
  during keyboard nav; aria-selected stays false (this is an action palette, not a selection widget).

  A11y: input[role=combobox][aria-controls][aria-autocomplete=list]; ul[role=listbox]; li[role=option]
  each holding a real focusable control so activation is the platform's; the search box drives
  aria-activedescendant during arrow nav.

  Params (index-aligned columns; labels is the only required one):
    String       id = "lv-command"     the root id; the listbox id derives from it. Unique per page.
    List<String> labels                the visible command text per item (also the filter target).
    List<String> values = {}           a stable key per item (data-command-value); defaults to label.
    List<String> hrefs = {}            destination per item => a real <a href> when non-blank.
    List<String> formActions = {}      a formaction URL per item => a real <button type=submit> POST.
    List<String> formIds = {}          a <form> id per item the button submits (with a formAction).
    List<String> icons = {}            an optional leading Lucide icon name per item.
    List<String> shortcuts = {}        an optional right-aligned keyboard hint per item (display only).
    List<String> groups = {}           an optional group caption per item; consecutive items sharing a
                                       caption are grouped under one heading.
    String       placeholder = "Type a command or search..."  the search box placeholder.
    String       emptyText = "No results found."  shown (by the enhancer) when nothing matches.
    String       label = "Command palette"  accessible label for the input + listbox.
    String       cssClass = ""         extra utility classes on the root.

  Usage (build the columns in the controller from real commands, then):
    @@template.lievit.command(
      id = "k-menu",
      labels = java.util.List.of("Go to dashboard", "New contact"),
      hrefs = java.util.List.of("/dashboard", ""),
      formActions = java.util.List.of("", "/contacts/new"),
      icons = java.util.List.of("layout-dashboard", "plus"),
      groups = java.util.List.of("Navigation", "Actions")
    )
--%>
@param String id = "lv-command"
@param List<String> labels
@param List<String> values = java.util.List.of()
@param List<String> hrefs = java.util.List.of()
@param List<String> formActions = java.util.List.of()
@param List<String> formIds = java.util.List.of()
@param List<String> icons = java.util.List.of()
@param List<String> shortcuts = java.util.List.of()
@param List<String> groups = java.util.List.of()
@param String placeholder = "Type a command or search..."
@param String emptyText = "No results found."
@param String label = "Command palette"
@param String cssClass = ""
!{var listId = id + "-list";}
!{var inputId = id + "-input";}

<div
    id="${id}"
    data-slot="command"
    data-lievit-command
    data-empty-text="${emptyText}"
    class="flex flex-col overflow-hidden rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-md)] ${cssClass}"
    style="font-family:var(--lv-font-sans);"
>
  <div data-slot="command-input-wrapper" class="flex items-center gap-[var(--lv-space-2)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-3)] py-[var(--lv-space-2)]">
    <span aria-hidden="true" class="inline-flex shrink-0 text-[var(--lv-color-muted)]">@template.lievit.icon(name = "search", size = "1rem")</span>
    <input
        type="text"
        id="${inputId}"
        data-slot="command-input"
        data-command-search
        role="combobox"
        aria-label="${label}"
        aria-controls="${listId}"
        aria-expanded="true"
        aria-autocomplete="list"
        autocomplete="off"
        placeholder="${placeholder}"
        class="min-w-0 flex-1 border-0 bg-transparent p-0 text-[length:var(--lv-text-base)] text-[var(--lv-color-fg)] outline-none placeholder:text-[var(--lv-color-muted)]"
        style="font-family:var(--lv-font-sans);"
    />
  </div>

  <ul
      id="${listId}"
      data-slot="command-list"
      data-command-list
      role="listbox"
      aria-label="${label}"
      class="m-0 max-h-[20rem] list-none overflow-y-auto p-[var(--lv-space-1)]"
  >
    @for(int i = 0; i < labels.size(); i++)
      !{var itemLabel = labels.get(i);}
      !{var value = i < values.size() && !values.get(i).isBlank() ? values.get(i) : itemLabel;}
      !{var href = i < hrefs.size() ? hrefs.get(i) : "";}
      !{var formAction = i < formActions.size() ? formActions.get(i) : "";}
      !{var formId = i < formIds.size() ? formIds.get(i) : "";}
      !{var icon = i < icons.size() ? icons.get(i) : "";}
      !{var shortcut = i < shortcuts.size() ? shortcuts.get(i) : "";}
      !{var group = i < groups.size() ? groups.get(i) : "";}
      !{var prevGroup = i > 0 && i - 1 < groups.size() ? groups.get(i - 1) : "";}
      !{var newGroup = !group.isEmpty() && !group.equals(prevGroup);}
      @if(newGroup)
        <li role="presentation" data-slot="command-group-heading" data-command-group="${group}" class="px-[var(--lv-space-2)] pb-[var(--lv-space-1)] pt-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-semibold)] text-[var(--lv-color-muted)]">${group}</li>
      @endif
      <li
          role="option"
          data-slot="command-item"
          data-command-item
          data-command-value="${value}"
          data-command-label="${itemLabel}"
          aria-selected="false"
      >
        @if(!href.isEmpty())
          <a
              href="${href}"
              data-command-action
              tabindex="-1"
              class="flex w-full items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-sm)] px-[var(--lv-space-2)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] no-underline"
          >
            @if(!icon.isEmpty())
              <span aria-hidden="true" class="inline-flex shrink-0 text-[var(--lv-color-muted)]">@template.lievit.icon(name = icon, size = "1rem")</span>
            @endif
            <span class="min-w-0 flex-1">${itemLabel}</span>
            @if(!shortcut.isEmpty())
              <span aria-hidden="true" class="ml-auto shrink-0 text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted)]" style="letter-spacing:0.08em;">${shortcut}</span>
            @endif
          </a>
        @else
          <button
              type="${formAction.isEmpty() ? "button" : "submit"}"
              data-command-action
              tabindex="-1"
              form="${formId.isEmpty() ? null : formId}"
              formaction="${formAction.isEmpty() ? null : formAction}"
              class="flex w-full cursor-pointer items-center gap-[var(--lv-space-2)] rounded-[var(--lv-radius-sm)] border-0 bg-transparent px-[var(--lv-space-2)] py-[var(--lv-space-2)] text-left text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)]"
              style="font:inherit;"
          >
            @if(!icon.isEmpty())
              <span aria-hidden="true" class="inline-flex shrink-0 text-[var(--lv-color-muted)]">@template.lievit.icon(name = icon, size = "1rem")</span>
            @endif
            <span class="min-w-0 flex-1">${itemLabel}</span>
            @if(!shortcut.isEmpty())
              <span aria-hidden="true" class="ml-auto shrink-0 text-[length:var(--lv-text-xs)] text-[var(--lv-color-muted)]" style="letter-spacing:0.08em;">${shortcut}</span>
            @endif
          </button>
        @endif
      </li>
    @endfor
    <li role="presentation" data-slot="command-empty" data-command-empty hidden class="px-[var(--lv-space-3)] py-[var(--lv-space-4)] text-center text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted)]">${emptyText}</li>
  </ul>
</div>
