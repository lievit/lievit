<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui switch partial -- a native <input type="checkbox"> styled as a sliding switch.

  TIER: STATIC presentational -> JTE partial. The on/off state lives in a native checkbox: it
  carries the checkbox role, Space/Enter activation and the checked/disabled semantics for free,
  and submits its `value` ("on") only when on -- native checkbox semantics the Lit island had to
  reimplement with role=switch + a manual key handler. `l:model` binds the native change event.

  STRUCTURE (scientific decision rule): shadcn's Switch is a Radix button reimplementing the
  switch role in JS. The server-first path uses a native checkbox (which POSTs JS-off) skinned as
  a switch with `appearance-none`, a token track and a `before:` thumb that translates on
  `:checked` (the well-known CSS-only switch). We accept the role-switch-vs-role-checkbox
  trade-off in favour of native semantics + no JS; a checkbox reads as a binary toggle and both
  patterns are valid for an on/off control (WAI-ARIA).

  A11y (WAI-ARIA): a real <input type=checkbox> with its own id/name. An external <label for> or
  the optional inline `label` names it; `ariaLabel` provides an accessible name otherwise. The
  track + thumb are decorative CSS.

  Params:
    String name                 the switch's name (POSTs `value` under this name when on).
    String id          = name   the input's id (for a <label for>); defaults to name.
    String value       = "on"   submitted value when on (native checkbox default "on").
    boolean checked    = false  initial on state.
    boolean disabled   = false  disables + dims the control.
    String label       = null   optional inline label rendered after the switch.
    String ariaLabel   = null   aria-label when there is no visible label.
    String model       = null   l:model expression to bind this switch to a wire field.
    String cssClass    = ""      extra utility classes on the wrapper.

  Usage:
    @@template.switch(name = "notifiche", label = "Notifiche", checked = prefs.notifiche())
    @@template.switch(name = "dark", ariaLabel = "Tema scuro", model = "dark")
--%>
@param String name
@param String id = null
@param String value = "on"
@param boolean checked = false
@param boolean disabled = false
@param String label = null
@param String ariaLabel = null
@param String model = null
@param String cssClass = ""

!{var switchId = (id != null && !id.isBlank()) ? id : name;}
!{var hasLabel = label != null && !label.isBlank();}

<label
  for="${switchId}"
  data-slot="switch"
  data-disabled="${disabled}"
  class="inline-flex items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] select-none data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <input
    data-slot="switch-control"
    type="checkbox"
    role="switch"
    id="${switchId}"
    name="${name}"
    value="${value}"
    checked="${checked}"
    disabled="${disabled}"
    aria-label="${ariaLabel}"
    l:model="${model}"
    class="relative inline-flex h-[1.15rem] w-[2rem] shrink-0 cursor-pointer appearance-none items-center rounded-full border-2 border-transparent bg-[var(--lv-color-input)] outline-none transition-colors before:pointer-events-none before:block before:size-[0.85rem] before:translate-x-0 before:rounded-full before:bg-[var(--lv-color-bg)] before:shadow-[var(--lv-shadow-sm)] before:transition-transform checked:bg-[var(--lv-color-primary)] checked:before:translate-x-[0.85rem] focus-visible:shadow-[var(--lv-ring)] disabled:cursor-not-allowed"
  >
  @if(hasLabel)
    <span data-slot="switch-label">${label}</span>
  @endif
</label>
