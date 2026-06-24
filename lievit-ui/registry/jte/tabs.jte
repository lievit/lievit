@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
@import java.util.List
@import java.util.Collections
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tabs partial -- WAI-ARIA APG Tabs: a role=tablist strip of role=tab triggers +
  their role=tabpanel regions, controlled/uncontrolled headless primitive.

  TIER: PARTIAL + ENH (collection-nav.enhancer.ts, roving-tabindex mode for the tablist).
  CONTROLLED/UNCONTROLLED doctrine (architecture-contract §Overlay & stateful primitives):
    - UNCONTROLLED (default, zero-JS-degradable): the caller renders the full DOM with all panels;
      client-side visibility is driven by the aria-selected/hidden state the server stamps on
      initial render. Changing the active tab requires a server round-trip via the caller's own
      wire action. The collection-nav enhancer manages roving tabindex + arrow-key focus, and in
      automatic-activation mode also fires the wire action on arrow press. This partial does NOT
      own a @Wire field and does NOT have a Java component.
    - CONTROLLED: the caller passes activeTab from its own @Wire field:
        activeTab = _instance.activeTab()
      The server then re-renders this partial with the new activeTab after the wire round-trip,
      and the bespoke morph patches the DOM. Same template, same params -- only the caller owns
      the state.

  STRUCTURE (WAI-ARIA APG Tabs https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ +
  react-aria useTabList/useTab/useTabPanel interaction model as pattern reference (keyboard map,
  ARIA wiring, focus order; no source copied) + Ant Design Tabs as inventory reference
  (sizes, card/line/pill types, icon tabs, closable tabs, addable, lazy/eager panels)):
    root:    data-slot="tabs" data-orientation data-type data-size flex container;
    tablist: role="tablist" aria-label|aria-labelledby aria-orientation;
             data-lievit-collection (activates collection-nav enhancer, roving-tabindex mode);
    tabs:    real <button role="tab"> (native keyboard activation; NOT <a> or <div>);
             aria-selected aria-controls tabindex=0|-1 data-lievit-item;
    panels:  role="tabpanel" id="panel-{tabsId}-{tabId}" aria-labelledby="tab-{tabsId}-{tabId}"
             tabindex="0" (when no focusable children); eager: hidden="${!active}";
             lazy: inactive placeholder carries hx-get + hx-swap="outerHTML" + hx-trigger.

  A11y (WAI-ARIA APG Tabs, https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
    roles:   [role=tablist aria-label|aria-labelledby aria-orientation] >
             [role=tab id="tab-{tabsId}-{tabId}" aria-selected="true|false"
              aria-controls="panel-{tabsId}-{tabId}" tabindex="0|-1"
              aria-disabled="true" (disabled only; NOT native disabled -- a disabled tab MUST
              remain focusable in the roving order per APG)] +
             [role=tabpanel id="panel-{tabsId}-{tabId}" aria-labelledby="tab-{tabsId}-{tabId}"
              tabindex="0" when no focusable children]
    keys:    ArrowRight/Left (horizontal) | ArrowDown/Up (vertical) -- collection-nav roving;
             Home/End -- collection-nav; Enter/Space (manual mode) -- collection-nav;
             Tab -- platform: exits tablist into active tabpanel (next tabindex=0 element).
    disabled: aria-disabled="true" ONLY. Native disabled removes from tab order (breaks APG).
    close:   icon-only <button aria-label="Close {label}"> inside each closable tab (required).
    add:     icon-only <button aria-label="Add tab"> trailing the tablist (required).
    panel tabindex: tabindex="0" default; adopter drops it when the panel has focusable children.

  collection-nav attributes on the tablist root:
    data-lievit-collection                         -- activates the enhancer
    data-lievit-collection-roving-tabindex="true"  -- selects APG Tabs roving-tabindex model
    data-lievit-collection-orientation             -- "horizontal" | "vertical"
    data-lievit-collection-wrap="true"             -- wrap at ends (APG Tabs default)
    data-lievit-collection-select-action           -- wire action fired on Enter/Space (manual)
                                                      or on arrow key (automatic) by the enhancer
    data-manual-activation                         -- "true" = manual (arrow=focus only,
                                                      Enter/Space=activate); absent = automatic

  WIRE channels (XSS decision rule; same as button.jte):
    attrs     = TRUSTED raw ($unsafe) -- STATIC author-typed strings ONLY (e.g. data-testid).
                NEVER interpolate a per-tab id or user-derived value into attrs.
    Per-tab ids go through Escape.htmlAttribute and are emitted via $unsafe after escaping
    (the wireArgs / dataAttrs pattern from button.jte / switch.jte).

  Params:
    String tabsId             REQUIRED. A unique id for this tabset on the page; used to
                              derive deterministic ARIA anchor ids (tab-{tabsId}-{tabId},
                              panel-{tabsId}-{tabId}). Must be URL-safe, no spaces. When the
                              caller uses a wire component it typically passes the component id.
    List<String> tabIds       ordered tab id slugs. index-aligned with tabLabels, tabIcons,
                              tabClosable, tabDisabled.
    List<String> tabLabels    visible tab labels (index-aligned with tabIds).
    List<String> tabIcons     icon names per tab; empty string = no icon (index-aligned,
                              may be shorter -- missing entries default to no icon).
    List<Boolean> tabClosable whether each tab shows the close button (index-aligned;
                              may be shorter -- missing entries default to false).
    List<Boolean> tabDisabled whether each tab carries aria-disabled (index-aligned;
                              may be shorter -- missing entries default to false).
    String activeTab          the id of the currently active tab (server truth).
    String orientation = "horizontal"  "horizontal" | "vertical".
    String size = "md"        "sm" | "md" | "lg" (tab height, toolbar-aligned).
    String type = "line"      "line" | "card" | "pill".
    boolean lazyLoad = false  false = eager (all panels in DOM, hidden); true = HTMX lazy swap.
    boolean addable = false   show "add tab" + button trailing the tablist.
    boolean manualActivation = false  APG activation mode. false = automatic (arrow = focus +
                              activate); true = manual (arrow = focus only; Enter/Space = activate).
    String tabsLabel = null   aria-label for the tablist (REQUIRED unless tabsLabelledBy is set).
    String tabsLabelledBy = null  aria-labelledby alternative to tabsLabel.
    String selectAction = null  wire action name fired by collection-nav on tab activation
                              (emitted on the tab button element; the enhancer reads it from
                              data-lievit-collection-select-action on the tablist root). Typically
                              the caller's activate(id) action name -- e.g. "activate".
    String closeAction = null  wire action name for the close button l:click (caller's closeTab).
    String addAction = null    wire action name for the add button l:click (caller's addTab).
    String cssClass = ""      extra utility classes on the root.
    String attrs = ""         TRUSTED raw attribute string ($unsafe) -- STATIC strings only.

  Usage (controlled -- caller owns activeTab):
    @@template.lievit.tabs(
      tabsId       = _component.id(),
      tabIds       = java.util.List.of("info", "docs", "history"),
      tabLabels    = java.util.List.of("Anagrafica", "Documenti", "Storico"),
      tabIcons     = java.util.List.of("user", "", "clock"),
      tabClosable  = java.util.List.of(false, true, true),
      tabDisabled  = java.util.List.of(false, false, false),
      activeTab    = activeTab,
      tabsLabel    = "Settings",
      selectAction = "activate",
      closeAction  = "closeTab",
      addAction    = "addTab",
      addable      = true
    )
    Then in the caller's WIRE template body: author each panel region as
    data-slot="tabs-content" divs (owned markup; no Content slot per server-first blueprint).
--%>
@param String tabsId
@param List<String> tabIds
@param List<String> tabLabels
@param List<String> tabIcons = Collections.emptyList()
@param List<Boolean> tabClosable = Collections.emptyList()
@param List<Boolean> tabDisabled = Collections.emptyList()
@param String activeTab
@param String orientation = "horizontal"
@param String size = "md"
@param String type = "line"
@param boolean lazyLoad = false
@param boolean addable = false
@param boolean manualActivation = false
@param String tabsLabel = null
@param String tabsLabelledBy = null
@param String selectAction = null
@param String closeAction = null
@param String addAction = null
@param String cssClass = ""
@param String attrs = ""

<%-- ── Height token per size: toolbar-alignment rule (same scale as button.jte).
     sm -> --lv-space-8 (32px) | md -> --lv-space-9 (36px) | lg -> --lv-space-10 (40px). --%>
!{var heightClass = switch (size) {
    case "sm" -> "h-[var(--lv-space-8)]";
    case "lg" -> "h-[var(--lv-space-10)]";
    default   -> "h-[var(--lv-space-9)]";
  };}

<%-- ── Horizontal padding proportional to size (same rule as button.jte). --%>
!{var hPadClass = switch (size) {
    case "sm" -> "px-[var(--lv-space-4)]";
    default   -> "px-[var(--lv-space-6)]";
  };}

<%-- ── Text size per size. --%>
!{var textClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-sm)]";
    default   -> "text-[length:var(--lv-text-base)]";
  };}

