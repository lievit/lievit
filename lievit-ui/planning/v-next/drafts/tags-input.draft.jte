@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tags-input partial -- a multi-value token-entry field: the user types text (or
  picks from an optional suggestion popup) and each confirmed value becomes a removable chip.
  The tag set is the server fact (WIRE); the client enhancer owns chip roving-tabindex, keyboard
  navigation, paste splitting, and focus-restore after removal.

  TIER: WIRE + ENH (tags-input.enhancer.ts). The Java TagsInputComponent owns tags, inputValue,
  mode, suggestions, popupOpen. The enhancer (tags-input.enhancer.ts) owns the irreducible client
  behaviors: chip roving-tabindex, keyboard map, paste splitting, focus-restore after morph.
  Registered via installTagsInput(runtime) in index.ts.

  STRUCTURE (scientific decision rule): no WAI-ARIA APG pattern for token entry exists (verified
  2026-06-23). This BUILT model is constructed from three APG sources: (1) APG Keyboard Interface
  practices for roving-tabindex focus management; (2) APG Combobox pattern for the optional
  suggestion popup when mode is not "free"; (3) raw WAI-ARIA group + option + button semantics.
  Ant Design Select (mode="tags") for inventory reference. Tailwind UI tag-list patterns for
  visual look (original generation, no code copied). react-aria useTagGroup as pattern reference
  for chip roving-tabindex interaction model.

  A11y (BUILT against APG Keyboard Interface + APG Combobox + raw WAI-ARIA):
    - root: role="group" aria-labelledby -> external label element; aria-disabled when disabled;
      aria-invalid when the field has a validation error.
    - chips: role="option" aria-selected="true" tabindex (roving: exactly one chip gets
      tabindex="0" at a time; all others tabindex="-1"). aria-label includes press Delete
      or Backspace to remove instruction. Each chip's remove button: real button type="button",
      aria-label="Remove (label)", tabindex="-1" (the chip is the roving item, not the button).
    - entry input: plain input type="text" when mode=free; role="combobox"
      aria-haspopup="listbox" aria-expanded aria-controls aria-autocomplete="list" when mode
      is suggestions or suggestions-only.
    - suggestion popup: role="listbox" id=listboxId. Each suggestion: role="option"
      data-lievit-item (collection-nav enhancer handles arrow nav).
    - live region: role="status" aria-live="polite" aria-atomic="true". Announces add/remove/
      max-reached/no-matches.
    - clear-all: real button type="button" aria-label="Clear all tags".
    - No focus trap. No modal overlay.

  Enhancer data-* hooks (typed surface the enhancer reads):
    data-slot="tags-input" on root
    data-slot="chip" on each chip (the roving-tabindex set)
    data-tag-id="(escaped)" on each chip
    data-slot="chip-remove" on each remove button
    data-slot="entry-input" on the text input
    data-slot="clear-all" on the clear button
    data-slot="suggestions-popup" on the listbox popup
    data-disabled on root when disabled
    data-max-reached on root when maxTags reached
    data-delimiter="(escaped)" on root

  Escaping channels (the XSS decision rule, verbatim from button.jte):
    tag id -> data-tag-id: SAFE via StringOutput + Escape.htmlAttribute, emitted $unsafe
      (builds the full attribute fragment: data-tag-id="escaped-value")
    suggestion id -> data-suggestion-id: SAFE via StringOutput + Escape.htmlAttribute
    tag label in aria-label: through JTE default ${} escaping (HTML context)
    inputValue in input value: through JTE default ${} escaping

  Params:
    java.util.List of Map(String to String) tags = null
        ordered list of current tags; each map: "id" (server-assigned), "label", "intent"
        (default/info/success/warning/destructive).
    String inputValue = ""
        the live text in the entry input (the in-progress label before commit).
    String mode = "free"
        "free" (any text) or "suggestions" (free + popup) or "suggestions-only" (popup only).
    java.util.List of Map(String to String) suggestions = null
        suggestion set for suggestions and suggestions-only modes; each map: "id", "label".
    boolean asyncSuggestions = false
        when true, inputChange triggers HTMX swap of the suggestion listbox.
    boolean popupOpen = false
        suggestion popup open state (only meaningful when mode is not free).
    boolean disabled = false
        disables the entire control.
    String placeholder = "Add a tag..."
        placeholder on the entry input when there are no tags.
    int maxTags = 0
        maximum tag count (0 = unlimited).
    String delimiter = ","
        paste-split delimiter char(s).
    String size = "md"
        "sm" or "md" or "lg" toolbar-aligned height.
    boolean clearable = true
        show the clear-all button when tags is non-empty.
    boolean invalid = false
        aria-invalid state plus destructive ring.
    String labelId = null
        id of an external label element (aria-labelledby on the group root).
    String fieldId = "tags-input-field"
        id for the entry input (pair with a label for=fieldId).
    String liveRegionId = "tags-input-live"
        id for the live region element.
    String listboxId = "tags-input-listbox"
        id for the suggestion listbox popup.

  Usage:
    @@template.lievit.tags-input(tags = component.tags(), inputValue = component.inputValue(),
        mode = "free", size = "md", placeholder = "Add a tag...", fieldId = "etichette")
    @@template.lievit.tags-input(tags = component.tags(), inputValue = component.inputValue(),
        mode = "suggestions", suggestions = component.suggestions(), popupOpen = component.popupOpen(),
        listboxId = "etichette-listbox", fieldId = "etichette")
