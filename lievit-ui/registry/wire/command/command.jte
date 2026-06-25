@import dev.lievit.component.ComponentMetadata
@import dev.lievit.wire.CommandComponent
@import dev.lievit.wire.CommandComponent.Group
@import dev.lievit.wire.CommandComponent.Item
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui command WIRE template -- a searchable command palette whose items are filtered
  SERVER-SIDE (ADR-0012). Pairs with registry/wire/command/CommandComponent.java.

  TIER: WIRE. The query is a @Wire string bound with l:model.debounce: typing re-queries the server,
  which re-filters + re-groups the catalog (CommandComponent.render) and re-renders this list, the
  client morphing it. NO client-side filtering, the catalog never ships to the browser. The chosen
  value lives server-side (a @Wire string) and is set with the $set magic action on click. No <slot>.

  Often opened inside a dialog (a command-dialog): render this component inside a dialog wire
  component's OWNED body region (the dialog owns the open state, this owns the query + selection).
  If no dialog wire is present, render it inline. The body is owned server-rendered markup either way.

  STRUCTURE (scientific decision rule): WAI-ARIA combobox + listbox (the model the dropped island
  cited): the search <input role="combobox"> with aria-controls -> the list; the list is
  <ul role="listbox">; groups are role="group" with an aria-label; items are <li role="option">.
  Server-rendered grouped options + debounced re-query beats a client-filtered list: the catalog and
  selection are both server-held, so nothing can fail to project.

  A11y: input[role=combobox][aria-controls], ul[role=listbox], div[role=group][aria-label],
  li[role=option][aria-selected].

  Params:
    query       String   the live search query (bound by l:model.debounce)
    selected    String   the chosen command value (server-owned; set via $set)
    placeholder String   placeholder for the search box
    emptyText   String   text shown when nothing matches
    label       String   accessible label for the palette
    _instance   CommandComponent   the live instance (reads the server-filtered groups)
    _component  ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in, seed allItems in the component from real commands):
    register CommandComponent as a PROTOTYPE @Bean; mount it (optionally inside a dialog wire); read
    the `selected` field in a @LievitRender hook to act on the chosen command.
--%>
@param String query
@param String selected
@param String placeholder
@param String emptyText
@param String label
@param CommandComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var listId = "lv-command-list";}
!{List<Group> groups = _instance.groups();}
<div data-lievit-component="${cid}" data-command role="combobox" aria-label="${label}" aria-expanded="true" aria-haspopup="listbox" aria-owns="${listId}"
    style="display: flex; flex-direction: column; width: 100%; background: var(--lv-color-bg); color: var(--lv-color-fg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md); overflow: hidden; font-family: var(--lv-font-sans);">
    <div style="display: flex; align-items: center; gap: var(--lv-space-2); padding: var(--lv-space-3); border-bottom: 1px solid var(--lv-color-border);">
        <span aria-hidden="true" style="flex-shrink: 0; color: var(--lv-color-muted);">
            @template.icon(name = "search", size = "1rem")
        </span>
        <input
            type="text"
            role="combobox"
            placeholder="${placeholder}"
            aria-label="${label}"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="${listId}"
            value="${query}"
            l:model.debounce.250ms="query"
            data-command-search
            style="flex: 1; min-width: 0; font-family: var(--lv-font-sans); font-size: var(--lv-text-base); color: var(--lv-color-fg); background: transparent; border: 0; outline: none; padding: 0;"
        />
    </div>

    <ul id="${listId}" role="listbox" aria-label="${label}" data-command-list
        style="overflow-y: auto; max-height: 20rem; padding: var(--lv-space-1); margin: 0; list-style: none;">
        @if(_instance.isEmpty())
            <li role="presentation" data-command-empty style="font-size: var(--lv-text-sm); color: var(--lv-color-muted); padding: var(--lv-space-4) var(--lv-space-3); text-align: center;">${emptyText}</li>
        @else
            @for(Group group : groups)
                <li role="presentation">
                    <div role="group" aria-label="${group.name().isEmpty() ? label : group.name()}">
                        @if(!group.name().isEmpty())
                            <div role="presentation" data-command-group style="font-size: var(--lv-text-sm); font-weight: 600; color: var(--lv-color-muted); padding: var(--lv-space-2) var(--lv-space-2) var(--lv-space-1);">${group.name()}</div>
                        @endif
                        <ul role="presentation" style="list-style: none; margin: 0; padding: 0;">
                            @for(Item item : group.items())
                                !{var isSelected = item.value().equals(selected);}
                                <li
                                    role="option"
                                    aria-selected="${isSelected ? "true" : "false"}"
                                    data-command-item="${item.value()}"
                                    l:click="$set('selected', '${item.value()}')"
                                    style="display: flex; align-items: center; gap: var(--lv-space-2); font-size: var(--lv-text-sm); color: var(--lv-color-fg); padding: var(--lv-space-2) var(--lv-space-2); border-radius: var(--lv-radius-sm); cursor: pointer; background: ${isSelected ? "color-mix(in srgb, var(--lv-color-primary) 12%, var(--lv-color-bg))" : "transparent"};"
                                >
                                    @if(!item.icon().isEmpty())
                                        <span aria-hidden="true" style="flex-shrink: 0; color: var(--lv-color-muted); display: inline-flex;">
                                            @template.icon(name = item.icon(), size = "1rem")
                                        </span>
                                    @endif
                                    <span data-command-item-label style="flex: 1; min-width: 0;">${item.label()}</span>
                                    @if(!item.shortcut().isEmpty())
                                        <span style="flex-shrink: 0; font-size: var(--lv-text-sm); color: var(--lv-color-muted); letter-spacing: 0.08em;">${item.shortcut()}</span>
                                    @endif
                                </li>
                            @endfor
                        </ul>
                    </div>
                </li>
            @endfor
        @endif
    </ul>
</div>
