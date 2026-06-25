@import dev.lievit.kit.AdminAction
@import dev.lievit.kit.ActionVariant
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.action - render ONE first-class admin action (dev.lievit.kit.AdminAction) as the
  Filament action trigger, onto the lievit-ui button / link / badge / icon partials. Sibling of
  kit/table.jte: the kit ships THIS, so an adopter stops hand-assembling the action affordance per
  resource. A header/row/bulk cluster renders it through kit/action/group.jte.

  THE ACTION AFFORDANCE (Filament's action pipeline, the trigger end). An action is, by ActionVariant:
    BUTTON       -> @@template.lievit.button (filled, colour->variant)         the default
    ICON_BUTTON  -> @@template.lievit.button(iconOnly=true)                     tight rows / toolbars
    LINK         -> @@template.lievit.link                                      inline / row "Edit"
    BADGE        -> @@template.lievit.badge wrapped in the same activation       a status-pill action
  and, by what running it DOES (server-first, every path a real browser primitive):
    1. URL navigation (AdminAction.isUrlNavigation()): a real <a href> to action.urlFor(record);
       opensUrlInNewTab() => target=_blank rel=noopener. The browser navigates JS-off.
    2. confirmed action (action.requiresConfirmation()): renders the TRIGGER that opens the action's
       modal (kit/action/modal.jte hosts the modal itself under the shared `modalId`); the trigger is
       a native <dialog> invoker button (command="show-modal" commandfor) so no JS is shipped.
    3. plain wire action: an l:click="<action name>" button carrying the per-row recordId through the
       button partial's SAFE wireArgs channel (data-id, HTML-escaped) -- never the trusted $unsafe
       attrs channel, which would XSS a DB-derived id.

  COLOUR -> VARIANT. The kit action carries a SEMANTIC colour (primary/danger/info/success/warning/
  gray, AdminAction.color()); the button partial speaks shadcn VARIANTS (primary/secondary/
  destructive/ghost/outline). The bridge: danger -> destructive, (null|primary) -> primary, else
  secondary. A destructive action (DeleteAction) thus lands red without the caller restating it.

  CRITICAL JTE RULE (the table.jte sortable-head lesson): NEVER open a DIFFERENT root tag per @if
  branch -- the static checker rejects it, and a half-open <a>/<button> split null-hrefs. So the
  variant/url/wire branches each render a COMPLETE element; we never split one element across @if.

  Params:
    action     - the AdminAction to render (name / label / icon / colour / variant / url / confirm).
    record     - the host record the action operates on (or null for a header/resource-scoped action);
                 used to resolve the url and per-record visibility. Plain Object (the kit's url mapper
                 + visibility predicates are Object-typed).
    recordId   - the row id carried into a wire/confirm action as the SAFE wireArgs `id` (or "" for a
                 resource-scoped action). HTML-escaped by the button partial; never goes through attrs.
    modalId    - the <dialog> id a confirmed/modal action's trigger opens (paired with kit/action/modal.jte
                 which renders that dialog under the SAME id); "" when the action needs no modal.
    size       - the trigger size ("sm" | "md" | "lg"), passed through to the button/link.
--%>
@param AdminAction<?> action
@param Object record = null
@param String recordId = ""
@param String modalId = ""
@param String size = "sm"
<%-- semantic colour -> button variant (the danger->destructive bridge); null/primary stay primary. --%>
!{var color = action.color();}
!{var variant = "danger".equals(color) || "destructive".equals(color) ? "destructive"
    : (color == null || color.isBlank() || "primary".equals(color)) ? "primary"
    : "secondary";}
!{var iconOnly = action.variant() == ActionVariant.ICON_BUTTON;}
!{var asLink = action.variant() == ActionVariant.LINK;}
!{var label = action.label();}
!{var icon = action.icon();}
!{var hasIcon = icon != null && !icon.isBlank();}
!{var wireArgs = recordId == null || recordId.isBlank()
    ? java.util.Map.<String, String>of()
    : java.util.Map.of("id", recordId);}
<%-- A confirmed action opens its modal (the dialog lives in kit/action/modal.jte under modalId). --%>
!{var confirmTrigger = action.requiresConfirmation() && !modalId.isBlank();}
!{var navUrl = action.isUrlNavigation() ? action.urlFor(record).orElse("") : "";}