--%>
@param java.util.List<java.util.Map<String,String>> tags = null
@param String inputValue = ""
@param String mode = "free"
@param java.util.List<java.util.Map<String,String>> suggestions = null
@param boolean asyncSuggestions = false
@param boolean popupOpen = false
@param boolean disabled = false
@param String placeholder = "Add a tag..."
@param int maxTags = 0
@param String delimiter = ","
@param String size = "md"
@param boolean clearable = true
@param boolean invalid = false
@param String labelId = null
@param String fieldId = "tags-input-field"
@param String liveRegionId = "tags-input-live"
@param String listboxId = "tags-input-listbox"

!{var tagList = tags != null ? tags : java.util.List.<java.util.Map<String,String>>of();}
!{var suggestionList = suggestions != null ? suggestions : java.util.List.<java.util.Map<String,String>>of();}
!{var maxReached = maxTags > 0 && tagList.size() >= maxTags;}
!{var hasTags = !tagList.isEmpty();}
!{var isFree = "free".equals(mode);}
!{var hasPopup = !isFree;}
!{var showClearAll = clearable && hasTags && !disabled;}
!{var inputDisabled = disabled || maxReached;}

!{var wellMinH = switch(size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-10)";
    default   -> "var(--lv-space-9)";
  };}
!{var chipH = switch(size) {
    case "sm" -> "var(--lv-space-6)";
    case "lg" -> "var(--lv-space-8)";
    default   -> "var(--lv-space-7)";
  };}
!{var textSz = switch(size) {
    case "sm" -> "var(--lv-text-xs)";
    case "lg" -> "var(--lv-text-base)";
    default   -> "var(--lv-text-sm)";
  };}

<%-- Escape the delimiter for safe use in data-delimiter attribute value. --%>
!{var _delimOut_ = new StringOutput();}
!{Escape.htmlAttribute(delimiter, _delimOut_);}
!{var _delimAttr_ = new StringOutput();}
!{_delimAttr_.writeContent(" data-delimiter=\"");}
!{_delimAttr_.writeContent(_delimOut_.toString());}
!{_delimAttr_.writeContent("\"");}

<div
  data-slot="tags-input"
  role="group"
  aria-labelledby="${labelId}"
  aria-disabled="${disabled ? "true" : null}"
  aria-invalid="${invalid ? "true" : null}"
  data-disabled="${disabled ? "true" : null}"
  data-max-reached="${maxReached ? "true" : null}"
  data-size="${size}"
  $unsafe{_delimAttr_.toString()}
  class="flex flex-col gap-[var(--lv-space-1)]"
  style="font-family:var(--lv-font-sans);"
