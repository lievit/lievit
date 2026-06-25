@import dev.lievit.component.ComponentMetadata
@import dev.lievit.wire.RichSelectComponent
@import dev.lievit.wire.RichSelectComponent.Option
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui rich-select WIRE template -- a searchable Combobox (Filament Select parity, roadmap L1)
  whose options are filtered SERVER-SIDE (ADR-0012). Pairs with
  registry/wire/rich-select/RichSelectComponent.java.

  TIER: WIRE. The query is a @Wire string bound with l:model.debounce: a few hundred ms after the
  last keystroke the wire sends the new query, the server (RichSelectComponent.applyWire) re-filters
  the catalog, and the listbox re-renders, the client morphing the result. This is the canonical
  htmx/wire typeahead -- NO client-side filtering, the option catalog never ships to the browser.
  Selection lives server-side (single: a @Wire string; multiple: a @Wire list) and every pick / chip
  remove / create ARMS its value via the $set magic (a regular action cannot receive the clicked
  value as an arg over the wire); the next render consumes the arm. No <slot>.

  Filament parity (all server-first):
    - multiple: toggles membership; the chosen options render as removable CHIPS, each a real
      <button> that arms the same toggle to remove itself. Single mode (selected string) unchanged.
    - preload: small set -> show the full catalog on mount; large set -> lazy debounced search.
    - allowCreate: a no-match query renders a "Create "<query>"" affordance that arms the new value.
    - rich labels: an Option carries optional avatar (image URL) / icon (Lucide) + subtext; the
      template renders [avatar|icon] label / subtext.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Combobox with a listbox popup:
    - the trigger is a <button role="combobox"> carrying aria-expanded + aria-controls + the
      selected text (single) or the chips (multiple);
    - the search <input> carries aria-autocomplete="list" + aria-controls -> the listbox id;
    - the listbox is <ul role="listbox">; each option is <li role="option"> with aria-selected;
    - typing into the search re-queries the server (debounced) rather than filtering in JS.

  A11y (WAI-ARIA APG Combobox): button[role=combobox][aria-expanded][aria-controls],
  input[aria-autocomplete=list], ul[role=listbox], li[role=option][aria-selected]; chips are real
  <button>s with an aria-label naming the value they remove.

  Params:
    name              String   submit field name for the selected value (round-trips, locked)
    query             String   the live search query (bound by l:model.debounce)
    selected          String   the selected value in single mode (server-owned; set via $set)
    selectedValues    List     the selected values in multiple mode (server-owned)
    multiple          boolean  multi-select with chips (locked)
    preload           boolean  show the full catalog on mount (small sets) vs lazy search (locked)
    allowCreate       boolean  offer "Create "<query>"" on a no-match query (locked)
    placeholder       String   trigger text when nothing is selected
    searchPlaceholder String   placeholder inside the search input
    label             String   accessible label for the combobox + listbox
    disabled          boolean  when true the control is dimmed + selection is a no-op (locked)
    toggleValue       String   the value a click armed; consumed + cleared on render (server-owned)
    createValue       String   the query a "Create" click armed; consumed + cleared on render
    _instance         RichSelectComponent  the live instance (reads the server-filtered options)
    _component        ComponentMetadata    always-present wire metadata (the className anchor)

  Usage (copy this template in, seed allOptions in the component from real data):
    register RichSelectComponent as a PROTOTYPE @Bean; mount it; bind a parent form field to the
    hidden input(s) it renders (name=...) so the selection submits in a plain POST.