<%-- ── Tablist strip style by type.
     line: bottom divider below the strip (border-b on the tablist wrapper); active tab spans it
           with -mb-px so the indicator merges with the strip divider visually.
     card: raised card tabs; no strip divider; active card has no bottom border (merges with panel).
     pill: filled background pill on active tab; no strip divider. --%>
!{var stripClass = switch (type) {
    case "pill" -> "flex items-center gap-[var(--lv-space-1)] overflow-x-auto";
    case "card" -> "flex items-end gap-[var(--lv-space-1)] overflow-x-auto";
    default     -> "flex items-stretch gap-[var(--lv-space-1)] overflow-x-auto border-b border-[var(--lv-color-border)]";
  };}

<%-- ── Shared tab button base (all types).
     NOTE: no native `disabled` -- disabled tabs use aria-disabled only per APG (native disabled
     removes the element from the tab order, which breaks the APG roving-tabindex model). --%>
!{var tabBase = "inline-flex shrink-0 items-center gap-[var(--lv-space-3)] whitespace-nowrap cursor-pointer border outline-none transition-[color,background-color,border-color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:shadow-[var(--lv-ring)] aria-disabled:opacity-50 aria-disabled:cursor-not-allowed font-[family-name:var(--lv-font-sans)]";}

<%-- ── ACTIVE tab visual per type.
     line: fg label + font-medium + primary border-bottom indicator + -mb-px to span strip divider.
     card: bg surface (merges with panel), fg label, font-medium, card border, no bottom border,
           top rounding, shadow-xs.
     pill: primary background, primary-fg label, font-medium, full rounding. --%>
