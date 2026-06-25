@import dev.lievit.component.ComponentMetadata
@import dev.lievit.kit.wire.ToggleGroupComponent
@import java.util.List
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toggle-group WIRE template -- a set of toggle buttons whose selected value(s) live
  server-side in ToggleGroupComponent (ADR-0012, Wave 2). Pairs with
  registry/wire/toggle-group/ToggleGroupComponent.java.

  TIER: WIRE. The selected set is server state (a @Wire list); each button ARMS its value via the
  `$set('toggleValue', '<value>')` magic (the canonical wire:click="$set(...)" idiom this repo
  already uses in listing-list.jte), the server re-renders this template, the client morphs it. There
  is no <slot> (the island rendered its own buttons too, so no nested component is dropped, only the
  Lit runtime). The wire runtime renders this template with ONLY the component's @Wire fields +
  _component + _instance (JteTemplateAdapter): the buttons + their pressed state are server-rendered,
  they cannot fail to project.

  STRUCTURE (scientific decision rule): Radix ToggleGroup as the a11y source (the same source the
  dropped Lit island cited):
    - single mode: the container is role="radiogroup", each item role="radio" with aria-checked;
      at most one selected, deselect-to-empty allowed (Radix). This is the correct screen-reader
      model for single-select, NOT a row of pressed buttons.
    - multiple mode: the container is role="group", each item a toggle button with aria-pressed;
      any number selected.
    - roving focus is handled by the markup (native <button>s, Tab-reachable); the server owns the
      pressed/checked set, so no client key handler is needed.
  Native <button>s + server-owned state beat a Lit reactive Set: zero client logic, CSP-clean,
  cannot fail to project.

  A11y (Radix ToggleGroup): single -> radiogroup > radio[aria-checked]; multiple -> group > button
  [aria-pressed]; a disabled item carries `disabled` and never toggles (the server refuses it too).

  Params:
    values         List<String>  item values in render order (locked server config)
    labels         List<String>  item labels, index-aligned with values (locked)
    icons          List<String>  optional icon names, index-aligned (locked); empty string = no icon
    disabledValues List<String>  disabled item values (locked)
    selected       List<String>  the selected value(s) (server-owned)
    mode           String        "single" | "multiple" (locked)
    disabled       boolean       whole-group disable (locked)
    toggleValue    String        the value a click armed; consumed + cleared on render (server-owned)
    _component     ComponentMetadata  always-present wire metadata (the className anchor)
    _instance      ToggleGroupComponent  the live instance, read for isSelected / isDisabled / isSingle

  Usage: seed values + labels (+ optional icons) as locked config; the buttons render themselves.
--%>
@param List<String> values
@param List<String> labels
@param List<String> icons
@param List<String> disabledValues
@param List<String> selected
@param String mode
@param boolean disabled
@param String toggleValue
@param ComponentMetadata _component
@param ToggleGroupComponent _instance
!{var cid = _component.className();}
!{var single = _instance.isSingle();}
<div
    data-lievit-component="${cid}"
    data-toggle-group
    role="${single ? "radiogroup" : "group"}"
    class="inline-flex items-center"
    style="gap: var(--lv-space-1); font-family: var(--lv-font-sans);"
>
    @for(int i = 0; i < values.size(); i++)
        !{var value = values.get(i);}
        !{var label = i < labels.size() ? labels.get(i) : value;}
        !{var icon = icons != null && i < icons.size() ? icons.get(i) : "";}
        !{var isSelected = _instance.isSelected(value);}
        !{var isDisabled = _instance.isDisabled(value);}
        <button
            type="button"
            data-toggle-group-item="${value}"
            role="${single ? "radio" : "button"}"
            aria-checked="${single ? (isSelected ? "true" : "false") : null}"
            aria-pressed="${single ? null : (isSelected ? "true" : "false")}"
            aria-label="${label.isEmpty() ? value : null}"
            disabled="${isDisabled}"
            l:click="$set('toggleValue', '${value}')"
            class="inline-flex items-center justify-center"
            style="gap: var(--lv-space-2); height: 2.25rem; min-width: 2.25rem; padding: 0 var(--lv-space-3); border-radius: var(--lv-radius-md); border: 1px solid ${isSelected ? "var(--lv-color-border)" : "transparent"}; background: ${isSelected ? "var(--lv-color-muted-bg)" : "transparent"}; color: var(--lv-color-fg); font-size: var(--lv-text-sm); font-weight: 500; line-height: var(--lv-leading); cursor: ${isDisabled ? "not-allowed" : "pointer"}; opacity: ${isDisabled ? "0.5" : "1"};"
        >
            @if(!icon.isEmpty())
                <span class="inline-flex" aria-hidden="true" data-toggle-group-icon style="flex-shrink: 0;">
                    @template.icon(name = icon, size = "1rem")
                </span>
            @endif
            @if(!label.isEmpty())
                <span data-toggle-group-label>${label}</span>
            @endif
        </button>
    @endfor
</div>
