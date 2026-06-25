@import dev.lievit.kit.AdminFormView
@import dev.lievit.kit.page.KitFormView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.form - the canonical Filament FORM chrome, rendered from a KitFormView onto the
  lievit-ui form / field / label / input / textarea / native-select / combobox / checkbox /
  radio-group / switch / date-picker / button partials. The form-side twin of kit.table: the OTHER
  builders follow the SAME pattern set by the table reference.

  It renders a resource's create / edit page as the full Filament form, server-first (a native
  <form> that POSTs JS-off; every control bound with l:model so it commits over the wire when the
  runtime is present; strict CSP -> no inline <script>/on*):

    1  form heading                                  -> <h1 data-admin-heading>
    2  form-level (record) error region              -> lievit.form's role=alert form-error slot
    3  one field per AdminFormView.FieldView          -> @@template.kit.form.field (the type dispatch),
       wrapped per-field in lievit.field (label + error(s) + aria wiring); hidden fields render bare.
    4  footer action row (submit + cancel)           -> button partial (submit) + cancel <a href>

  Filament groups a schema into sections/columns; the kit form view-model is a FLAT field list today
  (Form has no section concept), so the fields render as one vertical stack. When the model grows a
  section projection, this layout gains the grouping with no change to kit.form.field.

  Params:
    form - the KitFormView render bundle (the AdminFormView + the POST action / cancel href / labels).
    csrf - the hidden CSRF field slot the native <form> carries so it POSTs JS-off under strict CSP
           (Spring: @`<input type="hidden" name="${_csrf.parameterName}" value="${_csrf.token}">`);
           null when the adopter wires CSRF some other way (or in a render-only test).
--%>
@param KitFormView form
@param gg.jte.Content csrf = null
!{AdminFormView view = form.view();}
<div data-slot="kit-form" data-admin-form data-editing="${view.editing()}" class="w-full max-w-[40rem]" style="font-family:var(--lv-font-sans);">

  <%-- 1. Form heading. --%>
  <h1 data-admin-heading class="mb-[var(--lv-space-4)] text-[length:var(--lv-text-xl)] font-[var(--lv-font-semibold)] text-[var(--lv-color-fg)]">${view.heading()}</h1>

  <%-- 2 + 3 + 4. The native <form>: form-level error, the field stack, the footer action row.
       v-next form takes errors=List<Map<String,String>> (fieldId + message per entry).
       Record errors have no fieldId; pass "" so the form summary region shows them as a list. --%>
  !{var _recErrors = new java.util.ArrayList<java.util.Map<String, String>>();}
  !{for (String msg : view.recordErrors()) { _recErrors.add(java.util.Map.of("fieldId", "", "message", msg)); }}
  @template.lievit.form(id = "kit-form", action = form.action(),
    errors = _recErrors,
    content = @`
      @if(csrf != null)${csrf}@endif

      <%-- 3. One field per declared field, in declaration order. --%>
      @for(AdminFormView.FieldView field : view.fields())
        <div data-admin-field="${field.name()}" data-field-control="${field.control()}">
          @template.kit.form.field(field = field)
        </div>
      @endfor

      <%-- 4. Footer action row: submit (primary) + cancel (secondary <a href> back to the list). --%>
      <div data-slot="kit-form-actions" class="flex items-center gap-[var(--lv-space-2)] pt-[var(--lv-space-2)]">
        @template.lievit.button(type = "submit", variant = "primary",
          dataAttrs = java.util.Map.of("admin-submit", "true"), content = @`${form.submitLabel()}`)
        @if(form.hasCancelUrl())
          @template.lievit.button(href = form.cancelUrl(), variant = "ghost",
            dataAttrs = java.util.Map.of("admin-cancel", "true"), content = @`${form.cancelLabel()}`)
        @endif
      </div>
    `)
</div>
