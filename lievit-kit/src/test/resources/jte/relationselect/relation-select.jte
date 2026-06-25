@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.BelongsToField.ComboOption
@import dev.lievit.kit.relationselect.RelationSelectComponent
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  K5 wiring template: the lievit-ui rich-select Combobox sourced from a kit BelongsToField. Same
  server-first wire idiom as the published rich-select (a button[role=combobox], a debounced
  l:model search input, a ul[role=listbox] of li[role=option], chips for multiple, repeated hidden
  inputs), but the options come from the live RelationSelectComponent.visibleOptions(), which the
  component re-sources from the field on every render (preload = full catalog; lazy = the per-query
  RecordRepository.search). No client-side filtering, no <slot>, no inline script.

  Params:
    name           String   submit field name (round-trips, locked)
    query          String   the live search query (bound by l:model.debounce)
    selected       String   the selected value in single mode
    selectedValues List     the selected values in multiple mode
    multiple       boolean  multi-relation with chips + repeated hidden inputs (locked)
    toggleValue    String   the value a click armed; consumed + cleared on render
    _instance      RelationSelectComponent  the live instance (reads the field-sourced options)
    _component     ComponentMetadata        wire metadata (the className anchor)
--%>
@param String name
@param String query
@param String selected
@param List<String> selectedValues
@param boolean multiple
@param String toggleValue
@param RelationSelectComponent _instance
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var listboxId = "lv-relation-select-lb";}
!{List<ComboOption> options = _instance.visibleOptions();}
<div data-lievit-component="${cid}" data-relation-select data-multiple="${multiple ? "true" : "false"}" style="position: relative; display: block;">
    <button
        type="button"
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
        aria-controls="${listboxId}"
        data-relation-select-trigger
    >
        @if(multiple)
            @for(String value : selectedValues)
                <span data-relation-select-chip="${value}">
                    <span>${value}</span>
                    <button
                        type="button"
                        data-relation-select-chip-remove="${value}"
                        aria-label="Remove ${value}"
                        l:click="$set('toggleValue', '${value}')"
                    >@template.icon(name = "x", size = "0.75rem")</button>
                </span>
            @endfor
        @else
            <span data-relation-select-value>${selected}</span>
        @endif
    </button>

    <div data-relation-select-panel>
        <input
            type="text"
            role="searchbox"
            aria-label="Search options"
            aria-autocomplete="list"
            aria-controls="${listboxId}"
            value="${query}"
            l:model.debounce.250ms="query"
            data-relation-select-search
        />
        <ul
            id="${listboxId}"
            role="listbox"
            aria-multiselectable="${multiple ? "true" : "false"}"
            data-relation-select-listbox
        >
            @for(ComboOption opt : options)
                !{var isSelected = _instance.isChosen(opt.value());}
                !{var pickAction = "$set('toggleValue', '" + opt.value() + "')";}
                <li
                    role="option"
                    aria-selected="${isSelected ? "true" : "false"}"
                    data-relation-select-option="${opt.value()}"
                    l:click="${pickAction}"
                >
                    @if(!opt.avatar().isEmpty())
                        <img src="${opt.avatar()}" alt="" aria-hidden="true" data-relation-select-option-avatar />
                    @elseif(!opt.icon().isEmpty())
                        <span aria-hidden="true" data-relation-select-option-icon>@template.icon(name = opt.icon(), size = "1rem")</span>
                    @endif
                    <span data-relation-select-option-label>${opt.label()}</span>
                    @if(!opt.subtext().isEmpty())
                        <span data-relation-select-option-subtext>${opt.subtext()}</span>
                    @endif
                </li>
            @endfor
            @if(options.isEmpty())
                <li role="option" aria-disabled="true" data-relation-select-empty>No options</li>
            @endif
        </ul>
    </div>

    @if(multiple)
        @for(String value : selectedValues)
            <input type="hidden" name="${name}" value="${value}" data-relation-select-input />
        @endfor
    @else
        <input type="hidden" name="${name}" value="${selected}" data-relation-select-input />
    @endif
</div>
