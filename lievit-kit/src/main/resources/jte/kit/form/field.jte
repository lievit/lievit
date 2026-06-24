@import io.lievit.kit.AdminFormView
@import io.lievit.kit.SelectOption
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.form.field - the FIELD-TYPE DISPATCH: renders ONE AdminFormView.FieldView as the
  matching lievit-ui control, wrapped in the lievit-ui `field` partial for the shared field-wrapper
  chrome (label + required-less, error(s), per-field aria wiring). The single canonical place every
  kit-Form screen renders a typed field the same way (moved out of the per-adopter gest template).

  It switches on the field's normalized control tag (FieldView.control() == FieldOptions.control(),
  a token decoupled from the Java class name so a heavy island type degrades to `placeholder`):

    text                 -> @@template.lievit.input(type="text")
    email/number/password-> @@template.lievit.input(type=inputType)   (FieldOptions.inputType)
    textarea             -> @@template.lievit.textarea(rows)
    select               -> @@template.lievit.native-select (value!=label via an <option> content slot)
    combobox             -> @@template.lievit.combobox (searchable belongsTo, preload | lazy)
    belongsTo            -> @@template.lievit.native-select (plain relation, eager <option>s)
    checkbox             -> @@template.lievit.checkbox (inline label)
    radio                -> @@template.lievit.radio-group (value->label option map)
    toggle               -> @@template.lievit.switch (inline label)
    date                 -> @@template.lievit.date-picker (native <input type=date>)
    hidden               -> a bare <input type=hidden> (NO field-wrapper chrome)
    placeholder          -> a disabled stand-in + "(field type X: island pending)" note (heavy island
                            field types whose lievit-ui primitive is not yet built: file-upload,
                            rich-editor, markdown, code, repeater, builder, tags, key-value, color)

  Server-first: every control is a real native element bound with l:model (POSTs JS-off + wire commit
  when the runtime is present), strict-CSP clean (no inline <script>/on*). The field-wrapper aria ids
  are deterministic from `forId` (description = <forId>-description, error = <forId>-error), so the
  control is threaded its own describedBy = <forId>-error + invalid flag.

  JTE STATIC-CHECKER RULE: each top-level branch below emits a SELF-CONTAINED fragment (a complete
  @@template.lievit.field(...) call, or the bare hidden input), exactly like kit.table.rich-cell. The
  @@if/@@elseif never opens a different ROOT tag inside one shared element, so the checker is happy.

  Params:
    field - the AdminFormView.FieldView to render (its control() drives the dispatch, options() the knobs).
--%>
@param AdminFormView.FieldView field
!{var opts = field.options();}
!{var control = field.control();}
!{var fieldId = field.name();}
!{var fieldStatus = field.hasErrors() ? "error" : null;}
!{var fieldMessage = field.errors().isEmpty() ? null : field.errors().get(0);}
<%--
  v-next control API changes:
  - combobox: removed multiple=, model=
  - checkbox: removed label= (label goes in the field wrapper), invalid= -> ariaInvalid=,
              describedBy= -> ariaDescribedBy=, removed model=
  - radio-group: removed options=Map (now optionIds=List + optionLabels=List),
                 ariaLabel= -> groupLabel=, removed invalid=, describedBy=, model=
  - switch: removed id=, label= (label goes in the field wrapper), removed model=; use ariaLabel=
  - input: removed describedBy=, removed model=
--%>
<%-- radio-group takes separate optionIds + optionLabels lists (v-next). --%>
!{var radioOptionIds = new java.util.ArrayList<String>();}
!{var radioOptionLabels = new java.util.ArrayList<String>();}
!{for (SelectOption option : opts.options()) { radioOptionIds.add(option.value()); radioOptionLabels.add(option.label()); }}

