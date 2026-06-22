<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tags-input partial -- a free-text TAGS field: existing tags shown as removable chips +
  a text input to add more, with optional suggestions (Filament's TagsInput; shadcn composes
  Badge + Input). The committed tags POST as a REPEATED `name` (one hidden input per tag).

  TIER: PARTIAL (+ optional enhancer, ADR-0012 server-first). Each committed tag is a chip carrying
  a hidden <input name=...> with the tag's value, so the set POSTs natively as a repeated `name`
  with ZERO JavaScript. The add-input is a plain <input>; JS-OFF an explicit "Add" submit button
  (name=`<name>__add`) round-trips to the server, which appends the tag and re-renders -- a working
  no-JS path. JS-ON the CSP-clean enhancer intercepts Enter / comma / the Add button to append a
  chip + its hidden input in place (no round-trip), removes a chip by deleting its hidden input, and
  offers the suggestions as a quick-pick. The hidden inputs stay the form source of truth either way.

  STRUCTURE (scientific decision rule): a JS-only token field reimplements the chips, the
  add/remove and the value plumbing in script and breaks no-JS submit. Hidden <input>s per tag give
  the repeated-name POST for free from the platform, so they are the base layer; the chip editing is
  an enhancement on top, never the value itself.

  A11y (WAI-ARIA): the add-input is a labelled text <input> (pass `label` for a visible <label for>
  or `ariaLabel`). Each chip's remove is a real <button type=button> with an aria-label naming the
  tag it drops; an aria-live region announces add/remove. The suggestions are a labelled list of
  real <button>s. `invalid` sets aria-invalid + a danger ring; `describedBy` points at an external
  error element.

  Params:
    String name                       the field name (the committed tags POST as a repeated `name`).
    String id          = name         the add-input's id (for a <label for>); defaults to name.
    java.util.List<String> values = null  the already-committed tags (rendered as chips).
    java.util.List<String> suggestions = null  optional quick-pick suggestions (JS-on).
    String label       = null         visible <label> text for the add-input.
    String ariaLabel   = null         aria-label when there is no visible label.
    String describedBy = null         id of an external hint/error element (aria-describedby).
    String placeholder = "Add a tag..."  add-input placeholder.
    String addLabel    = "Add"        the JS-off Add submit button text.
    boolean disabled   = false        disables the control.
    boolean invalid    = false        danger ring + aria-invalid="true".
    String cssClass    = ""           extra utility classes on the wrapper.

  Usage:
    @@template.lievit.tags-input(name = "etichette", label = "Etichette", values = contatto.etichette(),
      suggestions = java.util.List.of("urgente", "richiamare", "trattativa"))
--%>
@param String name
@param String id = null
@param java.util.List<String> values = null
@param java.util.List<String> suggestions = null
@param String label = null
@param String ariaLabel = null
@param String describedBy = null
@param String placeholder = "Add a tag..."
@param String addLabel = "Add"
@param boolean disabled = false
@param boolean invalid = false
@param String cssClass = ""

!{var inputId = (id != null && !id.isBlank()) ? id : name;}
!{var tags = values != null ? values : java.util.List.<String>of();}
!{var hasSuggestions = suggestions != null && !suggestions.isEmpty();}

<div
  data-slot="tags-input"
  data-lievit-tags-input
  data-name="${name}"
  data-disabled="${disabled ? "true" : null}"
  data-invalid="${invalid ? "true" : null}"
  class="flex flex-col gap-[var(--lv-space-2)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(label != null && !label.isBlank())
    <label for="${inputId}" data-slot="tags-input-label" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-fg)]">${label}</label>
  @endif

  <div
    data-slot="tags-input-control"
    data-invalid="${invalid ? "true" : null}"
    data-disabled="${disabled ? "true" : null}"
    class="flex flex-wrap items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-input)] bg-[var(--lv-color-bg)] p-[var(--lv-space-1)] shadow-[var(--lv-shadow-xs)] transition-[color,box-shadow] focus-within:border-[var(--lv-color-ring)] focus-within:shadow-[var(--lv-ring)] data-[invalid=true]:border-[var(--lv-color-destructive)] data-[disabled=true]:opacity-50"
  >
    <div data-slot="tags-input-chips" data-tags-input-chips class="contents">
      @for(String tag : tags)
        <span data-slot="tags-input-chip" data-tags-input-chip="${tag}" class="inline-flex items-center gap-[var(--lv-space-1)] rounded-full border border-transparent bg-[var(--lv-color-secondary)] px-[var(--lv-space-2)] py-[2px] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none text-[var(--lv-color-secondary-fg)]">
          <input type="hidden" data-slot="tags-input-value" data-tags-input-value name="${name}" value="${tag}">
          <span data-slot="tags-input-chip-label">${tag}</span>
          <button
            type="submit"
            data-slot="tags-input-remove"
            data-tags-input-remove="${tag}"
            name="${name}__remove"
            value="${tag}"
            aria-label="Remove ${tag}"
            disabled="${disabled}"
            class="-mr-[2px] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed"
            style="color:inherit;"
          ><svg aria-hidden="true" focusable="false" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </span>
      @endfor
    </div>

    <input
      data-slot="tags-input-field"
      data-tags-input-field
      type="text"
      id="${inputId}"
      placeholder="${placeholder}"
      autocomplete="off"
      disabled="${disabled}"
      aria-label="${ariaLabel}"
      aria-describedby="${describedBy}"
      aria-invalid="${invalid ? "true" : null}"
      class="h-[var(--lv-space-7)] min-w-[6rem] flex-1 border-0 bg-transparent px-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] outline-none placeholder:text-[var(--lv-color-muted-fg)] disabled:cursor-not-allowed"
      style="font-family:var(--lv-font-sans);"
    >

    <%-- JS-OFF: an explicit Add submit round-trips to the server (the enhancer hides it JS-on). --%>
    <button
      type="submit"
      data-slot="tags-input-add"
      data-tags-input-add
      name="${name}__add"
      value="1"
      disabled="${disabled}"
      class="inline-flex h-[var(--lv-space-7)] shrink-0 items-center rounded-[var(--lv-radius-sm)] px-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-primary)] outline-none transition-colors hover:bg-[var(--lv-color-muted)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
    >${addLabel}</button>
  </div>

  @if(hasSuggestions)
    <div data-slot="tags-input-suggestions" data-tags-input-suggestions role="group" aria-label="Suggestions" class="flex flex-wrap items-center gap-[var(--lv-space-1)]">
      @for(String suggestion : suggestions)
        <button
          type="button"
          data-slot="tags-input-suggestion"
          data-tags-input-suggestion="${suggestion}"
          disabled="${disabled}"
          class="inline-flex items-center rounded-full border border-dashed border-[var(--lv-color-border)] bg-transparent px-[var(--lv-space-2)] py-[2px] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)] outline-none transition-colors hover:border-[var(--lv-color-primary)] hover:text-[var(--lv-color-fg)] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed disabled:opacity-50"
          style="font-family:var(--lv-font-sans);"
        >${suggestion}</button>
      @endfor
    </div>
  @endif

  <span data-slot="tags-input-live" data-tags-input-live aria-live="polite" class="sr-only"></span>
</div>