!{var activeTabLine = heightClass + " " + hPadClass + " text-[var(--lv-color-fg)] font-[var(--lv-font-medium)] border-transparent border-b-2 border-b-[var(--lv-color-primary)] -mb-px rounded-none";}
!{var activeTabCard = heightClass + " " + hPadClass + " bg-[var(--lv-color-bg)] text-[var(--lv-color-fg)] font-[var(--lv-font-medium)] border border-[var(--lv-color-border)] border-b-[var(--lv-color-bg)] shadow-[var(--lv-shadow-xs)] rounded-t-[var(--lv-radius-md)] rounded-b-none";}
!{var activeTabPill = heightClass + " " + hPadClass + " bg-[var(--lv-color-primary)] text-[var(--lv-color-primary-fg)] font-[var(--lv-font-medium)] border-transparent rounded-[var(--lv-radius-full)]";}

<%-- ── INACTIVE tab visual per type.
     line: muted label, transparent border, no rounding; hover: accent bg + accent-fg label.
     card: card bg, muted label, card border, shadow-xs, top rounding; hover: accent tint.
     pill: transparent bg + border, muted label; hover: accent bg + accent-fg label. --%>
!{var inactiveTabLine = heightClass + " " + hPadClass + " text-[var(--lv-color-muted-fg)] border-transparent rounded-none hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";}
!{var inactiveTabCard = heightClass + " " + hPadClass + " bg-[var(--lv-color-card)] text-[var(--lv-color-muted-fg)] border border-[var(--lv-color-border)] shadow-[var(--lv-shadow-xs)] rounded-t-[var(--lv-radius-md)] rounded-b-none hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";}
!{var inactiveTabPill = heightClass + " " + hPadClass + " bg-transparent text-[var(--lv-color-muted-fg)] border-transparent rounded-[var(--lv-radius-full)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";}