@if(control.equals("hidden"))
  <%-- hidden: bare input, no label / wrapper chrome (Filament's Hidden field). --%>
  <input type="hidden" id="${fieldId}" name="${field.name()}" value="${field.value()}" l:model="${field.name()}">
@elseif(control.equals("textarea"))
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.textarea(name = field.name(), id = fieldId, value = field.value(),
      rows = opts.rows() > 0 ? opts.rows() : 3, describedBy = fieldId + "-msg", invalid = field.hasErrors(),
      model = field.name())`)
@elseif(control.equals("select"))
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.native-select(name = field.name(), id = fieldId,
      ariaLabel = field.label(), invalid = field.hasErrors(), model = field.name(), content = @`
        @for(SelectOption option : opts.options())
          <option value="${option.value()}" selected="${option.value().equals(field.value())}">${option.label()}</option>
        @endfor
      `)`)
@elseif(control.equals("belongsTo"))
  <%-- plain relation: eager native <select> of related rows (value = id, label = display). --%>
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.native-select(name = field.name(), id = fieldId,
      ariaLabel = field.label(), placeholder = "Select...", invalid = field.hasErrors(), model = field.name(), content = @`
        @for(SelectOption option : opts.options())
          <option value="${option.value()}" selected="${option.value().equals(field.value())}">${option.label()}</option>
        @endfor
      `)`)
@elseif(control.equals("combobox"))
  <%-- searchable relation: the server-first combobox. v-next: multiple= and model= removed. --%>
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.combobox(name = field.name(), id = fieldId, ariaLabel = field.label(),
      placeholder = "Select...", invalid = field.hasErrors(), content = @`
        @for(SelectOption option : opts.options())
          <option value="${option.value()}" selected="${option.value().equals(field.value())}">${option.label()}</option>
        @endfor
      `)`)
@elseif(control.equals("checkbox"))
  <%-- v-next checkbox: label= removed (label in field wrapper), invalid->ariaInvalid, describedBy->ariaDescribedBy, model= removed. --%>
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.checkbox(name = field.name(), id = fieldId,
      checked = "true".equals(field.value()) || "on".equals(field.value()),
      ariaInvalid = field.hasErrors(), ariaDescribedBy = field.hasErrors() ? fieldId + "-msg" : null)`)
@elseif(control.equals("radio"))
  <%-- v-next radio-group: optionIds+optionLabels lists, groupLabel=, invalid/describedBy/model removed. --%>
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.radio-group(name = field.name(), groupLabel = field.label(),
      value = field.value(), optionIds = radioOptionIds, optionLabels = radioOptionLabels)`)
@elseif(control.equals("toggle"))
  <%-- v-next switch: id= / label= / model= removed; use ariaLabel= for the accessible name.
       asCheckbox=true required for form POST binding (name= only renders on <input>, not <button>). --%>
  @template.lievit.field(controlId = fieldId, label = field.label(), layout = "horizontal", status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.switch(asCheckbox = true, name = field.name(), ariaLabel = field.label(),
      checked = "true".equals(field.value()) || "on".equals(field.value()))`)
@elseif(control.equals("date"))
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.date-picker(name = field.name(), id = fieldId, value = field.value(),
      invalid = field.hasErrors(), describedBy = fieldId + "-msg", model = field.name())`)
@elseif(control.equals("placeholder"))
  <%-- heavy island field type: a disabled stand-in + the island-pending backflow note. --%>
  @template.lievit.field(controlId = fieldId, label = field.label(),
    content = @`
      <div data-slot="kit-form-field-placeholder" data-field-type="${field.type()}"
           class="flex min-h-[var(--lv-space-9)] w-full items-center rounded-[var(--lv-radius-md)] border border-dashed border-[var(--lv-color-border)] bg-[var(--lv-color-muted-bg)] px-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">
        @if(opts.hasNote())${opts.note()}@else(field type ${field.type()}: island pending)@endif
      </div>
    `)
@else
  <%-- text + the input-family (email / number / password / tel / url / search) via FieldOptions.inputType.
       v-next input: describedBy= and model= removed. --%>
  @template.lievit.field(controlId = fieldId, label = field.label(), status = fieldStatus, message = fieldMessage,
    content = @`@template.lievit.input(name = field.name(), id = fieldId,
      type = opts.inputType().isBlank() ? "text" : opts.inputType(), value = field.value(),
      invalid = field.hasErrors())`)
@endif
