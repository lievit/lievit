@import io.lievit.kit.AdminFormView
@import io.lievit.kit.GlobalSearchResults
@import io.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.resource-form - the Filament resource CREATE / EDIT page (CreateRecord /
  EditRecord): the panel shell (kit/page.jte) wrapping a server-rendered <form> that binds an
  AdminFormView. One lievit-ui field+control per declared field (type-driven markup), per-field
  validation errors, record-level errors as an alert, and the submit / cancel actions; a failed POST
  re-renders with the submitted values kept (the AdminFormView.withErrors contract).

  FIELD DISPATCH: AdminFormView.FieldView carries the field's simple type name (TextField /
  TextareaField / ToggleField / SelectField / DateField ...). The common tier dispatches by that tag
  to the lievit-ui control partials; an unrecognised type falls back to a text input. The constant
  field WRAPPER (lievit.field: label + control slot + error) stays the root per field; only the inner
  CONTROL switches by type, so the JTE static-checker never sees a per-branch root-tag split.

  KNOWN MODEL GAP (backflow to the kit, not a template bug): FieldView is flattened to (name, label,
  type, value, errors) and does NOT carry the type-specific knobs (a SelectField's options, a
  Textarea's rows, a DateField's range). So a SelectField renders as a text input until the view-model
  projects its options; the type-driven dispatch is ready for them the moment it does.

  Server-first / strict-CSP: a real <form method=post> the browser submits (no SPA); the CSRF slot is
  the adopter's (Spring's hidden _csrf input). Every control is a real named input that POSTs JS-off.

  Params:
    page    - the KitPageView panel-chrome bundle.
    form    - the AdminFormView (heading / fields / recordErrors / editing).
    action  - the form POST target (the resource create / update route).
    cancelUrl - the cancel link target (back to the list); "" hides the cancel link.
    csrf    - the hidden CSRF field slot (Spring: @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`).
    searchResults - server-prefetched grouped global-search hits for the topbar; null => GET-only.
--%>
@param KitPageView page
@param AdminFormView form
@param String action
@param String cancelUrl = ""
@param gg.jte.Content csrf = null
@param GlobalSearchResults searchResults = null
@template.kit.page(
  page = page,
  searchResults = searchResults,
  content = @`
    <form method="post" action="${action}" data-slot="kit-resource-form" class="flex max-w-[var(--lv-container-2xl,42rem)] flex-col gap-[var(--lv-space-5)]" style="font-family:var(--lv-font-sans);">
      @if(csrf != null)${csrf}@endif

      <%-- Record-level errors (not tied to a single field): the Filament form-level error banner. --%>
      @if(!form.recordErrors().isEmpty())
        @template.lievit.alert(variant = "danger", icon = "circle-alert", heading = "Please fix the errors below", content = @`
          <ul class="m-0 list-disc pl-[var(--lv-space-4)]">
            @for(String err : form.recordErrors())
              <li>${err}</li>
            @endfor
          </ul>
        `)
      @endif

      @for(AdminFormView.FieldView field : form.fields())
        !{var type = field.type();}
        !{var fieldId = "kit-field-" + field.name();}
        @template.lievit.field(
          forId = fieldId,
          label = field.label(),
          errors = field.errors().isEmpty() ? null : field.errors(),
          control = @`
            @if("TextareaField".equals(type))
              @template.lievit.textarea(name = field.name(), id = fieldId, value = field.value(),
                invalid = field.hasErrors())
            @elseif("ToggleField".equals(type))
              @template.lievit.switch(name = field.name(), id = fieldId,
                checked = "true".equalsIgnoreCase(field.value()) || "on".equalsIgnoreCase(field.value()))
            @elseif("DateField".equals(type))
              @template.lievit.input(name = field.name(), id = fieldId, type = "date",
                value = field.value(), invalid = field.hasErrors())
            @else
              @template.lievit.input(name = field.name(), id = fieldId, type = "text",
                value = field.value(), invalid = field.hasErrors())
            @endif
          `)
      @endfor

      <div data-slot="kit-resource-form-actions" class="flex items-center gap-[var(--lv-space-2)] pt-[var(--lv-space-2)]">
        @template.lievit.button(variant = "primary", type = "submit",
          content = @`${form.editing() ? "Save changes" : "Create"}`)
        @if(cancelUrl != null && !cancelUrl.isBlank())
          @template.lievit.link(variant = "muted", label = "Cancel", href = cancelUrl)
        @endif
      </div>
    </form>
  `)