<%-- ── collection-nav orientation: maps orientation param to the enhancer's attribute value. --%>
!{var collNavOrientation = "vertical".equals(orientation) ? "vertical" : "horizontal";}

<%-- ── Root flex direction: horizontal tablist = column (strip above panels);
     vertical tablist = row (strip beside panels). --%>
!{var rootDirClass = "vertical".equals(orientation) ? "flex-row" : "flex-col";}

<%-- ── selectAction attr value: emit as non-null string when set, null = omit the attribute. --%>
!{var selectActionAttr = (selectAction != null && !selectAction.isBlank()) ? selectAction : null;}

<div
  data-slot="tabs"
  data-orientation="${orientation}"
  data-type="${type}"
  data-size="${size}"
  class="flex ${rootDirClass} font-[family-name:var(--lv-font-sans)] ${cssClass}"
  $unsafe{attrs}
>
  <%-- ══════════════════════════════════════════════════════════════ tablist strip ══ --%>
  <div
    role="tablist"
    aria-label="${tabsLabel}"
    aria-labelledby="${tabsLabelledBy}"
    aria-orientation="${orientation}"
    data-slot="tabs-list"
    data-lievit-collection
    data-lievit-collection-roving-tabindex="true"
    data-lievit-collection-orientation="${collNavOrientation}"
    data-lievit-collection-wrap="true"
    data-lievit-collection-select-action="${selectActionAttr}"
    data-manual-activation="${manualActivation ? "true" : null}"
    class="${stripClass}"
  >
    @for(int i = 0; i < tabIds.size(); i++)
      !{var tabId = tabIds.get(i);}
      !{var tabLabel = i < tabLabels.size() ? tabLabels.get(i) : tabId;}
      !{var tabIcon = i < tabIcons.size() ? tabIcons.get(i) : "";}
      !{var isClosable = i < tabClosable.size() && Boolean.TRUE.equals(tabClosable.get(i));}
      !{var isDisabled = i < tabDisabled.size() && Boolean.TRUE.equals(tabDisabled.get(i));}
      !{var isActive = tabId.equals(activeTab);}

      <%-- Escape per-tab id through Escape.htmlAttribute: tab ids are server-supplied and
           potentially user-influenced; they MUST go through the SAFE escaped channel, never
           through the trusted $unsafe `attrs` channel (XSS decision rule). --%>
      !{var safeIdOut = new StringOutput();}
      !{Escape.htmlAttribute(tabId, safeIdOut);}
      !{var safeTabId = safeIdOut.toString();}

      <%-- Escape tab label for use in aria-label of the close button. --%>
      !{var safeLabelOut = new StringOutput();}
      !{Escape.htmlAttribute(tabLabel, safeLabelOut);}
      !{var safeTabLabel = safeLabelOut.toString();}

      <%-- Per-type active/inactive class for this tab. --%>
      !{var tabStateClass = isActive
          ? switch (type) {
              case "card" -> activeTabCard;
              case "pill" -> activeTabPill;
              default     -> activeTabLine;
            }
          : switch (type) {
              case "card" -> inactiveTabCard;
              case "pill" -> inactiveTabPill;
              default     -> inactiveTabLine;
            };}

      <%-- WAI-ARIA APG Tabs: each tab is a real <button role="tab">.
           tabindex="0" on the active tab; tabindex="-1" on all others (roving tabindex;
           collection-nav updates on arrow-key navigation).
           aria-disabled="true" on disabled tabs; NOT native `disabled` (a disabled tab must
           remain focusable in the roving order per APG; native disabled breaks that by removing
           the element from the tab order). The Java action and the collection-nav enhancer both
           enforce no-activation for disabled tabs.
           l:click fires the caller's wire action when selectAction is set. The data-id carries
           the tab id through the SAFE escaped channel (never through $unsafe attrs). --%>
      <%-- The tab trigger and its close button are SIBLINGS inside a presentation wrapper, never
           nested: a <button> inside a <button> is invalid HTML and a click target ambiguity. The
           role=tab + data-lievit-item live on the trigger; collection-nav finds the item at any
           depth; the close button is outside the tab's activation area (closing != selecting). --%>
      <span data-slot="tabs-trigger-wrapper" role="presentation" class="relative inline-flex items-center">
        <button
          type="button"
          role="tab"
          id="tab-${tabsId}-$unsafe{safeTabId}"
          aria-selected="${isActive ? "true" : "false"}"
          aria-controls="panel-${tabsId}-$unsafe{safeTabId}"
          aria-disabled="${isDisabled ? "true" : null}"
          tabindex="${isActive ? "0" : "-1"}"
          data-slot="tabs-trigger"
          data-lievit-item
          data-id="$unsafe{safeTabId}"
          l:click="${selectActionAttr}"
          class="${tabBase} ${tabStateClass} ${textClass}"
        >
          @if(tabIcon != null && !tabIcon.isBlank())
            @template.lievit.icon(name = tabIcon, size = "1em")
          @endif
          ${tabLabel}
        </button>
        @if(isClosable)
          <%-- Icon-only close button: aria-label="Close {label}" is REQUIRED (an icon-only button
               with no accessible name is unusable to AT). data-id carries the tab id through the
               SAFE escaped channel; the runtime dispatches l:click on this element independently. --%>
          !{var closeIdOut = new StringOutput();}
          !{Escape.htmlAttribute(tabId, closeIdOut);}
          !{var safeCloseId = closeIdOut.toString();}
          !{var closeAction2 = (closeAction != null && !closeAction.isBlank()) ? closeAction : null;}
          <button
            type="button"
            aria-label="Close $unsafe{safeTabLabel}"
            data-slot="tabs-close"
            data-id="$unsafe{safeCloseId}"
            l:click="${closeAction2}"
            class="inline-flex items-center justify-center shrink-0 w-[var(--lv-space-4)] h-[var(--lv-space-4)] -ml-[var(--lv-space-1)] mr-[var(--lv-space-1)] p-0 rounded-[var(--lv-radius-md)] border-transparent bg-transparent cursor-pointer text-inherit hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] transition-[color,background-color,box-shadow] duration-[var(--lv-duration-fast)]"
          >@template.lievit.icon(name = "x", size = "0.75em")</button>
        @endif
      </span>
    @endfor

    @if(addable)
      <%-- Icon-only add-tab button: aria-label="Add tab" is REQUIRED (no visible text, WAI-ARIA
           button rule). This button does NOT carry data-lievit-item: it is not a tab in the
           tablist; it is a trailing action outside the roving focus order. The platform's natural
           Tab order reaches it after the tablist's active tab without special wiring. --%>
      !{var addActionAttr = (addAction != null && !addAction.isBlank()) ? addAction : null;}
      !{var addBtnWidthClass = switch (size) {
          case "sm" -> "w-[var(--lv-space-8)]";
          case "lg" -> "w-[var(--lv-space-10)]";
          default   -> "w-[var(--lv-space-9)]";
        };}
      <button
        type="button"
        aria-label="Add tab"
        data-slot="tabs-add"
        l:click="${addActionAttr}"
        class="inline-flex shrink-0 items-center justify-center ${heightClass} ${addBtnWidthClass} p-0 ml-[var(--lv-space-1)] border border-transparent rounded-[var(--lv-radius-md)] bg-transparent text-[var(--lv-color-muted-fg)] cursor-pointer hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] outline-none focus-visible:shadow-[var(--lv-ring)] transition-[color,background-color,box-shadow] duration-[var(--lv-duration-fast)]"
      >@template.lievit.icon(name = "plus", size = "1em")</button>
    @endif
  </div>

  <%-- ══════════════════════════════════════════════════════════════════════ panels ══ --%>
  @for(int p = 0; p < tabIds.size(); p++)
    !{var ptTabId = tabIds.get(p);}
    !{var ptIsActive = ptTabId.equals(activeTab);}

    <%-- Escape panel tab id (same SAFE channel as above). --%>
    !{var ptSafeOut = new StringOutput();}
    !{Escape.htmlAttribute(ptTabId, ptSafeOut);}
    !{var ptSafeId = ptSafeOut.toString();}

    @if(lazyLoad && !ptIsActive)
      <%-- LAZY PANEL PLACEHOLDER (inactive tabs, lazy mode).
           No body content is rendered here; HTMX swaps in the real fragment when
           the "tabs-activate" custom event fires (dispatched by the runtime afterCall hook
           after the wire round-trip re-renders with the new activeTab).
           The minimal tabpanel shell keeps the ARIA relationship (aria-labelledby) present in
           the DOM before the swap so AT can traverse the full tab structure without triggering
           a load. hx-swap="outerHTML" replaces this placeholder with the real panel element.
           After first load the panel stays in the DOM (hidden) so back-navigation is instant. --%>
      <div
        role="tabpanel"
        id="panel-${tabsId}-$unsafe{ptSafeId}"
        aria-labelledby="tab-${tabsId}-$unsafe{ptSafeId}"
        data-slot="tabs-content"
        hidden
        hx-get="/tabs/${tabsId}/panel/$unsafe{ptSafeId}"
        hx-swap="outerHTML"
        hx-trigger="tabs-activate from:closest [data-slot='tabs']"
      ></div>
    @else
      <%-- EAGER PANEL (lazyLoad=false) or the ACTIVE PANEL in lazy mode.
           hidden="${!ptIsActive}" removes inactive panels from view + the a11y tree (boolean
           attribute: the string "false" is a truthy boolean attribute in HTML5, so we rely on
           JTE's boolean-attribute smart-attr here: hidden="${!ptIsActive}" emits the bare
           `hidden` attribute when ptIsActive is false and omits it when ptIsActive is true).
           tabindex="0" is the DEFAULT: the tabpanel must be keyboard-reachable after Tab exits
           the tablist (APG requirement when the panel body has no focusable children). The
           adopter DROPS tabindex on this element when the panel body contains interactive
           children (focus lands naturally on the first child instead).
           outline-none suppresses the default :focus ring on the panel (it is a focus stop for
           screen readers, not a visually-interactive element). --%>
      <div
        role="tabpanel"
        id="panel-${tabsId}-$unsafe{ptSafeId}"
        aria-labelledby="tab-${tabsId}-$unsafe{ptSafeId}"
        tabindex="0"
        data-slot="tabs-content"
        hidden="${!ptIsActive}"
        class="p-[var(--lv-space-4)] outline-none"
      >
        <%-- OWNED BODY REGION for this panel. The caller places server-rendered panel markup
             here after copying in the template. This is the server-first "owned content" model:
             no JTE Content slot (the headless controlled/uncontrolled contract has none), no
             <slot> (eliminates the silent-slot bug class the pivot killed). Panel bodies are
             plain server-rendered HTML, authored by the adopter per-tab.
             Default placeholder (replace with real content in your adopted copy): --%>
        <p data-tabs-body="${ptTabId}">Panel content for ${tabIds.get(p)}.</p>
      </div>
    @endif
  @endfor
</div>