>
  <%-- Well: the visual input container that holds chips and entry input --%>
  <div
    data-slot="tags-input-well"
    data-invalid="${invalid ? "true" : null}"
    class="flex min-h-[${wellMinH}] flex-wrap items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border bg-[var(--lv-color-input)] p-[var(--lv-space-2)] transition-[box-shadow] focus-within:shadow-[var(--lv-ring)] data-[invalid=true]:border-[var(--lv-color-destructive)] data-[invalid=true]:focus-within:shadow-[var(--lv-ring-destructive)]"
    style="border-color:var(--lv-color-border);"
  >
    @for(var tag : tagList)
      !{var _tid_ = new StringOutput();}
      !{Escape.htmlAttribute(tag.get("id") != null ? tag.get("id") : "", _tid_);}
      !{var _tlabel_ = tag.get("label") != null ? tag.get("label") : "";}
      !{var _tintent_ = tag.get("intent") != null ? tag.get("intent") : "default";}
      !{var _chipBg_ = switch(_tintent_) {
          case "info"        -> "var(--lv-color-info)";
          case "success"     -> "var(--lv-color-success)";
          case "warning"     -> "var(--lv-color-warning)";
          case "destructive" -> "var(--lv-color-destructive)";
          default            -> "var(--lv-color-secondary)";
        };}
      !{var _chipFg_ = switch(_tintent_) {
          case "info"        -> "var(--lv-color-info-fg)";
          case "success"     -> "var(--lv-color-success-fg)";
          case "warning"     -> "var(--lv-color-warning-fg)";
          case "destructive" -> "var(--lv-color-destructive-fg)";
          default            -> "var(--lv-color-secondary-fg)";
        };}
      !{var _chipAttr_ = new StringOutput();}
      !{_chipAttr_.writeContent(" data-tag-id=\"");}
      !{Escape.htmlAttribute(tag.get("id") != null ? tag.get("id") : "", _chipAttr_);}
      !{_chipAttr_.writeContent("\"");}
      <span
        data-slot="chip"
        data-intent="${_tintent_}"
        role="option"
        aria-selected="true"
        tabindex="-1"
        aria-label="${_tlabel_}, press Delete or Backspace to remove"
        $unsafe{_chipAttr_.toString()}
        class="inline-flex h-[${chipH}] items-center gap-[var(--lv-space-1)] rounded-full px-[var(--lv-space-2)] text-[length:${textSz}] font-[var(--lv-font-medium)] leading-none outline-none transition-colors focus-visible:shadow-[var(--lv-ring)] cursor-default select-none"
        style="background:${_chipBg_};color:${_chipFg_};"
      >
        <span aria-hidden="true">${_tlabel_}</span>
        @if(!disabled)
          !{var _removeBtnAttr_ = new StringOutput();}
          !{_removeBtnAttr_.writeContent(" data-tag-id=\"");}
          !{Escape.htmlAttribute(tag.get("id") != null ? tag.get("id") : "", _removeBtnAttr_);}
          !{_removeBtnAttr_.writeContent("\"");}
          <button
            type="button"
            data-slot="chip-remove"
            tabindex="-1"
            aria-label="Remove ${_tlabel_}"
            l:click="removeTag"
            $unsafe{_removeBtnAttr_.toString()}
            class="inline-flex shrink-0 items-center justify-center rounded-full p-[2px] opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
            style="color:inherit;"
          ><svg aria-hidden="true" focusable="false" width="0.75rem" height="0.75rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        @endif
      </span>
    @endfor

    <%-- Entry input: plain text when mode=free; combobox when mode has suggestions --%>
    @if(isFree)
      <input
        data-slot="entry-input"
        type="text"
        id="${fieldId}"
        value="${inputValue}"
        placeholder="${hasTags ? null : placeholder}"
        autocomplete="off"
        disabled="${inputDisabled}"
        aria-disabled="${maxReached && !disabled ? "true" : null}"
        aria-invalid="${invalid ? "true" : null}"
        l:model.debounce.200ms="inputValue"
        l:keydown.enter="addTag"
        class="min-w-[6rem] flex-1 border-0 bg-transparent px-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none placeholder:text-[var(--lv-color-muted)] disabled:cursor-not-allowed"
        style="font-family:var(--lv-font-sans);"
      >
    @else
      <input
        data-slot="entry-input"
        type="text"
        id="${fieldId}"
        value="${inputValue}"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded="${popupOpen ? "true" : "false"}"
        aria-controls="${listboxId}"
        aria-autocomplete="list"
        placeholder="${hasTags ? null : placeholder}"
        autocomplete="off"
        disabled="${inputDisabled}"
        aria-disabled="${maxReached && !disabled ? "true" : null}"
        aria-invalid="${invalid ? "true" : null}"
        l:model.debounce.200ms="inputValue"
        class="min-w-[6rem] flex-1 border-0 bg-transparent px-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none placeholder:text-[var(--lv-color-muted)] disabled:cursor-not-allowed"
        style="font-family:var(--lv-font-sans);"
      >
    @endif

    @if(showClearAll)
      <button
        type="button"
        data-slot="clear-all"
        aria-label="Clear all tags"
        l:click="clearAll"
        class="ml-auto inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] p-[var(--lv-space-1)] text-[var(--lv-color-muted)] transition-colors hover:text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      ><svg aria-hidden="true" focusable="false" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/></svg></button>
    @endif
  </div>

  <%-- Suggestion popup: rendered when mode is not free and popupOpen is true --%>
  @if(hasPopup && popupOpen)
    <div
      data-slot="suggestions-popup"
      id="${listboxId}"
      role="listbox"
      aria-label="Suggestions"
      class="mt-[var(--lv-space-1)] w-full overflow-auto rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] shadow-[var(--lv-shadow-md)]"
      style="max-height:16rem;z-index:var(--lv-z-popover);font-family:var(--lv-font-sans);"
    >
      @if(suggestionList.isEmpty())
        <div class="px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted)]">No matches</div>
      @else
        @for(var sug : suggestionList)
          !{var _sid_ = new StringOutput();}
          !{Escape.htmlAttribute(sug.get("id") != null ? sug.get("id") : "", _sid_);}
          !{var _slabel_ = sug.get("label") != null ? sug.get("label") : "";}
          !{var _sugAttr_ = new StringOutput();}
          !{_sugAttr_.writeContent(" data-suggestion-id=\"");}
          !{Escape.htmlAttribute(sug.get("id") != null ? sug.get("id") : "", _sugAttr_);}
          !{_sugAttr_.writeContent("\"");}
          <div
            role="option"
            data-lievit-item
            aria-selected="false"
            l:click="selectSuggestion"
            $unsafe{_sugAttr_.toString()}
            class="flex cursor-pointer items-center px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-popover-fg)] transition-colors hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus:bg-[var(--lv-color-accent)] focus:outline-none"
          >${_slabel_}</div>
        @endfor
      @endif
    </div>
  @endif

  <%-- Live region: announces add/remove/max-reached/no-matches to screen readers --%>
  <span
    role="status"
    aria-live="polite"
    aria-atomic="true"
    id="${liveRegionId}"
    data-slot="live-region"
    class="sr-only"
    style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(100%);border:0;"
  ></span>
</div>
