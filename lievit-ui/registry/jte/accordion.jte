@import java.util.List
@import java.util.Set
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui accordion wire template -- a vertically stacked list of panels driven by
  server-authoritative open state.

  TIER: WIRE. Open-state is a server fact (@Wire Set<String> expandedIds); the server
  validates which panels are expanded, enforces single/multiple mode invariants, and
  re-renders this template on every toggle. The client morphs the resulting HTML;
  focus survives the morph on the activated header button (ADR-0019).

  STRUCTURE (scientific decision rule):
    WAI-ARIA APG Accordion (https://www.w3.org/WAI/ARIA/apg/patterns/accordion/): each
    panel header is a real native <button> inside a heading element (role="heading"
    aria-level). The native <button> supplies role, Enter/Space activation, and Tab
    traversal for free -- no enhancer, no roving tabindex, no focus-trap. The panel body
    carries role="region" + aria-labelledby to form a landmark for screen reader
    navigation. Hidden panels use the HTML `hidden` attribute (removes from a11y tree +
    Tab order by default). This is the canonical "platform does it all" WIRE exemplar:
    the server holds truth, the platform supplies keyboard, the morph preserves focus.

    Inventory reference: Ant Design Collapse (single/multiple, ghost, borderless,
    panel-level disable, collapsible single). Original generation; no Ant Design code copied.
    Styling: inspired by Tailwind UI accordion; original generation over --lv-* tokens.

  A11y (WAI-ARIA APG Accordion):
    - accordion root: data-slot="accordion", no explicit ARIA role (generic container).
    - panel header: div[role="heading"][aria-level="${panel.level}"] (no tag-name
      expression; role="heading" + aria-level is the JTE-safe equivalent of <h3>).
    - header button: native <button type="button">, data-slot="accordion-header",
      id="header-btn-${panel.id}", aria-expanded="true|false",
      aria-controls="panel-${panel.id}". Native button supplies role=button + Enter/Space.
    - aria-disabled="true" on the header button when the panel is truly-disabled OR when
      it is in the non-collapsible-expanded state (single mode, collapsible=false). In
      both cases the native `disabled` attribute is also present for truly-disabled panels;
      aria-disabled alone distinguishes "action suppressed" (non-collapsible) vs "panel
      excluded" (disabled).
    - panel region: div[id="panel-${panel.id}"][role="${panelRole}"]
      [aria-labelledby="header-btn-${panel.id}"] when panelRole is non-empty. The `hidden`
      HTML attribute is present when the panel is collapsed.
    - chevron: aria-hidden="true" (decorative); rotates 180deg via CSS transition on the
      header button's data-expanded attribute.
    Keyboard (all platform-supplied, no enhancer):
      Enter / Space on header button: fires l:click="toggle" -> server toggle action.
      Tab / Shift+Tab: standard page sequence, all header buttons + open panel content.
      ArrowDown/Up/Home/End: NOT defined by APG Accordion; intentionally absent.
    Focus: no trap, no roving tabindex. After toggle, morph preserves focus on the button.

  Params:
    List<Map<String,String>> panels  each entry: id, title, level (optional, default "3"),
                                     disabled (optional, "true" = disabled). The panel body
                                     markup is OWNED in the template body (WIRE copy-in model).
    Set<String> expandedIds          the currently expanded panel ids (server @Wire fact).
    String mode = "single"           "single" | "multiple" expansion mode.
    boolean collapsible = true       in single mode: whether the expanded panel can be
                                     collapsed; false = always-one-open, the expanded panel
                                     header gets aria-disabled="true".
    String variant = "default"       "default" | "ghost" | "borderless".
    String panelRole = "region"      role on the panel content div; "" = suppress (for trivial
                                     content where landmark clutter is a concern).
    String cssClass = ""             extra utility classes on the root container.
    String attrs = ""                TRUSTED raw attribute string ($unsafe) -- STATIC, author-
                                     typed strings only (wire root attrs, data-testid).

  Wire actions:
    l:click="toggle" data-id="${panel.id}" on each header <button>. The data-id value is
    the panel id escaped through Escape.htmlAttribute (the SAFE channel for per-row values).
    The action validates id in panels, no-ops on disabled panels and non-collapsible
    expanded panels.

  Usage:
    @@template.lievit.accordion(
        panels = java.util.List.of(
            java.util.Map.of("id", "alpha", "title", "Section one"),
            java.util.Map.of("id", "beta", "title", "Section two", "level", "4")
        ),
        expandedIds = component.expandedIds(),
        mode = "single",
        collapsible = true,
        variant = "default")
--%>
@param java.util.List<java.util.Map<String,String>> panels
@param java.util.Set<String> expandedIds
@param String mode = "single"
@param boolean collapsible = true
@param String variant = "default"
@param String panelRole = "region"
@param String cssClass = ""
@param String attrs = ""

<%-- Variant class: outer container styling. --%>
!{var variantStyle = switch (variant) {
    case "ghost"      -> "border:0;background:transparent;box-shadow:none;border-radius:0;";
    case "borderless" -> "border:0;background:transparent;box-shadow:none;border-radius:0;";
    default           -> "border:1px solid var(--lv-color-border);border-radius:var(--lv-radius-md);background:var(--lv-color-popover);box-shadow:var(--lv-shadow-xs);";
  };}

<%-- Inter-panel divider: default and ghost show dividers; borderless has none. --%>
!{var dividerStyle = "borderless".equals(variant) ? "" : "border-top:1px solid var(--lv-color-border);";}

<%-- Header base style (shared across all panels). Transition for the chevron rotate. --%>
!{var headerBtnBase = "display:flex;align-items:center;justify-content:space-between;gap:var(--lv-space-4);width:100%;border:0;cursor:pointer;background:transparent;padding:var(--lv-space-3) var(--lv-space-4);font-family:var(--lv-font-sans);font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);text-align:left;line-height:var(--lv-leading-tight);";}

<div
  data-slot="accordion"
  data-variant="${variant}"
  class="${cssClass}"
  style="${variantStyle}overflow:hidden;font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>
  @for(var panel : panels)
    !{var pid        = panel.getOrDefault("id", "");}
    !{var ptitle     = panel.getOrDefault("title", "");}
    !{var plevel     = panel.getOrDefault("level", "3");}
    !{var pdisabled  = "true".equals(panel.get("disabled"));}
    !{var isExpanded = expandedIds.contains(pid);}
    <%-- Non-collapsible-expanded: single mode + collapsible=false + this panel IS the expanded one. --%>
    !{var isNonCollapsibleExpanded = isExpanded && !collapsible && "single".equals(mode);}
    <%-- aria-disabled covers both: truly-disabled and non-collapsible-expanded. --%>
    !{var ariaDisabled = (pdisabled || isNonCollapsibleExpanded) ? "true" : null;}

    <%-- SAFE-escaped data-id for the wire action argument. --%>
    !{var dataIdOut = new StringOutput();}
    !{Escape.htmlAttribute(pid, dataIdOut);}
    !{var safeDataId = dataIdOut.toString();}

    <%-- Per-panel divider: suppress for the very first item when the variant has an outer border.
         index() not available in JTE @for over a List; use the first-item check by comparing pid. --%>
    !{var isFirst = panels.get(0).equals(panel);}
    !{var panelDivider = isFirst ? "" : dividerStyle;}

    <%-- Header colour: expanded uses popover-fg (primary emphasis); collapsed uses muted-fg (de-emphasis). --%>
    !{var headerColor = isExpanded
        ? "color:var(--lv-color-popover-fg);"
        : "color:var(--lv-color-muted-fg);";}

    <%-- Chevron rotation: data-expanded="true/false" on the button drives a CSS selector
         [data-expanded="true"] .lv-accordion-chevron { transform: rotate(180deg); }
         No inline style carrying logic; transition timing uses existing --lv-duration-fast + --lv-ease. --%>
    !{var chevronTransition = "transition:transform var(--lv-duration-fast) var(--lv-ease);";}

    <div
      data-slot="accordion-item"
      style="${panelDivider}"
    >
      <%-- Heading wrapper: role="heading" + aria-level is the JTE-safe equivalent of <h3>;
           tag-name expressions are forbidden by the JTE gate. --%>
      <div role="heading" aria-level="${plevel}">
        <button
          type="button"
          id="header-btn-$unsafe{safeDataId}"
          data-slot="accordion-header"
          data-expanded="${isExpanded ? "true" : "false"}"
          aria-expanded="${isExpanded ? "true" : "false"}"
          aria-controls="panel-$unsafe{safeDataId}"
          aria-disabled="${ariaDisabled}"
          disabled="${pdisabled}"
          l:click="toggle"
          data-id="$unsafe{safeDataId}"
          class="focus-visible:shadow-[var(--lv-ring)] hover:bg-[var(--lv-color-accent)] outline-none disabled:cursor-not-allowed disabled:opacity-[var(--lv-opacity-disabled)] transition-[background-color] duration-[var(--lv-duration-fast)]"
          style="${headerBtnBase}${headerColor}"
        >
          <span>${ptitle}</span>
          <span
            class="lv-accordion-chevron"
            aria-hidden="true"
            style="flex-shrink:0;display:inline-flex;color:var(--lv-color-muted-fg);${chevronTransition}"
          >
            @template.lievit.icon(name = "chevron-down", size = "1rem")
          </span>
        </button>
      </div>
      <%-- Panel region: hidden attribute when collapsed (removes from a11y tree + Tab order).
           role="region" + aria-labelledby is the APG landmark; panelRole="" suppresses it. --%>
      <div
        id="panel-$unsafe{safeDataId}"
        data-slot="accordion-panel"
        role="${panelRole.isBlank() ? null : panelRole}"
        aria-labelledby="${panelRole.isBlank() ? null : "header-btn-" + pid}"
        hidden="${!isExpanded}"
        style="padding:var(--lv-space-2) var(--lv-space-4) var(--lv-space-5);color:var(--lv-color-popover-fg);font-size:var(--lv-text-sm);line-height:var(--lv-leading);"
      >
      </div>
    </div>
  @endfor
</div>
