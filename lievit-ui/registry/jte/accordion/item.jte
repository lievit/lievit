@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui accordion-item partial -- one disclosure panel in an accordion (or standalone).

  TIER: PARTIAL presentational. Native <details>/<summary> -- zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    WAI-ARIA APG Accordion (https://www.w3.org/WAI/ARIA/apg/patterns/accordion/): a native
    <details>/<summary> pair maps precisely to the APG disclosure pattern. The browser
    exposes aria-expanded on <summary> automatically, and Enter/Space/Tab are all platform-
    supplied. The panel body carries role="region" + aria-labelledby, forming an a11y
    landmark for substantial content (APG recommendation; suppressed via panelRole="" for
    trivial content). No enhancer, no roving tabindex, no focus trap.

    Uncontrolled: the caller omits open=; the browser manages expand/collapse state.
    Controlled: the caller binds open="${serverFact}" -- when the server holds which panels
    are expanded (e.g. a WIRE parent re-renders this template on each action), the open
    attribute reflects that truth. The item itself never declares a @Wire field.

    Single-open grouping: pass the same name= to sibling items; <details name=...> gives
    the platform single-open exclusivity for free (modern browsers, 2024+). Multiple-open:
    omit name=.

    Disabled: the summary button is rendered `disabled` (aria-disabled + pointer-events-none);
    the trigger blocks Enter/Space; the item remains visible but inert.

    Chevron animation: a span.lv-accordion-chevron inside the summary rotates 180deg when the
    <details> is open. The rotation is CSS-driven via the details[open] selector -- no JS, no
    inline style. The adopter provides the rule (or the accordion.css companion delivers it).
    Transition timing reads --lv-duration-fast + --lv-ease.

    Inventory reference: Ant Design Collapse item (disabled, collapsible header, custom header
    content). Original generation; no Ant Design code copied.
    Styling: inspired by Tailwind UI disclosure; original generation over --lv-* tokens.

  A11y (WAI-ARIA APG Accordion):
    - <details open="${open}">: native disclosure element; browser supplies aria-expanded on
      the <summary> child automatically.
    - <summary id="header-btn-${id}">: the trigger; native role=button + Enter/Space from
      the platform; list-style:none suppresses the default disclosure marker (the chevron is
      our own icon).
    - aria-controls="panel-${id}" on the <summary>: points to the content region.
    - Panel content <div id="panel-${id}" role="${panelRole}" aria-labelledby="header-btn-${id}">:
      landmark for screen reader navigation (when panelRole is non-empty, default "region").
    - Disabled state: aria-disabled="true" + pointer-events-none + tabindex="-1" on summary;
      the native <details> cannot be disabled itself, so we suppress the trigger.
    - Divider: a top border on the item (suppressed via noDivider=true for the first item or
      in borderless context).
    - Focus: no trap, no roving tabindex. Tab order = standard page sequence.
    - No live region (expand/collapse is visible in-place).
    - Stimulus migration: nothing to convert -- ZERO client JS by design (native <details>);
      no lv-* Stimulus controller is shipped or needed (chevron rotation is CSS, not JS).

  Params:
    String label                       the trigger label (the header text, HTML-escaped by JTE).
    gg.jte.Content content             the panel body markup (the caller's owned Content slot).
    String id            = "lv-acc"   id stem; summary gets id="header-btn-${id}",
                                       panel gets id="panel-${id}".
    String name          = null        <details> grouping name; siblings with the same name get
                                       single-open exclusivity via the platform.
    boolean open         = false       render this item expanded (<details open>); the controlled
                                       hook -- bind to your WIRE field: open="${field.contains(id)}".
    boolean disabled     = false       suppress trigger activation; aria-disabled + tabindex=-1.
    String panelRole     = "region"    role on the panel content div; pass "" to suppress
                                       (for trivial content where landmark clutter is a concern).
    boolean noDivider    = false       suppress the top border divider (use on the first item, or
                                       when the parent variant handles borders differently).
    String cssClass      = ""          extra utility classes on the <details> root.
    String attrs         = ""          TRUSTED raw attribute string ($unsafe) -- STATIC, author-typed
                                       strings only (data-testid, wire directives).

  Usage:
    Uncontrolled (browser manages state):
    @@template.lievit.accordion-item(label = "Section one", id = "s1",
        content = @@`<p>Body text.</p>`)

    Controlled (server fact drives open):
    @@template.lievit.accordion-item(label = "Section one", id = "s1",
        open = form.expandedPanels().contains("s1"),
        content = @@`<p>Body text.</p>`)

    Single-open group (platform handles exclusivity):
    @@template.lievit.accordion-item(label = "FAQ one", id = "faq1", name = "faq",
        content = @@`<p>Answer one.</p>`)
    @@template.lievit.accordion-item(label = "FAQ two", id = "faq2", name = "faq",
        content = @@`<p>Answer two.</p>`)

    Disabled item:
    @@template.lievit.accordion-item(label = "Locked section", id = "locked",
        disabled = true, content = @@`<p>Not accessible.</p>`)
--%>
@param String label
@param gg.jte.Content content
@param String id = "lv-acc"
@param String name = null
@param boolean open = false
@param boolean disabled = false
@param String panelRole = "region"
@param boolean noDivider = false
@param String cssClass = ""
@param String attrs = ""

!{var triggerId = "header-btn-" + id;}
!{var panelId = "panel-" + id;}

<%-- Top divider: present by default (separates sibling items); suppressed for first item
     or when the parent variant handles outer borders exclusively (borderless/ghost). --%>
!{var itemStyle = noDivider
    ? "display:block;"
    : "border-top:1px solid var(--lv-color-border);display:block;";}

<%-- Header base style: flex row, full-width, transparent background (the outer container
     provides the surface colour), consistent padding from spacing tokens. --%>
!{var summaryBase = "display:flex;align-items:center;justify-content:space-between;gap:var(--lv-space-4);width:100%;list-style:none;cursor:pointer;padding:var(--lv-space-3) var(--lv-space-4);font-family:var(--lv-font-sans);font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);text-align:left;line-height:var(--lv-leading-tight);color:var(--lv-color-popover-fg);background:transparent;border:0;";}

Disabled modifier: pointer-events off, opacity dim, cursor blocked.
!{var disabledStyle = disabled ? "pointer-events:none;opacity:var(--lv-opacity-disabled);cursor:not-allowed;" : "";}

<details
  data-slot="accordion-item"
  name="${name}"
  open="${open}"
  class="${cssClass}"
  style="${itemStyle}"
  $unsafe{attrs}
>
  <%-- Summary = the disclosure trigger.
       list-style:none removes the default marker (we supply our own chevron icon).
       ::-webkit-details-marker { display:none } is the WebKit equivalent; handled in accordion.css.
       aria-controls + role are redundant on native <summary> but harmless and improve AT compat.
       disabled: aria-disabled + tabindex=-1 block keyboard activation without hiding the item. --%>
  <summary
    data-slot="accordion-trigger"
    id="${triggerId}"
    aria-controls="${panelId}"
    aria-disabled="${disabled ? "true" : null}"
    tabindex="${disabled ? "-1" : null}"
    class="outline-none focus-visible:shadow-[var(--lv-ring)] hover:bg-[var(--lv-color-accent)] transition-[background-color] duration-[var(--lv-duration-fast)]"
    style="${summaryBase}${disabledStyle}"
  >
    <span>${label}</span>
    <%-- Chevron: decorative icon that rotates 180deg when the <details> is open.
         CSS rule in accordion.css: details[open] .lv-accordion-chevron { transform: rotate(180deg); }
         No inline style carries logic; transition timing reads existing motion tokens. --%>
    <span
      class="lv-accordion-chevron"
      aria-hidden="true"
      style="flex-shrink:0;display:inline-flex;color:var(--lv-color-muted-fg);transition:transform var(--lv-duration-fast) var(--lv-ease);"
    >
      @template.lievit.icon(name = "chevron-down", size = "1rem")
    </span>
  </summary>
  <%-- Panel content: role="region" + aria-labelledby forms an a11y landmark (APG).
       panelRole="" suppresses the role when content is trivial and landmark clutter is a concern.
       No `hidden` attribute needed: <details> hides the non-summary content natively. --%>
  <div
    data-slot="accordion-panel"
    id="${panelId}"
    role="${panelRole.isBlank() ? null : panelRole}"
    aria-labelledby="${panelRole.isBlank() ? null : triggerId}"
    style="padding:var(--lv-space-2) var(--lv-space-4) var(--lv-space-5);color:var(--lv-color-popover-fg);font-size:var(--lv-text-sm);line-height:var(--lv-leading);"
  >
    ${content}
  </div>
</details>