@if(confirmTrigger)
  <%-- 2. Confirmed action: a native <dialog> invoker (command/commandfor) opening the action modal.
       Kept a real <button> so it is keyboard/focus correct; the modal is rendered separately. --%>
  <button
    type="button"
    data-slot="kit-action-trigger"
    data-kit-action="${action.name()}"
    data-kit-action-confirm="true"
    command="show-modal"
    commandfor="${modalId}"
    aria-haspopup="dialog"
    title="${action.tooltip()}"
    disabled="${action.isDisabled()}"
    class="inline-flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] whitespace-nowrap rounded-[var(--lv-radius-md)] border border-transparent h-[var(--lv-space-8)] px-[var(--lv-space-3)] text-[length:var(--lv-text-xs)] cursor-pointer outline-none transition-[color,box-shadow] focus-visible:shadow-[var(--lv-ring)] disabled:opacity-50 disabled:cursor-not-allowed ${"destructive".equals(variant) ? "bg-[var(--lv-color-destructive)] text-[var(--lv-color-destructive-fg)]" : "secondary".equals(variant) ? "bg-[var(--lv-color-secondary)] text-[var(--lv-color-secondary-fg)]" : "bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)]"}"
    style="font-family:var(--lv-font-sans);"
  >
    @if(hasIcon)<span aria-hidden="true" class="inline-flex items-center">@template.lievit.icon(name = icon, size = "1rem")</span>@endif
    <span>${label}</span>
  </button>
@elseif(action.isUrlNavigation())
  <%-- 1. URL navigation: a real <a href>. asLink renders the link affordance, else a button-styled
       anchor; a navigation with no resolvable url degrades to an inert span via the partials. --%>
  @if(asLink)
    @template.lievit.link(href = navUrl.isBlank() ? null : navUrl,
      external = action.opensUrlInNewTab(),
      content = @`@if(hasIcon)@template.lievit.icon(name = icon, size = "1rem")@endif${label}`)
  @else
    @template.lievit.button(variant = variant, size = size, iconOnly = iconOnly,
      href = navUrl.isBlank() ? null : navUrl,
      ariaLabel = iconOnly ? label : null,
      disabled = action.isDisabled() || navUrl.isBlank(),
      attrs = action.opensUrlInNewTab() ? "target=\"_blank\" rel=\"noopener noreferrer\"" : "",
      dataAttrs = java.util.Map.of("kit-action", action.name()),
      content = @`@if(iconOnly)@template.lievit.icon(name = hasIcon ? icon : "external-link", size = "1rem")@else@if(hasIcon)@template.lievit.icon(name = icon, size = "1rem")@endif<span>${label}</span>@endif`)
  @endif
@else
  <%-- 3. Plain wire action: l:click="<name>" + the SAFE per-row id arg (escaped data-id). --%>
  @if(asLink)
    <%-- a LINK-variant wire action: an l:click anchor with no href (the link partial is href-only,
         so render a real <a> here; recordId rides the escaped data-id, never attrs). --%>
    @template.lievit.button(variant = "ghost", size = size, wireClick = action.name(),
      wireArgs = wireArgs, disabled = action.isDisabled(),
      dataAttrs = java.util.Map.of("kit-action", action.name()),
      cssClass = "!h-auto !px-0 !border-0 text-[var(--lv-color-primary)] hover:underline",
      content = @`@if(hasIcon)@template.lievit.icon(name = icon, size = "1rem")@endif<span>${label}</span>`)
  @else
    @template.lievit.button(variant = variant, size = size, iconOnly = iconOnly,
      wireClick = action.name(), wireArgs = wireArgs,
      ariaLabel = iconOnly ? label : null,
      disabled = action.isDisabled(),
      dataAttrs = java.util.Map.of("kit-action", action.name()),
      content = @`@if(iconOnly)@template.lievit.icon(name = hasIcon ? icon : "ellipsis", size = "1rem", label = label)@else@if(hasIcon)@template.lievit.icon(name = icon, size = "1rem")@endif<span>${label}</span>@endif`)
  @endif
@endif
