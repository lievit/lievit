@import io.lievit.component.ComponentMetadata
@import io.lievit.wire.RichSelectComponent
@import io.lievit.wire.RichSelectComponent.Option
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui rich-select WIRE template -- a searchable single-select whose options are filtered
  SERVER-SIDE (ADR-0012). Pairs with registry/wire/rich-select/RichSelectComponent.java.

  TIER: WIRE. The query is a @Wire string bound with l:model.debounce: a few hundred ms after the
  last keystroke the wire sends the new query, the server (RichSelectComponent.render) re-filters
  the catalog, and the listbox re-renders, the client morphing the result. This is the canonical
  htmx/wire typeahead -- NO client-side filtering, the option catalog never ships to the browser.
  The selected value lives server-side (a @Wire string) and is set with the $set magic action
  (a regular action cannot receive the clicked value as an arg over the wire). No <slot>.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Combobox with a listbox popup (the same model
  the dropped Lit island cited):
    - the trigger is a <button role="combobox"> carrying aria-expanded + aria-controls + the
      selected text; the panel below is the live region the search filters;
    - the search <input> carries aria-autocomplete="list" + aria-controls -> the listbox id;
    - the listbox is <ul role="listbox">; each option is <li role="option"> with aria-selected;
    - typing into the search re-queries the server (debounced) rather than filtering in JS.
  Server-rendered options + debounced re-query beats a client-filtered listbox: the catalog and the
  selection are both server-held, so nothing can fail to project and the selection cannot be lost.

  A11y (WAI-ARIA APG Combobox): button[role=combobox][aria-expanded][aria-controls],
  input[aria-autocomplete=list], ul[role=listbox], li[role=option][aria-selected].

  Params:
    name              String   submit field name for the selected value (round-trips, locked)
    query             String   the live search query (bound by l:model.debounce)
    selected          String   the selected option value (server-owned; set via $set)
    placeholder       String   trigger text when nothing is selected
    searchPlaceholder String   placeholder inside the search input
    label             String   accessible label for the combobox + listbox
    disabled          boolean  when true the control is dimmed + selection is a no-op (locked)
    _instance         RichSelectComponent  the live instance (reads the server-filtered options)
    _component        ComponentMetadata    always-present wire metadata (the className anchor)

  Usage (copy this template in, seed allOptions in the component from real data):
    register RichSelectComponent as a PROTOTYPE @Bean; mount it; bind a parent form field to the
    hidden input it renders (name=...) so the selection submits in a plain POST.
--%>
@param String name
@param String query
@param String selected
@param String placeholder
@param String searchPlaceholder
@param String label
@param boolean disabled
@param RichSelectComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var listboxId = "lv-rich-select-lb";}
!{var triggerId = "lv-rich-select-trigger";}
!{var selectedLabel = _instance.selectedLabel();}
!{List<Option> options = _instance.visibleOptions();}
<div data-lievit-component="${cid}" data-rich-select style="position: relative; display: block; font-family: var(--lv-font-sans);">
    <button
        type="button"
        id="${triggerId}"
        role="combobox"
        class="flex items-center justify-between w-full text-left"
        style="gap: var(--lv-space-2); width: 100%; min-height: 2.5rem; padding: var(--lv-space-2) var(--lv-space-3); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); font-size: var(--lv-text-base); color: var(--lv-color-fg); cursor: ${disabled ? "not-allowed" : "pointer"}; opacity: ${disabled ? "0.5" : "1"};"
        aria-expanded="true"
        aria-haspopup="listbox"
        aria-controls="${listboxId}"
        aria-label="${label}"
        disabled="${disabled}"
        data-rich-select-trigger
    >
        @if(selectedLabel.isEmpty())
            <span data-rich-select-placeholder style="color: var(--lv-color-muted);">${placeholder}</span>
        @else
            <span data-rich-select-value>${selectedLabel}</span>
        @endif
        <span aria-hidden="true" style="color: var(--lv-color-muted); flex-shrink: 0;">
            @template.icon(name = "chevron-down", size = "1rem")
        </span>
    </button>

    <div data-rich-select-panel style="margin-top: var(--lv-space-1); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md); overflow: hidden;">
        <div style="padding: var(--lv-space-2) var(--lv-space-3); border-bottom: 1px solid var(--lv-color-border);">
            <input
                type="text"
                role="searchbox"
                placeholder="${searchPlaceholder}"
                aria-label="Search options"
                aria-autocomplete="list"
                aria-controls="${listboxId}"
                value="${query}"
                l:model.debounce.250ms="query"
                data-rich-select-search
                style="width: 100%; font-family: var(--lv-font-sans); font-size: var(--lv-text-sm); color: var(--lv-color-fg); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-sm); padding: var(--lv-space-1) var(--lv-space-2); box-sizing: border-box;"
            />
        </div>

        <ul
            id="${listboxId}"
            role="listbox"
            aria-label="${label.isEmpty() ? placeholder : label}"
            data-rich-select-listbox
            style="list-style: none; margin: 0; padding: var(--lv-space-1) 0; max-height: 14rem; overflow-y: auto;"
        >
            @if(options.isEmpty())
                <li role="option" aria-disabled="true" data-rich-select-empty style="font-size: var(--lv-text-sm); color: var(--lv-color-muted); padding: var(--lv-space-3); text-align: center;">No options</li>
            @else
                @for(Option opt : options)
                    !{var isSelected = opt.value().equals(selected);}
                    !{var selectable = !opt.disabled() && !disabled;}
                    <li
                        role="option"
                        aria-selected="${isSelected ? "true" : "false"}"
                        aria-disabled="${opt.disabled() ? "true" : "false"}"
                        data-rich-select-option="${opt.value()}"
                        l:click="${selectable ? "$set('selected', '" + opt.value() + "')" : null}"
                        style="display: flex; align-items: flex-start; gap: var(--lv-space-2); font-size: var(--lv-text-sm); color: var(--lv-color-fg); padding: var(--lv-space-2) var(--lv-space-3); cursor: ${opt.disabled() ? "not-allowed" : "pointer"}; opacity: ${opt.disabled() ? "0.5" : "1"}; font-weight: ${isSelected ? "600" : "400"};"
                    >
                        <span aria-hidden="true" style="flex-shrink: 0; width: 1rem; text-align: center; visibility: ${isSelected ? "visible" : "hidden"}; color: var(--lv-color-primary);">
                            @template.icon(name = "check", size = "0.875rem")
                        </span>
                        <span style="flex: 1; min-width: 0;">
                            <span style="display: block;" data-rich-select-option-label>${opt.label()}</span>
                            @if(!opt.description().isEmpty())
                                <span style="display: block; font-size: var(--lv-text-sm); color: var(--lv-color-muted);">${opt.description()}</span>
                            @endif
                        </span>
                    </li>
                @endfor
            @endif
        </ul>
    </div>

    <input type="hidden" name="${name}" value="${selected}" data-rich-select-input />
</div>