--%>
@param String name
@param String query
@param String selected
@param List<String> selectedValues
@param boolean multiple
@param boolean preload
@param boolean allowCreate
@param String placeholder
@param String searchPlaceholder
@param String label
@param boolean disabled
@param String toggleValue
@param String createValue
@param RichSelectComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var listboxId = "lv-rich-select-lb";}
!{var triggerId = "lv-rich-select-trigger";}
!{var selectedLabel = _instance.selectedLabel();}
!{List<Option> chips = _instance.selectedOptions();}
!{List<Option> options = _instance.visibleOptions();}
<div data-lievit-component="${cid}" data-rich-select data-multiple="${multiple ? "true" : "false"}" data-preload="${preload ? "true" : "false"}" style="position: relative; display: block; font-family: var(--lv-font-sans);">
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
        @if(multiple)
            @if(chips.isEmpty())
                <span data-rich-select-placeholder style="color: var(--lv-color-muted);">${placeholder}</span>
            @else
                <span data-rich-select-chips style="display: flex; flex-wrap: wrap; gap: var(--lv-space-1); flex: 1; min-width: 0;">
                    @for(Option chip : chips)
                        <span data-rich-select-chip="${chip.value()}" style="display: inline-flex; align-items: center; gap: var(--lv-space-1); background: var(--lv-color-muted-bg); color: var(--lv-color-fg); border-radius: var(--lv-radius-sm); padding: 0 var(--lv-space-1); font-size: var(--lv-text-sm);">
                            <span>${chip.label()}</span>
                            <button
                                type="button"
                                data-rich-select-chip-remove="${chip.value()}"
                                aria-label="Remove ${chip.label()}"
                                l:click="${disabled ? null : "$set('toggleValue', '" + chip.value() + "')"}"
                                style="display: inline-flex; align-items: center; border: 0; background: transparent; color: var(--lv-color-muted); cursor: ${disabled ? "not-allowed" : "pointer"}; padding: 0; line-height: 1;"
                            >
                                @template.icon(name = "x", size = "0.75rem")
                            </button>
                        </span>
                    @endfor
                </span>
            @endif
        @else
            @if(selectedLabel.isEmpty())
                <span data-rich-select-placeholder style="color: var(--lv-color-muted);">${placeholder}</span>
            @else
                <span data-rich-select-value>${selectedLabel}</span>
            @endif
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
            aria-multiselectable="${multiple ? "true" : "false"}"
            data-rich-select-listbox
            style="list-style: none; margin: 0; padding: var(--lv-space-1) 0; max-height: 14rem; overflow-y: auto;"
        >
            @for(Option opt : options)
                !{var isSelected = _instance.isChosen(opt.value());}
                !{var selectable = !opt.disabled() && !disabled;}
                !{var pickAction = multiple ? "$set('toggleValue', '" + opt.value() + "')" : "$set('selected', '" + opt.value() + "')";}
                <li
                    role="option"
                    aria-selected="${isSelected ? "true" : "false"}"
                    aria-disabled="${opt.disabled() ? "true" : "false"}"
                    data-rich-select-option="${opt.value()}"
                    l:click="${selectable ? pickAction : null}"
                    style="display: flex; align-items: flex-start; gap: var(--lv-space-2); font-size: var(--lv-text-sm); color: var(--lv-color-fg); padding: var(--lv-space-2) var(--lv-space-3); cursor: ${opt.disabled() ? "not-allowed" : "pointer"}; opacity: ${opt.disabled() ? "0.5" : "1"}; font-weight: ${isSelected ? "600" : "400"};"
                >
                    <span aria-hidden="true" style="flex-shrink: 0; width: 1rem; text-align: center; visibility: ${isSelected ? "visible" : "hidden"}; color: var(--lv-color-primary);">
                        @template.icon(name = "check", size = "0.875rem")
                    </span>
                    @if(!opt.avatar().isEmpty())
                        <img src="${opt.avatar()}" alt="" aria-hidden="true" data-rich-select-option-avatar style="flex-shrink: 0; width: 1.5rem; height: 1.5rem; border-radius: var(--lv-radius-full); object-fit: cover;" />
                    @elseif(!opt.icon().isEmpty())
                        <span aria-hidden="true" data-rich-select-option-icon style="flex-shrink: 0; color: var(--lv-color-muted);">
                            @template.icon(name = opt.icon(), size = "1rem")
                        </span>
                    @endif
                    <span style="flex: 1; min-width: 0;">
                        <span style="display: block;" data-rich-select-option-label>${opt.label()}</span>
                        @if(!opt.subtext().isEmpty())
                            <span style="display: block; font-size: var(--lv-text-sm); color: var(--lv-color-muted);" data-rich-select-option-subtext>${opt.subtext()}</span>
                        @endif
                        @if(!opt.description().isEmpty())
                            <span style="display: block; font-size: var(--lv-text-sm); color: var(--lv-color-muted);">${opt.description()}</span>
                        @endif
                    </span>
                </li>
            @endfor

            @if(_instance.canCreate())
                <li
                    role="option"
                    aria-selected="false"
                    data-rich-select-create="${_instance.createCandidate()}"
                    l:click="$set('createValue', '${_instance.createCandidate()}')"
                    style="display: flex; align-items: center; gap: var(--lv-space-2); font-size: var(--lv-text-sm); color: var(--lv-color-primary); padding: var(--lv-space-2) var(--lv-space-3); cursor: pointer;"
                >
                    <span aria-hidden="true" style="flex-shrink: 0; width: 1rem; text-align: center; color: var(--lv-color-primary);">
                        @template.icon(name = "plus", size = "0.875rem")
                    </span>
                    <span>Create "${_instance.createCandidate()}"</span>
                </li>
            @elseif(options.isEmpty())
                <li role="option" aria-disabled="true" data-rich-select-empty style="font-size: var(--lv-text-sm); color: var(--lv-color-muted); padding: var(--lv-space-3); text-align: center;">No options</li>
            @endif
        </ul>
    </div>

    @if(multiple)
        @for(String value : selectedValues)
            <input type="hidden" name="${name}" value="${value}" data-rich-select-input />
        @endfor
    @else
        <input type="hidden" name="${name}" value="${selected}" data-rich-select-input />
    @endif
</div>
